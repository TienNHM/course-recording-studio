// HTTP handlers for post-production, the edit plan and rendering.
//   POST PRODUCTION_START  {lessonPath, retranscribe?}  → JobState
//   GET  PRODUCTION_STATUS ?lessonPath=                 → JobState | null
//   POST PRODUCTION_CANCEL {lessonPath}                 → {cancelled: boolean}
//   GET  EDIT_PLAN_API     ?lessonPath=                 → EditPlan
//   PUT  EDIT_PLAN_API     {lessonPath, cuts?, chapters?, layout?, intro?, outro?} → EditPlan
//   POST RENDER_LESSON     {lessonPath}                 → JobState
import type { IncomingMessage, ServerResponse } from "http";
import { z } from "zod";
import type { LessonStatus } from "../../../config/course";
import { editPlan } from "../../../config/course";
import { readLesson, updateLesson, writeJsonAtomic } from "../course-store";
import { runRender } from "../render/render-lesson";
import { applyEditPlanPatch, inferDurationMs } from "./edit-plan";
import type { JobState } from "./job-queue";
import {
  cancelJob,
  enqueueJob,
  getActiveJob,
  reconcileJobState,
} from "./job-queue";
import { runProduction } from "./run-production";
import { productionFiles, readAnalysis, readEditPlan } from "./take-files";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
};

const parse = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, result.error.message);
  }
  return result.data;
};

const queryLessonPath = (req: IncomingMessage) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const lessonPath = url.searchParams.get("lessonPath");
  if (!lessonPath) {
    throw new HttpError(400, "Missing `lessonPath` query parameter");
  }
  return lessonPath;
};

const handler =
  (
    methods: string[],
    fn: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  ) =>
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!methods.includes(req.method ?? "GET")) {
        throw new HttpError(405, `Method ${req.method} not allowed`);
      }
      await fn(req, res);
    } catch (e) {
      const status =
        e instanceof HttpError
          ? e.status
          : (e as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : (e as Error).message?.startsWith("Path is outside")
              ? 400
              : 500;
      if (status === 500) {
        console.error(e);
      }
      sendJson(res, status, { error: (e as Error).message });
    }
  };

const setLessonStatus = (lessonPath: string, status: LessonStatus) => {
  try {
    updateLesson(lessonPath, (l) => ({ ...l, status }));
  } catch (e) {
    console.error(`Could not set lesson status to ${status}`, e);
  }
};

// Lesson status after a job ends (or is found interrupted).
const settleLessonStatus = (state: JobState) => {
  if (state.kind === "production") {
    setLessonStatus(
      state.lessonPath,
      state.status === "COMPLETED" ? "REVIEW" : "RECORDED",
    );
  } else if (state.status === "COMPLETED") {
    setLessonStatus(state.lessonPath, "PUBLISHED");
  }
};

const lessonPathBody = z.object({ lessonPath: z.string().min(1) });

const ensureNoActiveJob = (lessonPath: string) => {
  if (getActiveJob(lessonPath)) {
    throw new HttpError(
      409,
      "A job is already queued or running for this lesson",
    );
  }
};

export const handleProductionStart = handler(["POST"], async (req, res) => {
  const body = parse(
    lessonPathBody.extend({ retranscribe: z.boolean().optional() }),
    await readBody(req),
  );
  const lesson = readLesson(body.lessonPath);
  if (!lesson.selectedTake) {
    throw new HttpError(400, "The lesson has no selected take");
  }
  ensureNoActiveJob(body.lessonPath);
  const state = enqueueJob({
    kind: "production",
    lessonPath: body.lessonPath,
    takeId: lesson.selectedTake,
    run: (ctx) =>
      runProduction({
        lessonPath: body.lessonPath,
        retranscribe: body.retranscribe ?? false,
        ctx,
      }),
    onSettled: settleLessonStatus,
  });
  setLessonStatus(body.lessonPath, "PROCESSING");
  sendJson(res, 202, state);
});

export const handleProductionStatus = handler(["GET"], async (req, res) => {
  const lessonPath = queryLessonPath(req);
  const state =
    getActiveJob(lessonPath) ??
    reconcileJobState(lessonPath, settleLessonStatus);
  sendJson(res, 200, state);
});

export const handleProductionCancel = handler(["POST"], async (req, res) => {
  const body = parse(lessonPathBody, await readBody(req));
  sendJson(res, 200, { cancelled: cancelJob(body.lessonPath) });
});

const editPlanPatch = z.object({
  lessonPath: z.string().min(1),
  cuts: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        accepted: z.boolean(),
      }),
    )
    .optional(),
  chapters: editPlan.shape.chapters.optional(),
  layout: editPlan.shape.layout.optional(),
  intro: editPlan.shape.intro.optional(),
  outro: z.boolean().optional(),
});

export const handleEditPlan = handler(["GET", "PUT"], async (req, res) => {
  if (req.method === "GET") {
    const lessonPath = queryLessonPath(req);
    const plan = readEditPlan(lessonPath);
    if (!plan) {
      throw new HttpError(404, "No edit plan yet");
    }
    sendJson(res, 200, plan);
    return;
  }

  const body = parse(editPlanPatch, await readBody(req));
  ensureNoActiveJob(body.lessonPath);
  const plan = readEditPlan(body.lessonPath);
  if (!plan) {
    throw new HttpError(404, "No edit plan yet");
  }
  const analysis = readAnalysis(body.lessonPath);
  const durationMs =
    analysis && analysis.takeId === plan.takeId
      ? analysis.durationMs
      : inferDurationMs(plan);
  let next;
  try {
    next = editPlan.parse(applyEditPlanPatch(plan, body, durationMs));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  writeJsonAtomic(productionFiles(body.lessonPath).editPlan, next);
  sendJson(res, 200, next);
});

export const handleRenderLesson = handler(["POST"], async (req, res) => {
  const body = parse(lessonPathBody, await readBody(req));
  const plan = readEditPlan(body.lessonPath);
  if (!plan) {
    throw new HttpError(400, "No edit plan yet. Run post-production first.");
  }
  ensureNoActiveJob(body.lessonPath);
  const state = enqueueJob({
    kind: "render",
    lessonPath: body.lessonPath,
    takeId: plan.takeId,
    run: (ctx) => runRender({ lessonPath: body.lessonPath, ctx }),
    onSettled: settleLessonStatus,
  });
  sendJson(res, 202, state);
});
