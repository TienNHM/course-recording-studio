// The "one call" automation: (create lesson) → (import recording) →
// post-production → (accept suggestions) → (render) → published files.
// Shared by the MCP tool `process_lesson_end_to_end` and `studio process`.
//
// It drives the steps itself (import with autoProcess off, production with
// autoPublish off) so suggestions are accepted before rendering, but it
// respects the automation flags:
// - a job the app already started on its own (autoProcess after a recording,
//   the inbox folder, an autoPublish render) is waited for, not started twice;
// - `render` defaults to the lesson's postProduction.autoPublish.
import type { EditPlan, JobState, Marker } from "../config/course";
import { TERMINAL_JOB_STATUSES } from "../config/course";
import type { LessonPatch } from "../scripts/server/course-api";
import type { ImportRecordingResponse } from "../scripts/server/import-recording";
import type { EditPlanSummary } from "./edit-plan-tools";
import { summarizeEditPlan } from "./edit-plan-tools";
import type { PublishedFiles, StudioClient } from "./studio-client";

type CutReason = EditPlan["cuts"][number]["reason"];

export type ProcessLessonInput = {
  lessonPath?: string;
  course?: string;
  module?: string;
  lesson?: string;
  language?: "vi" | "en";
  displayPath?: string;
  webcamPath?: string;
  markers?: Marker[];
  takeId?: string;
  postProduction?: LessonPatch["postProduction"];
  retranscribe?: boolean;
  // Cut suggestions of these reasons are accepted before rendering.
  acceptSuggestions?: CutReason[];
  // Default: the lesson's postProduction.autoPublish.
  render?: boolean;
  timeoutSec?: number;
};

export type Stage =
  | "lesson"
  | "import"
  | "production"
  | "edit-plan"
  | "render"
  | "done";

export type ProcessLessonResult = {
  ok: boolean;
  stage: Stage;
  lessonPath: string;
  created: string[];
  imported: ImportRecordingResponse["take"] | null;
  productionJob: JobState | null;
  editPlan: EditPlanSummary | null;
  renderJob: JobState | null;
  published: PublishedFiles | null;
  timedOut: boolean;
  error: string | null;
};

export const processLesson = async (
  client: StudioClient,
  input: ProcessLessonInput,
  hooks: {
    signal?: AbortSignal;
    onStage?: (stage: Stage, message: string) => void | Promise<void>;
    onJob?: (stage: Stage, job: JobState) => void | Promise<void>;
  } = {},
): Promise<ProcessLessonResult> => {
  const deadline =
    input.timeoutSec !== undefined
      ? Date.now() + input.timeoutSec * 1000
      : null;
  const remainingSec = () =>
    deadline === null ? undefined : Math.max(0, (deadline - Date.now()) / 1000);

  // 1. Lesson
  let lessonPath = input.lessonPath;
  let created: string[] = [];
  if (!lessonPath) {
    if (!input.course || !input.module || !input.lesson) {
      throw new Error(
        "Pass lessonPath, or course + module + lesson (ids or titles)",
      );
    }
    const ref = await client.ensureLesson({
      course: input.course,
      module: input.module,
      lesson: input.lesson,
      language: input.language,
    });
    lessonPath = ref.lessonPath;
    created = ref.created;
  }
  await hooks.onStage?.("lesson", `Lesson ${lessonPath}`);

  const result: ProcessLessonResult = {
    ok: false,
    stage: "lesson",
    lessonPath,
    created,
    imported: null,
    productionJob: null,
    editPlan: null,
    renderJob: null,
    published: null,
    timedOut: false,
    error: null,
  };

  if (input.postProduction && Object.keys(input.postProduction).length > 0) {
    await client.updateLesson(lessonPath, {
      postProduction: input.postProduction,
    });
  }

  const isRunning = (job: JobState | null): job is JobState =>
    job !== null && !TERMINAL_JOB_STATUSES.includes(job.status);
  const running = await client.getJobStatus(lessonPath);

  // 2. Import
  if (input.displayPath) {
    if (isRunning(running)) {
      throw new Error(
        `Lesson ${lessonPath} has a ${running.kind} job ${running.status}; wait for it (get_job_status) or cancel it before importing`,
      );
    }
    result.stage = "import";
    await hooks.onStage?.("import", `Importing ${input.displayPath}`);
    const imported = await client.importRecording({
      lessonPath,
      displayPath: input.displayPath,
      webcamPath: input.webcamPath,
      markers: input.markers,
      takeId: input.takeId,
      // This workflow starts post-production itself.
      autoProcess: false,
    });
    result.imported = imported.take;
  } else if (!isRunning(running)) {
    const { lesson } = await client.getLesson(lessonPath);
    if (!lesson.selectedTake) {
      throw new Error(
        `Lesson ${lessonPath} has no recording yet. Pass displayPath to import a video file.`,
      );
    }
  }

  const { lesson } = await client.getLesson(lessonPath);
  const renderWanted = input.render ?? lesson.postProduction.autoPublish;
  const adopted = !input.displayPath && isRunning(running) ? running : null;

  const waitRender = async (renderJob: JobState) => {
    result.stage = "render";
    await hooks.onStage?.(
      "render",
      renderJob.id === adopted?.id
        ? "Waiting for the render the app already started"
        : "Rendering",
    );
    const render = await client.waitForJob(lessonPath, renderJob.id, {
      timeoutSec: remainingSec(),
      signal: hooks.signal,
      onProgress: (job) => hooks.onJob?.("render", job),
    });
    result.renderJob = render.job;
    if (render.timedOut) {
      result.timedOut = true;
      return false;
    }
    if (render.job?.status !== "COMPLETED") {
      result.error =
        render.job?.error ?? `Render ended with ${render.job?.status}`;
      return false;
    }
    result.published = await client.getPublishedFiles(lessonPath);
    return true;
  };

  const finish = async () => {
    result.stage = "done";
    result.ok = true;
    await hooks.onStage?.("done", "Done");
    return result;
  };

  // A render the app started on its own (autoPublish): just wait for it.
  if (adopted?.kind === "render") {
    return (await waitRender(adopted)) ? finish() : result;
  }

  // 3. Post-production
  result.stage = "production";
  await hooks.onStage?.(
    "production",
    adopted
      ? "Waiting for the post-production the app already started"
      : "Starting post-production",
  );
  const started =
    adopted ??
    (await client.startPostProduction(
      lessonPath,
      input.retranscribe ?? false,
      // The render (if any) is started below, after accepting suggestions.
      false,
    ));
  const production = await client.waitForJob(lessonPath, started.id, {
    timeoutSec: remainingSec(),
    signal: hooks.signal,
    onProgress: (job) => hooks.onJob?.("production", job),
  });
  if (production.timedOut) {
    result.productionJob = production.job;
    result.timedOut = true;
    return result;
  }
  // An adopted production job with autoPublish chains a render right away.
  const chainedRender =
    production.job?.kind === "render" && production.job.id !== started.id
      ? production.job
      : null;
  result.productionJob = chainedRender
    ? { ...started, status: "COMPLETED", progress: 1, step: "Done" }
    : production.job;
  if (!chainedRender && production.job?.status !== "COMPLETED") {
    result.error =
      production.job?.error ??
      `Post-production ended with ${production.job?.status}`;
    return result;
  }

  // 4. Edit plan
  result.stage = "edit-plan";
  let plan = await client.getEditPlan(lessonPath);
  if (
    !chainedRender &&
    input.acceptSuggestions &&
    input.acceptSuggestions.length > 0
  ) {
    await hooks.onStage?.(
      "edit-plan",
      `Accepting ${input.acceptSuggestions.join(", ")} suggestions`,
    );
    plan = await client.updateEditPlan(lessonPath, {
      acceptReasons: input.acceptSuggestions,
    });
  }
  result.editPlan = summarizeEditPlan(plan);

  // 5. Render
  if (chainedRender) {
    return (await waitRender(chainedRender)) ? finish() : result;
  }
  if (renderWanted) {
    const renderStarted = await client.startRender(lessonPath);
    if (!(await waitRender(renderStarted))) {
      return result;
    }
  }

  return finish();
};
