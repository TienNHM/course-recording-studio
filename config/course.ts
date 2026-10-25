// Shared contracts for Course Recording Studio.
// Used by the recorder UI (src/), the local server (scripts/server) and Remotion (remotion/).
// Keep this file free of Node-only and browser-only imports.
import { z } from "zod";

// All course data lives under public/courses so Remotion's staticFile() can read it.
export const COURSES_DIR = "courses";

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and dashes");

export const courseLanguage = z.enum(["vi", "en"]);
export type CourseLanguage = z.infer<typeof courseLanguage>;

export const lessonStatus = z.enum([
  "DRAFT",
  "READY_TO_RECORD",
  "RECORDED",
  "PROCESSING",
  "REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);
export type LessonStatus = z.infer<typeof lessonStatus>;

export const sessionStatus = z.enum([
  "PREPARING",
  "RECORDING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "RECOVERABLE",
]);
export type SessionStatus = z.infer<typeof sessionStatus>;

export const jobStatus = z.enum([
  "QUEUED",
  "ANALYZING",
  "TRANSCRIBING",
  "EDITING",
  "RENDERING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type JobStatus = z.infer<typeof jobStatus>;

export const jobKind = z.enum(["production", "render"]);
export type JobKind = z.infer<typeof jobKind>;

// production/job.json — state of the latest production or render job of a lesson.
export const jobState = z.object({
  id: z.string(),
  kind: jobKind,
  lessonPath: z.string(),
  takeId: z.string().nullable(),
  // QUEUED → ANALYZING → TRANSCRIBING → EDITING → COMPLETED (production)
  // QUEUED → RENDERING → COMPLETED (render); or FAILED / CANCELLED.
  status: jobStatus,
  // Human-readable description of what is happening right now.
  step: z.string(),
  // Overall progress of the job, 0..1.
  progress: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type JobState = z.infer<typeof jobState>;

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export const isTerminalJobStatus = (status: JobStatus) =>
  TERMINAL_JOB_STATUSES.includes(status);

export const glossaryTerm = z.object({
  term: z.string(),
  aliases: z.array(z.string()).default([]),
});

export const outputProfile = z.enum(["course-standard", "course-hq"]);
export type OutputProfile = z.infer<typeof outputProfile>;

export const OUTPUT_PROFILES: Record<
  OutputProfile,
  { width: number; height: number; fps: 30 | 60 }
> = {
  "course-standard": { width: 1920, height: 1080, fps: 30 },
  "course-hq": { width: 1920, height: 1080, fps: 60 },
};

// Look of the rendered video. Palette ids match the app's UI palettes.
export const videoPalette = z.enum([
  "dotnet",
  "recorder",
  "ocean",
  "emerald",
  "slate",
]);
export type VideoPalette = z.infer<typeof videoPalette>;

export const videoStyle = z.object({
  palette: videoPalette.default("dotnet"),
  intro: z.enum(["minimal", "gradient", "starburst"]).default("gradient"),
  transition: z.enum(["none", "fade", "slide", "light-leak"]).default("fade"),
  // Compact chapter card overlaid on the video when a chapter starts.
  chapterCards: z.boolean().default(true),
  // Course/lesson name in a lower third at the start of the lesson.
  lowerThird: z.boolean().default(true),
  backgroundMusic: z.boolean().default(false),
  // Thin progress bar with chapter ticks along the bottom edge.
  progressBar: z.boolean().default(true),
});
export type VideoStyle = z.infer<typeof videoStyle>;

export const DEFAULT_VIDEO_STYLE: VideoStyle = videoStyle.parse({});

export const course = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().default(""),
  language: courseLanguage.default("vi"),
  outputProfile: outputProfile.default("course-standard"),
  glossary: z.array(glossaryTerm).default([]),
  videoStyle: videoStyle.default(DEFAULT_VIDEO_STYLE),
  createdAt: z.string(),
});
export type Course = z.infer<typeof course>;

export const courseModule = z.object({
  id: slug,
  courseId: slug,
  title: z.string().min(1),
  order: z.number().int(),
});
export type CourseModule = z.infer<typeof courseModule>;

export const recordingProfile = z.object({
  webcam: z.boolean().default(false),
  microphone: z.boolean().default(true),
});
export type RecordingProfile = z.infer<typeof recordingProfile>;

export const silencePreset = z.enum(["conservative", "balanced", "aggressive"]);
export type SilencePreset = z.infer<typeof silencePreset>;

export const postProduction = z.object({
  autoTranscribe: z.boolean().default(true),
  autoDetectSilence: z.boolean().default(true),
  // Detected silence is only a suggestion unless this is on.
  autoRemoveSilence: z.boolean().default(false),
  silencePreset: silencePreset.default("conservative"),
  generateChapters: z.boolean().default(true),
  intro: z.boolean().default(true),
  outro: z.boolean().default(true),
  // Start post-production as soon as a take is saved.
  autoProcess: z.boolean().default(true),
  // Render and publish right after post-production, skipping review.
  autoPublish: z.boolean().default(false),
});
export type PostProduction = z.infer<typeof postProduction>;

export const lesson = z.object({
  id: slug,
  courseId: slug,
  moduleId: slug,
  title: z.string().min(1),
  description: z.string().default(""),
  objectives: z.array(z.string()).default([]),
  notes: z.string().default(""),
  order: z.number().int(),
  recordingProfile: recordingProfile.default({
    webcam: false,
    microphone: true,
  }),
  postProduction: postProduction.default({
    autoTranscribe: true,
    autoDetectSilence: true,
    autoRemoveSilence: false,
    silencePreset: "conservative",
    generateChapters: true,
    intro: true,
    outro: true,
    autoProcess: true,
    autoPublish: false,
  }),
  status: lessonStatus.default("DRAFT"),
  // Take id = the take's shared end timestamp (ms), as used by the recorder.
  selectedTake: z.string().nullable().default(null),
});
export type Lesson = z.infer<typeof lesson>;

export const markerType = z.enum(["cut", "important", "chapter"]);
export type MarkerType = z.infer<typeof markerType>;

export const marker = z.object({
  type: markerType,
  // Milliseconds from the start of the take, with paused time excluded,
  // so it lines up with the recorded media timeline.
  timeMs: z.number().nonnegative(),
  title: z.string().optional(),
});
export type Marker = z.infer<typeof marker>;

// recordings/<take>/session.json
export const recordingSession = z.object({
  takeId: z.string(),
  status: sessionStatus,
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  // Media duration (paused time excluded).
  durationMs: z.number().nullable(),
  sources: z.array(z.enum(["webcam", "display"])),
});
export type RecordingSession = z.infer<typeof recordingSession>;

// production/silence.json
export const silenceRange = z.object({
  startMs: z.number(),
  endMs: z.number(),
});
export type SilenceRange = z.infer<typeof silenceRange>;

export const cutReason = z.enum(["silence", "marker", "trim"]);

// production/edit-plan.json — the reviewable output of automatic post-production.
export const editPlan = z.object({
  takeId: z.string(),
  // Duration of the original take. Optional: plans written before this field
  // existed fall back to production/analysis.json or the furthest known time.
  durationMs: z.number().nonnegative().optional(),
  // Ranges of the original take that end up in the video, in order.
  segments: z.array(z.object({ startMs: z.number(), endMs: z.number() })),
  // Suggested cuts; `accepted` cuts are removed from `segments`.
  cuts: z.array(
    z.object({
      startMs: z.number(),
      endMs: z.number(),
      reason: cutReason,
      accepted: z.boolean(),
    }),
  ),
  // Chapter start times on the original take timeline.
  chapters: z.array(
    z.object({
      timeMs: z.number(),
      title: z.string(),
      // Where the chapter was asked to start (marker or user edit). timeMs may
      // be moved out of a cut; it moves back here once that cut is undone.
      requestedTimeMs: z.number().optional(),
    }),
  ),
  layout: z.enum(["screen-only", "screen-webcam"]),
  intro: z
    .object({ title: z.string(), subtitle: z.string().nullable() })
    .nullable(),
  outro: z.boolean(),
});
export type EditPlan = z.infer<typeof editPlan>;

// Relative paths (to public/) — the only place that knows the on-disk layout.
export const coursePath = (courseId: string) => `${COURSES_DIR}/${courseId}`;
export const modulePath = (courseId: string, moduleId: string) =>
  `${coursePath(courseId)}/${moduleId}`;
export const lessonPath = (l: {
  courseId: string;
  moduleId: string;
  id: string;
}) => `${modulePath(l.courseId, l.moduleId)}/${l.id}`;
export const takePath = (lessonDir: string, takeId: string) =>
  `${lessonDir}/recordings/${takeId}`;
export const productionPath = (lessonDir: string) => `${lessonDir}/production`;
export const publishedPath = (lessonDir: string) => `${lessonDir}/published`;

// File names inside a take folder. Media extension is mp4 or webm.
export const TAKE_FILES = {
  webcamPrefix: "webcam",
  displayPrefix: "display",
  captions: "captions.json",
  markers: "markers.json",
  session: "session.json",
} as const;
