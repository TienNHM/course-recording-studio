// The automatic pipeline: starting post-production / render jobs and chaining
//   take selected (recorder, import, inbox) ──autoProcess──▶ post-production
//   post-production COMPLETED ──autoPublish──▶ render ──▶ PUBLISHED
// Every production/render job (manual or automatic) is started through
// startProductionJob / startRenderJob so the chain and the lesson status
// updates happen in one place. All jobs share the single job queue.
import type { JobState, Lesson, LessonStatus } from "../../../config/course";
import { readLesson, updateLesson } from "../course-store";
import { HttpError } from "../http-json";
import {
  enqueueJob,
  getActiveJob,
  readJobState,
  reconcileJobState,
} from "../production/job-queue";
import { readEditPlan } from "../production/take-files";
import { logActivity } from "./activity-log";
import type { PipelineStatus, PipelineTrigger } from "./decisions";
import {
  decideAfterJob,
  decideAutoProcess,
  describePipeline,
} from "./decisions";

const setLessonStatus = (lessonPath: string, status: LessonStatus) => {
  try {
    updateLesson(lessonPath, (l) => ({ ...l, status }));
  } catch (e) {
    console.error(`Could not set lesson status to ${status}`, e);
  }
};

// Lesson status after a job ends (or is found interrupted).
export const settleLessonStatus = (state: JobState) => {
  if (state.kind === "production") {
    setLessonStatus(
      state.lessonPath,
      state.status === "COMPLETED" ? "REVIEW" : "RECORDED",
    );
  } else if (state.status === "COMPLETED") {
    setLessonStatus(state.lessonPath, "PUBLISHED");
  }
};

const readLessonSafe = (lessonPath: string): Lesson | null => {
  try {
    return readLesson(lessonPath);
  } catch {
    return null;
  }
};

const hasEditPlan = (lessonPath: string) => {
  try {
    return readEditPlan(lessonPath) !== null;
  } catch {
    return false;
  }
};

// Per-job autoPublish overrides (e.g. the end-to-end workflow renders itself
// after accepting suggestions), keyed by job id.
const autoPublishOverrides = new Map<string, boolean>();

const QUEUED_STEP: Record<PipelineTrigger, string> = {
  "select-take": "Queued automatically after the take was saved",
  import: "Queued automatically after the recording was imported",
  inbox: "Queued automatically after importing from the inbox folder",
  "process-pending": "Queued by process-pending",
  "auto-publish": "Queued automatically after post-production (autoPublish)",
  manual: "Waiting for other jobs to finish",
};

const onJobSettled = (state: JobState) => {
  settleLessonStatus(state);
  const override = autoPublishOverrides.get(state.id);
  autoPublishOverrides.delete(state.id);

  const lesson = readLessonSafe(state.lessonPath);
  const decision = decideAfterJob({
    state,
    lesson,
    hasEditPlan: hasEditPlan(state.lessonPath),
    autoPublishOverride: override,
  });
  if (!decision.start) {
    if (state.status !== "COMPLETED" || state.kind === "render") {
      logActivity({
        type: "pipeline",
        level: state.status === "FAILED" ? "error" : "info",
        lessonPath: state.lessonPath,
        jobId: state.id,
        message: `${state.kind === "production" ? "Post-production" : "Render"} ${state.status.toLowerCase()}${state.error ? `: ${state.error}` : ""}`,
      });
    }
    return;
  }
  try {
    const render = startRenderJob({
      lessonPath: state.lessonPath,
      trigger: "auto-publish",
    });
    logActivity({
      type: "auto-render",
      lessonPath: state.lessonPath,
      jobId: render.id,
      message: "Post-production completed; render queued (autoPublish)",
    });
  } catch (e) {
    logActivity({
      type: "auto-render",
      level: "error",
      lessonPath: state.lessonPath,
      message: `Could not queue the render: ${(e as Error).message}`,
    });
  }
};

export const startProductionJob = ({
  lessonPath,
  retranscribe = false,
  autoPublish,
  trigger = "manual",
}: {
  lessonPath: string;
  retranscribe?: boolean;
  // Overrides lesson.postProduction.autoPublish for this job only.
  autoPublish?: boolean;
  trigger?: PipelineTrigger;
}): JobState => {
  const lesson = readLesson(lessonPath);
  if (!lesson.selectedTake) {
    throw new HttpError(400, "The lesson has no selected take");
  }
  if (getActiveJob(lessonPath)) {
    throw new HttpError(
      409,
      "A job is already queued or running for this lesson",
    );
  }
  const state = enqueueJob({
    kind: "production",
    lessonPath,
    takeId: lesson.selectedTake,
    step: QUEUED_STEP[trigger],
    // Loaded lazily: whisper/ffmpeg code is only needed when a job runs.
    run: async (ctx) => {
      const { runProduction } = await import("../production/run-production");
      await runProduction({ lessonPath, retranscribe, ctx });
    },
    onSettled: onJobSettled,
  });
  if (autoPublish !== undefined) {
    autoPublishOverrides.set(state.id, autoPublish);
  }
  setLessonStatus(lessonPath, "PROCESSING");
  return state;
};

export const startRenderJob = ({
  lessonPath,
  trigger = "manual",
}: {
  lessonPath: string;
  trigger?: PipelineTrigger;
}): JobState => {
  const plan = readEditPlan(lessonPath);
  if (!plan) {
    throw new HttpError(400, "No edit plan yet. Run post-production first.");
  }
  if (getActiveJob(lessonPath)) {
    throw new HttpError(
      409,
      "A job is already queued or running for this lesson",
    );
  }
  return enqueueJob({
    kind: "render",
    lessonPath,
    takeId: plan.takeId,
    step: QUEUED_STEP[trigger],
    // Loaded lazily: the Remotion bundler/renderer is heavy.
    run: async (ctx) => {
      const { runRender } = await import("../render/render-lesson");
      await runRender({ lessonPath, ctx });
    },
    onSettled: onJobSettled,
  });
};

export type AutoProcessResult = {
  productionJob: JobState | null;
  // Why nothing was started (null when a job was started).
  reason: string | null;
};

// Called after a take was selected or imported. Never throws: the take is
// saved either way, automation is a bonus.
export const maybeAutoProcess = ({
  lessonPath,
  trigger,
  override,
}: {
  lessonPath: string;
  trigger: PipelineTrigger;
  override?: boolean;
}): AutoProcessResult => {
  const lesson = readLessonSafe(lessonPath);
  if (!lesson) {
    return { productionJob: null, reason: "The lesson could not be read" };
  }
  const decision = decideAutoProcess({
    lesson,
    hasActiveJob: getActiveJob(lessonPath) !== null,
    override,
  });
  if (!decision.start) {
    return { productionJob: null, reason: decision.reason };
  }
  try {
    const job = startProductionJob({ lessonPath, trigger });
    logActivity({
      type: "auto-production",
      lessonPath,
      jobId: job.id,
      message: `Post-production queued automatically (${trigger})`,
    });
    return { productionJob: job, reason: null };
  } catch (e) {
    logActivity({
      type: "auto-production",
      level: "error",
      lessonPath,
      message: `Could not start post-production: ${(e as Error).message}`,
    });
    return { productionJob: null, reason: (e as Error).message };
  }
};

// Current job (active, or the last one from job.json) and what runs next.
export const getPipelineStatus = (lessonPath: string): PipelineStatus => {
  const active = getActiveJob(lessonPath);
  const job =
    active ??
    reconcileJobState(lessonPath, settleLessonStatus) ??
    readJobState(lessonPath);
  const lesson = readLesson(lessonPath);
  return describePipeline({
    lessonPath,
    lesson,
    job,
    autoPublishOverride: active
      ? autoPublishOverrides.get(active.id)
      : undefined,
  });
};
