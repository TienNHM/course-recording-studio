// The "one call" automation: (create lesson) → (import recording) →
// post-production → (accept suggestions) → (render) → published files.
// Shared by the MCP tool `process_lesson_end_to_end` and `studio process`.
import type { EditPlan, JobState, Marker } from "../config/course";
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

  // 2. Import
  if (input.displayPath) {
    result.stage = "import";
    await hooks.onStage?.("import", `Importing ${input.displayPath}`);
    const imported = await client.importRecording({
      lessonPath,
      displayPath: input.displayPath,
      webcamPath: input.webcamPath,
      markers: input.markers,
      takeId: input.takeId,
    });
    result.imported = imported.take;
  } else {
    const { lesson } = await client.getLesson(lessonPath);
    if (!lesson.selectedTake) {
      throw new Error(
        `Lesson ${lessonPath} has no recording yet. Pass displayPath to import a video file.`,
      );
    }
  }

  // 3. Post-production
  result.stage = "production";
  await hooks.onStage?.("production", "Starting post-production");
  const started = await client.startPostProduction(
    lessonPath,
    input.retranscribe ?? false,
  );
  const production = await client.waitForJob(lessonPath, started.id, {
    timeoutSec: remainingSec(),
    signal: hooks.signal,
    onProgress: (job) => hooks.onJob?.("production", job),
  });
  result.productionJob = production.job;
  if (production.timedOut) {
    result.timedOut = true;
    return result;
  }
  if (production.job?.status !== "COMPLETED") {
    result.error =
      production.job?.error ??
      `Post-production ended with ${production.job?.status}`;
    return result;
  }

  // 4. Edit plan
  result.stage = "edit-plan";
  let plan = await client.getEditPlan(lessonPath);
  if (input.acceptSuggestions && input.acceptSuggestions.length > 0) {
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
  if (input.render ?? true) {
    result.stage = "render";
    await hooks.onStage?.("render", "Rendering");
    const renderStarted = await client.startRender(lessonPath);
    const render = await client.waitForJob(lessonPath, renderStarted.id, {
      timeoutSec: remainingSec(),
      signal: hooks.signal,
      onProgress: (job) => hooks.onJob?.("render", job),
    });
    result.renderJob = render.job;
    if (render.timedOut) {
      result.timedOut = true;
      return result;
    }
    if (render.job?.status !== "COMPLETED") {
      result.error =
        render.job?.error ?? `Render ended with ${render.job?.status}`;
      return result;
    }
    result.published = await client.getPublishedFiles(lessonPath);
  }

  result.stage = "done";
  result.ok = true;
  await hooks.onStage?.("done", "Done");
  return result;
};
