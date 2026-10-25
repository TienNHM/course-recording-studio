// Pure helpers for the library: where a lesson is in the
// Record → Process → Review → Publish flow, which action comes next, and
// what the automatic pipeline does afterwards. Unit-tested in
// tests/library-flow.test.ts; keep free of React and browser APIs.
import type { JobState, Lesson, LessonStatus } from "../../config/course";
import { isTerminalJobStatus } from "../../config/course";

export const FLOW_STEPS = ["record", "process", "review", "publish"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export type StepState = "done" | "current" | "active" | "failed" | "upcoming";

export type LessonAction =
  | "record"
  | "process"
  | "review"
  | "export"
  | "open-published";

export type LessonFlow = {
  steps: { id: FlowStep; state: StepState }[];
  // The one highlighted action; null while a job runs or when archived.
  primary: LessonAction | null;
  // Other actions that make sense right now, in display order.
  secondary: LessonAction[];
  // Why there is no primary action.
  waiting: "job" | "archived" | null;
};

type FlowInput = {
  lesson: Pick<Lesson, "status" | "selectedTake"> & {
    postProduction: Pick<Lesson["postProduction"], "autoPublish">;
  };
  job: Pick<JobState, "kind" | "status"> | null;
};

const isRunning = (job: FlowInput["job"]) =>
  job !== null && !isTerminalJobStatus(job.status);

const failed = (job: FlowInput["job"], kind: JobState["kind"]) =>
  job !== null &&
  job.kind === kind &&
  (job.status === "FAILED" || job.status === "CANCELLED");

// Index of the step the lesson is at (0..3), 4 = everything done.
const stepIndexForStatus = (status: LessonStatus): number => {
  switch (status) {
    case "DRAFT":
    case "READY_TO_RECORD":
      return 0;
    case "RECORDED":
    case "PROCESSING":
      return 1;
    case "REVIEW":
      return 2;
    case "PUBLISHED":
      return 4;
    default:
      return -1;
  }
};

const buildSteps = (
  index: number,
  state: StepState,
): LessonFlow["steps"] =>
  FLOW_STEPS.map((id, i) => ({
    id,
    state: i < index ? "done" : i === index ? state : "upcoming",
  }));

export const deriveLessonFlow = ({ lesson, job }: FlowInput): LessonFlow => {
  const hasTake = lesson.selectedTake !== null;

  if (isRunning(job) && job) {
    const index = job.kind === "render" ? 3 : 1;
    return {
      steps: buildSteps(index, "active"),
      primary: null,
      secondary: [],
      waiting: "job",
    };
  }

  if (lesson.status === "ARCHIVED") {
    return {
      steps: FLOW_STEPS.map((id) => ({ id, state: "upcoming" })),
      primary: null,
      secondary: [],
      waiting: "archived",
    };
  }

  let index = stepIndexForStatus(lesson.status);
  // A RECORDED lesson without a take cannot be processed: record first.
  if (index === 1 && !hasTake) {
    index = 0;
  }

  if (index === 0) {
    return {
      steps: buildSteps(0, "current"),
      primary: "record",
      secondary: hasTake ? ["process"] : [],
      waiting: null,
    };
  }

  if (index === 1) {
    return {
      steps: buildSteps(1, failed(job, "production") ? "failed" : "current"),
      primary: "process",
      secondary: ["record"],
      waiting: null,
    };
  }

  if (index === 2) {
    const renderFailed = failed(job, "render");
    // With autoPublish on, review is optional: exporting is the next step.
    if (lesson.postProduction.autoPublish || renderFailed) {
      return {
        steps: buildSteps(3, renderFailed ? "failed" : "current"),
        primary: "export",
        secondary: ["review", "process", "record"],
        waiting: null,
      };
    }
    return {
      steps: buildSteps(2, "current"),
      primary: "review",
      secondary: ["export", "process", "record"],
      waiting: null,
    };
  }

  // PUBLISHED
  return {
    steps: buildSteps(4, "done"),
    primary: "open-published",
    secondary: ["review", "export", "process", "record"],
    waiting: null,
  };
};

// What happens next, as a message key of the "library" namespace
// (next.*) plus whether it starts by itself.
export type NextKey =
  | "waitingRecordAuto"
  | "waitingRecord"
  | "processingThenPublish"
  | "processingThenReview"
  | "rendering"
  | "recorded"
  | "reviewAutoPublish"
  | "review"
  | "published"
  | "archived";

export type NextInfo = {
  key: NextKey;
  // true: starts by itself · false: needs the user · null: nothing next.
  automatic: boolean | null;
  // Error of the last failed/cancelled job, when relevant.
  lastError: string | null;
};

export const describeNext = ({
  lessonStatus,
  autoProcess,
  autoPublish,
  job,
}: {
  lessonStatus: LessonStatus;
  autoProcess: boolean;
  autoPublish: boolean;
  job: Pick<JobState, "kind" | "status" | "error"> | null;
}): NextInfo => {
  const lastError =
    job && (job.status === "FAILED" || job.status === "CANCELLED")
      ? (job.error ?? job.status)
      : null;

  if (job && !isTerminalJobStatus(job.status)) {
    if (job.kind === "render") {
      return { key: "rendering", automatic: true, lastError: null };
    }
    return autoPublish
      ? { key: "processingThenPublish", automatic: true, lastError: null }
      : { key: "processingThenReview", automatic: false, lastError: null };
  }

  switch (lessonStatus) {
    case "DRAFT":
    case "READY_TO_RECORD":
      return autoProcess
        ? { key: "waitingRecordAuto", automatic: false, lastError: null }
        : { key: "waitingRecord", automatic: false, lastError: null };
    case "RECORDED":
    case "PROCESSING":
      return { key: "recorded", automatic: false, lastError };
    case "REVIEW":
      return autoPublish
        ? { key: "reviewAutoPublish", automatic: false, lastError }
        : { key: "review", automatic: false, lastError };
    case "PUBLISHED":
      return { key: "published", automatic: null, lastError: null };
    default:
      return { key: "archived", automatic: null, lastError: null };
  }
};

// --- Form validation -----------------------------------------------------

export const TITLE_MAX_LENGTH = 120;

export type TitleError = "required" | "tooLong" | null;

export const validateTitle = (
  title: string,
  max = TITLE_MAX_LENGTH,
): TitleError => {
  const trimmed = title.trim();
  if (trimmed === "") {
    return "required";
  }
  return trimmed.length > max ? "tooLong" : null;
};

const normalize = (s: string) => s.trim().toLocaleLowerCase();

// Indices of entries that repeat an earlier entry (case-insensitive, trimmed;
// blank entries are ignored).
export const duplicateIndices = (values: readonly string[]): number[] => {
  const seen = new Set<string>();
  const result: number[] = [];
  values.forEach((value, i) => {
    const key = normalize(value);
    if (key === "") {
      return;
    }
    if (seen.has(key)) {
      result.push(i);
    }
    seen.add(key);
  });
  return result;
};

export type LessonDraft = Pick<
  Lesson,
  | "title"
  | "description"
  | "objectives"
  | "notes"
  | "recordingProfile"
  | "postProduction"
>;

export type LessonDraftErrors = {
  title: TitleError;
  duplicateObjectives: number[];
};

export const validateLessonDraft = (draft: LessonDraft): LessonDraftErrors => ({
  title: validateTitle(draft.title),
  duplicateObjectives: duplicateIndices(draft.objectives),
});

export const isDraftValid = (errors: LessonDraftErrors) =>
  errors.title === null && errors.duplicateObjectives.length === 0;

// The PATCH body for a draft. A DRAFT lesson becomes READY_TO_RECORD once it
// has been filled in (saved with a valid title).
export const lessonDraftToPatch = (
  draft: LessonDraft,
  currentStatus: LessonStatus,
) => ({
  title: draft.title.trim(),
  description: draft.description,
  objectives: draft.objectives.map((o) => o.trim()).filter(Boolean),
  notes: draft.notes,
  recordingProfile: draft.recordingProfile,
  postProduction: draft.postProduction,
  ...(currentStatus === "DRAFT" ? { status: "READY_TO_RECORD" as const } : {}),
});

// Comparable form of a draft: what would actually be saved.
export const draftSignature = (draft: LessonDraft) =>
  JSON.stringify(lessonDraftToPatch(draft, "READY_TO_RECORD"));

// --- Glossary --------------------------------------------------------------

export type GlossaryRow = { term: string; aliases: string };

export const glossaryToRows = (
  glossary: readonly { term: string; aliases: readonly string[] }[],
): GlossaryRow[] =>
  glossary.map((g) => ({ term: g.term, aliases: g.aliases.join(", ") }));

export const rowsToGlossary = (rows: readonly GlossaryRow[]) =>
  rows
    .filter((r) => r.term.trim())
    .map((r) => ({
      term: r.term.trim(),
      aliases: [
        ...new Set(
          r.aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        ),
      ],
    }));

// --- Inbox folder ----------------------------------------------------------

// Absolute on Windows (C:\…, \\server\share) or POSIX (/…).
export const isAbsolutePath = (value: string) =>
  /^[a-zA-Z]:[\\/]/.test(value) ||
  value.startsWith("\\\\") ||
  value.startsWith("/");
