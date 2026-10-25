import { IncomingMessage, ServerResponse } from "http";
import { ZodError, prettifyError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    throw new HttpError(400, "Request body is not valid JSON");
  }
};

export const getQuery = (req: IncomingMessage) => {
  const url = req.url as string;
  return new URLSearchParams(url.substring(url.indexOf("?") + 1));
};

export const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const statusOf = (e: unknown) => {
  if (e instanceof HttpError) {
    return e.status;
  }

  if (e instanceof ZodError) {
    return 400;
  }

  if ((e as NodeJS.ErrnoException).code === "ENOENT") {
    return 404;
  }

  if ((e as Error).message?.startsWith("Path is outside of")) {
    return 400;
  }

  return 500;
};

export const jsonHandler = (
  handlers: Partial<
    Record<string, (req: IncomingMessage) => Promise<unknown> | unknown>
  >,
) => {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const handler = handlers[req.method ?? "GET"];
    try {
      if (!handler) {
        throw new HttpError(405, `Method ${req.method} not allowed`);
      }

      sendJson(res, 200, await handler(req));
    } catch (e) {
      const status = statusOf(e);
      if (status === 500) {
        console.error(e);
      }

      sendJson(res, status, {
        error: e instanceof ZodError ? prettifyError(e) : (e as Error).message,
      });
    }
  };
};
