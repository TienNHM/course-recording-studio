// HTTP client for the running Course Recording Studio app, shared by the MCP
// server (mcp/) and the CLI (scripts/cli/). It only talks HTTP, so it works
// with any running instance (COURSE_STUDIO_URL, default http://localhost:4000).
import type { Caption } from "@remotion/captions";
import type {
  Course,
  CourseModule,
  EditPlan,
  JobState,
  Lesson,
  Marker,
} from "../config/course";
import {
  TERMINAL_JOB_STATUSES,
  lessonPath as toLessonPath,
} from "../config/course";
import { SERVER_PORT } from "../config/server";
import {
  AUTOMATION_INBOX,
  AUTOMATION_PROCESS_PENDING,
  AUTOMATION_SETTINGS,
  CAPTIONS_API,
  COURSES_API,
  EDIT_PLAN_API,
  HEALTH,
  IMPORT_RECORDING,
  LESSON_API,
  PRODUCTION_CANCEL,
  PRODUCTION_START,
  PIPELINE_STATUS,
  PRODUCTION_STATUS,
  PUBLISHED_FILES,
  RENDER_LESSON,
} from "../scripts/server/constants";
import type {
  CoursePatch,
  CourseTree,
  LessonPatch,
} from "../scripts/server/course-api";
import { matchByTitle } from "../scripts/server/course-match";
import type {
  ImportRecordingResponse,
  PublishedFile,
} from "../scripts/server/import-recording";
import type { ActivityEvent } from "../scripts/server/automation/activity-log";
import type { PipelineStatus } from "../scripts/server/automation/decisions";
import type { InboxStatus } from "../scripts/server/automation/inbox-watcher";
import type {
  AutomationSettings,
  SettingsPatch,
} from "../scripts/server/automation/settings";
import { summarizeEditPlan, type EditPlanSummary } from "./edit-plan-tools";
import { buildTranscript, type Transcript } from "./transcript";

export { matchByTitle };

export const DEFAULT_STUDIO_URL = `http://localhost:${SERVER_PORT}`;

export const studioUrl = (
  env: Record<string, string | undefined> = process.env,
) => (env.COURSE_STUDIO_URL || DEFAULT_STUDIO_URL).replace(/\/+$/, "");

export class StudioUnavailableError extends Error {
  constructor(baseUrl: string, cause: string) {
    super(
      `Course Recording Studio is not reachable at ${baseUrl} (${cause}). ` +
        `Start it with \`npm run dev\` (or \`bun studio.ts\`) in the course-recording-studio folder, ` +
        `or set COURSE_STUDIO_URL to the URL where it runs (e.g. http://localhost:4000).`,
    );
    this.name = "StudioUnavailableError";
  }
}

export class StudioApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StudioApiError";
  }
}

export type Health = {
  ok: boolean;
  app: string;
  version: string;
  port: number;
  publicDir: string;
};

export type LessonRef = {
  course: Course;
  module: CourseModule;
  lesson: Lesson;
  lessonPath: string;
};

export type ImportRecordingInput = {
  lessonPath: string;
  displayPath: string;
  webcamPath?: string;
  markers?: Marker[];
  takeId?: string;
  // Overrides the lesson's autoProcess for this import.
  autoProcess?: boolean;
};

export type AutomationSettingsResponse = AutomationSettings & {
  watcher: InboxStatus;
};

export type InboxActivity = {
  settings: AutomationSettings;
  watcher: InboxStatus;
  events: ActivityEvent[];
};

export type ProcessPendingInput = {
  courseId?: string;
  lessonPaths?: string[];
  dryRun?: boolean;
};

export type ProcessPendingResult = {
  dryRun: boolean;
  production: { lessonPath: string; jobId: string | null }[];
  render: { lessonPath: string; jobId: string | null }[];
  skipped: { lessonPath: string; reason: string }[];
};

export type EditPlanUpdate = {
  acceptCuts?: number[];
  rejectCuts?: number[];
  acceptReasons?: EditPlan["cuts"][number]["reason"][];
  rejectReasons?: EditPlan["cuts"][number]["reason"][];
  chapters?: EditPlan["chapters"];
  layout?: EditPlan["layout"];
  intro?: EditPlan["intro"];
  outro?: boolean;
};

export type WaitOptions = {
  // Give up waiting (the job keeps running) after this many seconds.
  timeoutSec?: number;
  pollMs?: number;
  signal?: AbortSignal;
  onProgress?: (job: JobState) => void | Promise<void>;
};

export type WaitResult = { job: JobState | null; timedOut: boolean };

export type PublishedFiles = {
  lessonPath: string;
  dir: string;
  files: (PublishedFile & { url: string })[];
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Cancelled"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Cancelled"));
      },
      { once: true },
    );
  });

const withQuery = (route: string, lessonPath: string) =>
  `${route}?lessonPath=${encodeURIComponent(lessonPath)}`;

// Turns the friendly edit-plan update into the server's index-based patch.
export const toEditPlanPatch = (plan: EditPlan, update: EditPlanUpdate) => {
  const decisions = new Map<number, boolean>();
  plan.cuts.forEach((cut, index) => {
    if (update.acceptReasons?.includes(cut.reason)) {
      decisions.set(index, true);
    }
    if (update.rejectReasons?.includes(cut.reason)) {
      decisions.set(index, false);
    }
  });
  for (const index of update.acceptCuts ?? []) {
    decisions.set(index, true);
  }
  for (const index of update.rejectCuts ?? []) {
    decisions.set(index, false);
  }
  for (const index of decisions.keys()) {
    if (!plan.cuts[index]) {
      throw new Error(
        `No cut with index ${index} (the plan has ${plan.cuts.length} cuts)`,
      );
    }
  }
  const cuts = [...decisions.entries()]
    .filter(([index, accepted]) => plan.cuts[index]?.accepted !== accepted)
    .map(([index, accepted]) => ({ index, accepted }));
  return {
    ...(cuts.length > 0 ? { cuts } : {}),
    ...(update.chapters !== undefined ? { chapters: update.chapters } : {}),
    ...(update.layout !== undefined ? { layout: update.layout } : {}),
    ...(update.intro !== undefined ? { intro: update.intro } : {}),
    ...(update.outro !== undefined ? { outro: update.outro } : {}),
  };
};

export class StudioClient {
  readonly baseUrl: string;

  constructor(baseUrl: string = studioUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T>(route: string, method = "GET", body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${route}`, {
        method,
        headers:
          body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new StudioUnavailableError(this.baseUrl, (e as Error).message);
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // The dev server answers unknown routes with index.html.
      throw new StudioApiError(
        res.status,
        `${method} ${route} did not return JSON (status ${res.status}). ` +
          `Is ${this.baseUrl} really Course Recording Studio, and is it up to date?`,
      );
    }
    if (!res.ok) {
      const message =
        (json as { error?: string } | null)?.error ??
        `Request failed with status ${res.status}`;
      throw new StudioApiError(res.status, `${method} ${route}: ${message}`);
    }
    return json as T;
  }

  health() {
    return this.request<Health>(HEALTH);
  }

  // ---- Courses ------------------------------------------------------------

  getCourseTree() {
    return this.request<CourseTree>(COURSES_API);
  }

  async listCourses() {
    const tree = await this.getCourseTree();
    return tree.map(({ course, modules }) => ({
      id: course.id,
      name: course.name,
      language: course.language,
      outputProfile: course.outputProfile,
      modules: modules.length,
      lessons: modules.reduce((n, m) => n + m.lessons.length, 0),
    }));
  }

  createCourse(body: {
    name: string;
    description?: string;
    language?: "vi" | "en";
  }) {
    return this.request<Course>(COURSES_API, "POST", {
      kind: "course",
      ...body,
    });
  }

  createModule(courseId: string, title: string) {
    return this.request<CourseModule>(COURSES_API, "POST", {
      kind: "module",
      courseId,
      title,
    });
  }

  createLesson(
    courseId: string,
    moduleId: string,
    title: string,
    fields: Omit<LessonPatch, "title" | "status"> = {},
  ) {
    return this.request<Lesson>(COURSES_API, "POST", {
      kind: "lesson",
      courseId,
      moduleId,
      title,
      ...fields,
    });
  }

  updateCourse(courseId: string, patch: CoursePatch) {
    return this.request<Course>(COURSES_API, "PATCH", {
      kind: "course",
      courseId,
      patch,
    });
  }

  updateLesson(lessonPath: string, patch: LessonPatch) {
    return this.request<Lesson>(LESSON_API, "PATCH", { lessonPath, patch });
  }

  async getLesson(lessonPath: string): Promise<LessonRef> {
    const tree = await this.getCourseTree();
    for (const { course, modules } of tree) {
      for (const { module, lessons } of modules) {
        const lesson = lessons.find((l) => toLessonPath(l) === lessonPath);
        if (lesson) {
          return { course, module, lesson, lessonPath };
        }
      }
    }
    throw new StudioApiError(404, `Lesson ${lessonPath} does not exist`);
  }

  // Finds course/module/lesson by id or title and creates what is missing.
  async ensureLesson(input: {
    course: string;
    module: string;
    lesson: string;
    language?: "vi" | "en";
  }): Promise<LessonRef & { created: ("course" | "module" | "lesson")[] }> {
    const created: ("course" | "module" | "lesson")[] = [];
    const tree = await this.getCourseTree();
    const courseEntry = matchByTitle(
      tree,
      input.course,
      (c) => c.course.id,
      (c) => c.course.name,
    );
    let course = courseEntry?.course;
    if (!course) {
      course = await this.createCourse({
        name: input.course,
        language: input.language,
      });
      created.push("course");
    }
    const moduleEntry = matchByTitle(
      courseEntry?.modules ?? [],
      input.module,
      (m) => m.module.id,
      (m) => m.module.title,
    );
    let module = moduleEntry?.module;
    if (!module) {
      module = await this.createModule(course.id, input.module);
      created.push("module");
    }
    let lesson = matchByTitle(
      moduleEntry?.lessons ?? [],
      input.lesson,
      (l) => l.id,
      (l) => l.title,
    );
    if (!lesson) {
      lesson = await this.createLesson(course.id, module.id, input.lesson);
      created.push("lesson");
    }
    return {
      course,
      module,
      lesson,
      lessonPath: toLessonPath(lesson),
      created,
    };
  }

  // ---- Recording import -----------------------------------------------------

  importRecording(input: ImportRecordingInput) {
    return this.request<ImportRecordingResponse>(
      IMPORT_RECORDING,
      "POST",
      input,
    );
  }

  // ---- Jobs -------------------------------------------------------------------

  // autoPublish overrides the lesson setting for this job (render right
  // after post-production or not); undefined = the lesson's setting.
  startPostProduction(
    lessonPath: string,
    retranscribe = false,
    autoPublish?: boolean,
  ) {
    return this.request<JobState>(PRODUCTION_START, "POST", {
      lessonPath,
      retranscribe,
      ...(autoPublish !== undefined ? { autoPublish } : {}),
    });
  }

  startRender(lessonPath: string) {
    return this.request<JobState>(RENDER_LESSON, "POST", { lessonPath });
  }

  getJobStatus(lessonPath: string) {
    return this.request<JobState | null>(
      withQuery(PRODUCTION_STATUS, lessonPath),
    );
  }

  cancelJob(lessonPath: string) {
    return this.request<{ cancelled: boolean }>(PRODUCTION_CANCEL, "POST", {
      lessonPath,
    });
  }

  // Polls until the lesson's job reaches COMPLETED / FAILED / CANCELLED.
  async waitForJob(
    lessonPath: string,
    jobId: string | null,
    options: WaitOptions = {},
  ): Promise<WaitResult> {
    const pollMs = options.pollMs ?? 1500;
    const deadline =
      options.timeoutSec !== undefined
        ? Date.now() + options.timeoutSec * 1000
        : null;
    let last: JobState | null = null;
    for (;;) {
      const job = await this.getJobStatus(lessonPath);
      if (job && jobId !== null && job.id !== jobId) {
        // Another job replaced ours; report it rather than waiting forever.
        return { job, timedOut: false };
      }
      if (
        job &&
        (!last ||
          job.progress !== last.progress ||
          job.step !== last.step ||
          job.status !== last.status)
      ) {
        await options.onProgress?.(job);
      }
      last = job;
      if (!job || TERMINAL_JOB_STATUSES.includes(job.status)) {
        return { job, timedOut: false };
      }
      if (deadline !== null && Date.now() >= deadline) {
        return { job, timedOut: true };
      }
      await sleep(
        deadline !== null
          ? Math.min(pollMs, Math.max(0, deadline - Date.now()))
          : pollMs,
        options.signal,
      );
    }
  }

  // ---- Automation -------------------------------------------------------

  getPipelineStatus(lessonPath: string) {
    return this.request<PipelineStatus>(withQuery(PIPELINE_STATUS, lessonPath));
  }

  getAutomationSettings() {
    return this.request<AutomationSettingsResponse>(AUTOMATION_SETTINGS);
  }

  updateAutomationSettings(patch: SettingsPatch) {
    return this.request<AutomationSettingsResponse>(
      AUTOMATION_SETTINGS,
      "PUT",
      patch,
    );
  }

  getInboxActivity() {
    return this.request<InboxActivity>(AUTOMATION_INBOX);
  }

  processPending(input: ProcessPendingInput = {}) {
    return this.request<ProcessPendingResult>(
      AUTOMATION_PROCESS_PENDING,
      "POST",
      input,
    );
  }

  // ---- Edit plan ----------------------------------------------------------

  getEditPlan(lessonPath: string) {
    return this.request<EditPlan>(withQuery(EDIT_PLAN_API, lessonPath));
  }

  async getEditPlanWithSummary(
    lessonPath: string,
  ): Promise<{ plan: EditPlan; summary: EditPlanSummary }> {
    const plan = await this.getEditPlan(lessonPath);
    return { plan, summary: summarizeEditPlan(plan) };
  }

  async updateEditPlan(lessonPath: string, update: EditPlanUpdate) {
    const plan = await this.getEditPlan(lessonPath);
    const patch = toEditPlanPatch(plan, update);
    if (Object.keys(patch).length === 0) {
      return plan;
    }
    return this.request<EditPlan>(EDIT_PLAN_API, "PUT", {
      lessonPath,
      ...patch,
    });
  }

  // ---- Transcript ---------------------------------------------------------

  getCaptions(lessonPath: string) {
    return this.request<Caption[]>(withQuery(CAPTIONS_API, lessonPath));
  }

  async getTranscript(lessonPath: string): Promise<Transcript> {
    return buildTranscript(await this.getCaptions(lessonPath));
  }

  saveCaptions(lessonPath: string, captions: Caption[]) {
    return this.request<Caption[]>(CAPTIONS_API, "PUT", {
      lessonPath,
      captions,
    });
  }

  // ---- Published files ------------------------------------------------------

  async getPublishedFiles(lessonPath: string): Promise<PublishedFiles> {
    const result = await this.request<{
      lessonPath: string;
      dir: string;
      files: PublishedFile[];
    }>(withQuery(PUBLISHED_FILES, lessonPath));
    return {
      ...result,
      files: result.files.map((f) => ({
        ...f,
        url: `${this.baseUrl}${f.urlPath}`,
      })),
    };
  }
}
