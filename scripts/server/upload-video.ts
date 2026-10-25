import fs, { createWriteStream } from "fs";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { ZodError, prettifyError, z } from "zod";
import {
  ALTERNATIVE1_PREFIX,
  ALTERNATIVE2_PREFIX,
  DISPLAY_PREFIX,
  WEBCAM_PREFIX,
} from "../../config/cameras";
import { takePath } from "../../config/course";
import { ensureWhisper } from "../captions/install-whisper";
import { lessonPathParam, takeIdParam } from "./course-api";
import { resolvePublicPath } from "./course-store";
import { makeStreamPayload } from "./streaming";
import { transcribeVideo } from "./transcribe-video";

let currentSignal = new AbortController();

export const handleTranscribeVideo = async (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  const url = req.url as string;
  const params = new URLSearchParams(url.substring(1));
  const endDateAsString = params.get("endDateAsString");
  const folder = params.get("folder");
  const publicDir = path.join(process.cwd(), "public");
  currentSignal = new AbortController();

  if (typeof endDateAsString !== "string") {
    throw new Error("No `endDate` provided");
  }

  if (typeof folder !== "string") {
    throw new Error("No `folder` provided");
  }

  try {
    await ensureWhisper({
      onInstall: () => {
        res.write(
          makeStreamPayload({
            message: {
              type: "install-whisper-progress",
              payload: {},
            },
          }),
        );
      },
      onModelProgressInPercent: (progress) => {
        res.write(
          makeStreamPayload({
            message: {
              type: "downloading-whisper-model-progress",
              payload: {
                progressInPercent: progress,
              },
            },
          }),
        );
      },
      signal: currentSignal.signal,
    });

    await transcribeVideo({
      endDateAsString,
      folder,
      publicDir,
      onProgress: ({ filename, progressInPercent: progress }) => {
        const payload = makeStreamPayload({
          message: {
            type: "transcribing-progress",
            payload: {
              filename,
              progress,
            },
          },
        });
        res.write(payload);
      },
      signal: currentSignal.signal,
    });

    res.statusCode = 200;
    res.end();
  } catch (e) {
    if (
      (e as Error).name === "AbortError" ||
      (e as Error).message.includes("SIGTERM")
    ) {
      const payload = makeStreamPayload({
        message: {
          type: "whisper-abort",
          payload: {},
        },
      });
      res.write(payload);
      res.statusCode = 200;
      res.end();
      return;
    }
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

export const handleCancelTranscription = async (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  try {
    currentSignal.abort();
    res.statusCode = 200;
    res.end();
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const lessonUploadParams = z.object({
  lessonPath: lessonPathParam,
  takeId: takeIdParam,
  prefix: z.enum([
    WEBCAM_PREFIX,
    DISPLAY_PREFIX,
    ALTERNATIVE1_PREFIX,
    ALTERNATIVE2_PREFIX,
  ]),
  extension: z.enum(["mp4", "webm"]),
});

const getUploadPath = (params: URLSearchParams) => {
  if (params.has("lessonPath")) {
    const { lessonPath, takeId, prefix, extension } = lessonUploadParams.parse(
      Object.fromEntries(params),
    );
    if (
      !fs.existsSync(path.join(resolvePublicPath(lessonPath), "lesson.json"))
    ) {
      throw new Error(`Lesson ${lessonPath} does not exist`);
    }

    return path.join(
      resolvePublicPath(takePath(lessonPath, takeId)),
      `${prefix}.${extension}`,
    );
  }

  const endDateAsString = params.get("endDateAsString");
  const folder = params.get("folder");
  const prefix = params.get("prefix");
  const extension = params.get("extension");

  if (typeof prefix !== "string") {
    throw new Error("No `prefix` provided");
  }

  if (typeof endDateAsString !== "string") {
    throw new Error("No `endDate` provided");
  }

  if (typeof folder !== "string") {
    throw new Error("No `folder` provided");
  }

  const file = `${prefix}${endDateAsString}.${extension}`;
  return path.join(process.cwd(), "public", folder, file);
};

export const handleVideoUpload = async (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  const url = req.url as string;
  const params = new URLSearchParams(url.substring(1));
  try {
    const filePath = getUploadPath(params);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const writeStream = createWriteStream(filePath);

    req.pipe(writeStream);

    await new Promise<void>((resolve) =>
      writeStream.on("finish", () => {
        resolve();
      }),
    );

    res.statusCode = 200;
    res.end();
  } catch (e) {
    if (e instanceof ZodError) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: prettifyError(e) }));
      return;
    }

    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};
