// HTTP handlers for post-production, the edit plan and rendering.
//   POST PRODUCTION_START  {lessonPath, retranscribe?, autoPublish?} → JobState
//        (autoPublish overrides the lesson setting for this job: render afterwards or not)
//   GET  PRODUCTION_STATUS ?lessonPath=                 → JobState | null
//   POST PRODUCTION_CANCEL {lessonPath}                 → {cancelled: boolean}
//   GET  EDIT_PLAN_API     ?lessonPath=                 → EditPlan
//   PUT  EDIT_PLAN_API     {lessonPath, cuts?, chapters?, layout?, intro?, outro?} → EditPlan
//   GET  CAPTIONS_API      ?lessonPath=                 → Caption[] (selected take)
//   PUT  CAPTIONS_API      {lessonPath, captions}       → Caption[] (text edits only)
//   POST RENDER_LESSON     {lessonPath}                 → JobState
import type { IncomingMessage, ServerResponse } from "http";
import { z } from "zod";
import { editPlan } from "../../../config/course";
import fs from "fs";
import { EOL } from "os";
import {
  settleLessonStatus,
  startProductionJob,
  startRenderJob,
} from "../automation/pipeline";
import { readLesson, writeJsonAtomic } from "../course-store";
import { HttpError } from "../http-json";
import { applyEditPlanPatch, resolvePlanDurationMs } from "./edit-plan";
import { cancelJob, getActiveJob, reconcileJobState } from "./job-queue";
import { captionList, checkCaptionEdit } from "./captions";
import {
  getTakeFiles,
  productionFiles,
  readAnalysis,
  readCaptions,
  readEditPlan,
} from "./take-files";

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
    lessonPathBody.extend({
      retranscribe: z.boolean().optional(),
      autoPublish: z.boolean().optional(),
    }),
    await readBody(req),
  );
  const state = startProductionJob({
    lessonPath: body.lessonPath,
    retranscribe: body.retranscribe ?? false,
    autoPublish: body.autoPublish,
    trigger: "manual",
  });
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
  const durationMs = resolvePlanDurationMs(
    plan,
    analysis && analysis.takeId === plan.takeId ? analysis.durationMs : null,
  );
  let next;
  try {
    next = editPlan.parse(applyEditPlanPatch(plan, body, durationMs));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  writeJsonAtomic(productionFiles(body.lessonPath).editPlan, next);
  sendJson(res, 200, next);
});

const selectedTakeFiles = (lessonPath: string) => {
  const lesson = readLesson(lessonPath);
  if (!lesson.selectedTake) {
    throw new HttpError(400, "The lesson has no selected take");
  }
  return getTakeFiles(lessonPath, lesson.selectedTake);
};

export const handleCaptions = handler(["GET", "PUT"], async (req, res) => {
  if (req.method === "GET") {
    const captions = readCaptions(selectedTakeFiles(queryLessonPath(req)));
    if (!captions) {
      throw new HttpError(404, "The selected take has no captions");
    }
    sendJson(res, 200, captions);
    return;
  }

  const body = parse(
    z.object({ lessonPath: z.string().min(1), captions: captionList }),
    await readBody(req),
  );
  ensureNoActiveJob(body.lessonPath);
  const take = selectedTakeFiles(body.lessonPath);
  const problem = checkCaptionEdit(readCaptions(take), body.captions);
  if (problem) {
    throw new HttpError(400, problem);
  }
  writeJsonAtomic(take.captions, body.captions);
  // Same trailing newline as the files written by post-production.
  fs.appendFileSync(take.captions, EOL);
  sendJson(res, 200, body.captions);
});

export const handleRenderLesson = handler(["POST"], async (req, res) => {
  const body = parse(lessonPathBody, await readBody(req));
  sendJson(
    res,
    202,
    startRenderJob({ lessonPath: body.lessonPath, trigger: "manual" }),
  );
});
