// Pure decisions of the automatic pipeline (unit-tested):
//   take selected / imported ──autoProcess──▶ post-production
//   post-production COMPLETED ──autoPublish──▶ render ──▶ PUBLISHED
import type { JobState, Lesson, LessonStatus } from "../../../config/course";
import { isTerminalJobStatus } from "../../../config/course";

export type PipelineTrigger =
  | "select-take"
  | "import"
  | "inbox"
  | "process-pending"
  | "auto-publish"
  | "manual";

export type Decision = { start: true } | { start: false; reason: string };

// Should post-production start right after a take was selected/imported?
// `override` comes from the request (e.g. an import with autoProcess:false).
export const decideAutoProcess = ({
  lesson,
  hasActiveJob,
  override,
}: {
  lesson: Lesson;
  hasActiveJob: boolean;
  override?: boolean;
}): Decision => {
  if (override === false) {
    return {
      start: false,
      reason: "Automatic processing was turned off for this request",
    };
  }
  if (!lesson.selectedTake) {
    return { start: false, reason: "The lesson has no selected take" };
  }
  if (lesson.status === "ARCHIVED") {
    return { start: false, reason: "The lesson is archived" };
  }
  if (hasActiveJob) {
    return {
      start: false,
      reason: "A job is already queued or running for this lesson",
    };
  }
  if (!(override ?? lesson.postProduction.autoProcess)) {
    return { start: false, reason: "autoProcess is off for this lesson" };
  }
  return { start: true };
};

// Should a render be queued after a job settled? Only after a COMPLETED
// production job, never after FAILED / CANCELLED or after a render.
export const decideAfterJob = ({
  state,
  lesson,
  hasEditPlan,
  autoPublishOverride,
}: {
  state: Pick<JobState, "kind" | "status">;
  lesson: Lesson | null;
  hasEditPlan: boolean;
  autoPublishOverride?: boolean;
}): Decision => {
  if (state.kind !== "production") {
    return { start: false, reason: `Render ${state.status.toLowerCase()}` };
  }
  if (state.status !== "COMPLETED") {
    return {
      start: false,
      reason: `Post-production ${state.status.toLowerCase()}; nothing is rendered`,
    };
  }
  if (!lesson) {
    return { start: false, reason: "The lesson could not be read" };
  }
  if (lesson.status === "ARCHIVED") {
    return { start: false, reason: "The lesson is archived" };
  }
  if (!(autoPublishOverride ?? lesson.postProduction.autoPublish)) {
    return { start: false, reason: "autoPublish is off; waiting for review" };
  }
  if (!hasEditPlan) {
    return { start: false, reason: "No edit plan was written" };
  }
  return { start: true };
};

export type PipelineStep = "record" | "production" | "review" | "render";

export type PipelineStatus = {
  lessonPath: string;
  lessonStatus: LessonStatus;
  autoProcess: boolean;
  autoPublish: boolean;
  // The job that is queued/running, or the latest finished one.
  job: JobState | null;
  running: boolean;
  // What happens next (null = nothing, the lesson is published or archived).
  next: PipelineStep | null;
  // Whether `next` starts by itself (true) or needs a person / a call.
  nextIsAutomatic: boolean;
  message: string;
};

export const describePipeline = ({
  lessonPath,
  lesson,
  job,
  autoPublishOverride,
}: {
  lessonPath: string;
  lesson: Lesson;
  job: JobState | null;
  autoPublishOverride?: boolean;
}): PipelineStatus => {
  const { autoProcess } = lesson.postProduction;
  const autoPublish = autoPublishOverride ?? lesson.postProduction.autoPublish;
  const running = job !== null && !isTerminalJobStatus(job.status);
  const base = {
    lessonPath,
    lessonStatus: lesson.status,
    autoProcess,
    autoPublish,
    job,
    running,
  };

  if (running && job) {
    if (job.kind === "production") {
      return autoPublish
        ? {
            ...base,
            next: "render",
            nextIsAutomatic: true,
            message: `Post-production ${job.status}; the lesson is rendered and published automatically afterwards`,
          }
        : {
            ...base,
            next: "review",
            nextIsAutomatic: false,
            message: `Post-production ${job.status}; the edit plan then waits for review`,
          };
    }
    return {
      ...base,
      next: null,
      nextIsAutomatic: true,
      message: `Rendering (${job.status}); the lesson is PUBLISHED when it completes`,
    };
  }

  const lastFailed =
    job && (job.status === "FAILED" || job.status === "CANCELLED")
      ? ` The last ${job.kind} job ${job.status.toLowerCase()}${job.error ? `: ${job.error}` : ""}.`
      : "";

  switch (lesson.status) {
    case "DRAFT":
    case "READY_TO_RECORD":
      return {
        ...base,
        next: "record",
        nextIsAutomatic: false,
        message: autoProcess
          ? "Waiting for a recording; post-production starts automatically when a take is saved"
          : "Waiting for a recording",
      };
    case "RECORDED":
    case "PROCESSING":
      return {
        ...base,
        next: "production",
        nextIsAutomatic: false,
        message: `Recorded; start post-production (or POST /api/automation/process-pending).${lastFailed}`,
      };
    case "REVIEW":
      return autoPublish
        ? {
            ...base,
            next: "render",
            nextIsAutomatic: false,
            message: `Ready to render (autoPublish is on; render it or run process-pending).${lastFailed}`,
          }
        : {
            ...base,
            next: "review",
            nextIsAutomatic: false,
            message: `Waiting for review of the edit plan, then render.${lastFailed}`,
          };
    case "PUBLISHED":
      return {
        ...base,
        next: null,
        nextIsAutomatic: false,
        message: "Published",
      };
    default:
      return {
        ...base,
        next: null,
        nextIsAutomatic: false,
        message: "Archived",
      };
  }
};

// Which lessons POST /api/automation/process-pending picks up.
export const pendingAction = ({
  lesson,
  hasActiveJob,
  hasEditPlan,
}: {
  lesson: Lesson;
  hasActiveJob: boolean;
  hasEditPlan: boolean;
}): { action: "production" | "render" } | { action: null; reason: string } => {
  if (hasActiveJob) {
    return { action: null, reason: "A job is already queued or running" };
  }
  if (lesson.status === "RECORDED") {
    return lesson.selectedTake
      ? { action: "production" }
      : { action: null, reason: "No selected take" };
  }
  if (lesson.status === "REVIEW") {
    if (!lesson.postProduction.autoPublish) {
      return { action: null, reason: "autoPublish is off; waiting for review" };
    }
    return hasEditPlan
      ? { action: "render" }
      : { action: null, reason: "No edit plan" };
  }
  return { action: null, reason: `Status ${lesson.status}` };
};
