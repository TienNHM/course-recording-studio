// Automation routes:
//   GET  PIPELINE_STATUS ?lessonPath=           → PipelineStatus (current job + what runs next)
//   GET  AUTOMATION_SETTINGS                    → settings + inbox watcher state
//   PUT  AUTOMATION_SETTINGS {inboxDir?, enabled?} → same; (re)starts / stops the watcher
//   GET  AUTOMATION_INBOX                       → {settings, watcher, events (newest first, max 50)}
//   POST AUTOMATION_PROCESS_PENDING {courseId?, lessonPaths?, dryRun?}
//        → post-production for every RECORDED lesson, render for every REVIEW
//          lesson with autoPublish on; all through the single job queue.
import type { Server } from "connect";
import type { IncomingMessage } from "http";
import { z } from "zod";
import type { JobState } from "../../../config/course";
import {
  COURSES_DIR,
  lessonPath as toLessonPath,
} from "../../../config/course";
import {
  AUTOMATION_INBOX,
  AUTOMATION_PROCESS_PENDING,
  AUTOMATION_SETTINGS,
  PIPELINE_STATUS,
} from "../constants";
import { lessonPathParam } from "../course-api";
import { readLesson, resolvePublicPath } from "../course-store";
import { buildCourseTree } from "../course-tree";
import { HttpError, getQuery, jsonHandler, readJsonBody } from "../http-json";
import { getActiveJob, reconcileJobState } from "../production/job-queue";
import { readEditPlan } from "../production/take-files";
import { getActivity } from "./activity-log";
import { pendingAction } from "./decisions";
import { applyInboxSettings, getInboxStatus } from "./inbox-watcher";
import {
  getPipelineStatus,
  settleLessonStatus,
  startProductionJob,
  startRenderJob,
} from "./pipeline";
import { getSettings, saveSettings, settingsPatch } from "./settings";

const settingsResponse = () => ({
  ...getSettings(),
  watcher: getInboxStatus(),
});

const handleSettings = jsonHandler({
  GET: () => settingsResponse(),
  PUT: async (req: IncomingMessage) => {
    const patch = settingsPatch.parse(await readJsonBody(req));
    try {
      saveSettings(patch);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    applyInboxSettings();
    return settingsResponse();
  },
});

const handleInbox = jsonHandler({
  GET: () => ({
    settings: getSettings(),
    watcher: getInboxStatus(),
    events: getActivity(),
  }),
});

const handlePipelineStatus = jsonHandler({
  GET: (req: IncomingMessage) =>
    getPipelineStatus(lessonPathParam.parse(getQuery(req).get("lessonPath"))),
});

export const processPendingRequest = z
  .object({
    // Only lessons of this course.
    courseId: z.string().optional(),
    // Only these lessons.
    lessonPaths: z.array(lessonPathParam).optional(),
    // Report what would be queued without queuing anything.
    dryRun: z.boolean().optional(),
  })
  .strict();

type Queued = { lessonPath: string; jobId: string | null };

const hasEditPlan = (lessonPath: string) => {
  try {
    return readEditPlan(lessonPath) !== null;
  } catch {
    return false;
  }
};

export const processPending = (body: z.infer<typeof processPendingRequest>) => {
  const production: Queued[] = [];
  const render: Queued[] = [];
  const skipped: { lessonPath: string; reason: string }[] = [];
  const tree = buildCourseTree(resolvePublicPath(COURSES_DIR));
  for (const { course, modules } of tree) {
    if (body.courseId && course.id !== body.courseId) continue;
    for (const { lessons } of modules) {
      for (const listed of lessons) {
        const lessonPath = toLessonPath(listed);
        if (body.lessonPaths && !body.lessonPaths.includes(lessonPath))
          continue;
        if (!["RECORDED", "PROCESSING", "REVIEW"].includes(listed.status)) {
          continue;
        }
        // A job interrupted by a restart puts the lesson back to RECORDED.
        const active = getActiveJob(lessonPath);
        if (!active) {
          reconcileJobState(lessonPath, settleLessonStatus);
        }
        const lesson = readLesson(lessonPath);
        const decision = pendingAction({
          lesson,
          hasActiveJob: active !== null,
          hasEditPlan: hasEditPlan(lessonPath),
        });
        if (decision.action === null) {
          skipped.push({ lessonPath, reason: decision.reason });
          continue;
        }
        let job: JobState | null = null;
        try {
          if (!body.dryRun) {
            job =
              decision.action === "production"
                ? startProductionJob({ lessonPath, trigger: "process-pending" })
                : startRenderJob({ lessonPath, trigger: "process-pending" });
          }
        } catch (e) {
          skipped.push({ lessonPath, reason: (e as Error).message });
          continue;
        }
        (decision.action === "production" ? production : render).push({
          lessonPath,
          jobId: job?.id ?? null,
        });
      }
    }
  }
  return { dryRun: body.dryRun ?? false, production, render, skipped };
};

const handleProcessPending = jsonHandler({
  POST: async (req: IncomingMessage) => {
    // An empty body means "everything"; a malformed one is still an error.
    const empty =
      req.headers["content-length"] === "0" ||
      (!req.headers["content-length"] && !req.headers["transfer-encoding"]);
    const raw = empty ? {} : await readJsonBody(req);
    return processPending(processPendingRequest.parse(raw ?? {}));
  },
});

export const registerPipelineRoutes = (app: Server) => {
  app.use(PIPELINE_STATUS, handlePipelineStatus);
  app.use(AUTOMATION_SETTINGS, handleSettings);
  app.use(AUTOMATION_INBOX, handleInbox);
  app.use(AUTOMATION_PROCESS_PENDING, handleProcessPending);
};

// Called once by startServer: starts the inbox watcher when enabled.
export const startAutomation = () => {
  const settings = applyInboxSettings();
  if (!settings.enabled) {
    console.log(
      `Inbox folder is off (enable it with PUT ${AUTOMATION_SETTINGS} {"enabled": true}, suggested folder ${settings.suggestedInboxDir})`,
    );
  }
};
