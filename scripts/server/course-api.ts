// Request/response shapes of the courses API, shared by server and UI.
import { z } from "zod";
import type { Course, CourseModule, Lesson } from "../../config/course";
import {
  COURSES_DIR,
  courseLanguage,
  glossaryTerm,
  lessonStatus,
  outputProfile,
  silencePreset,
  slug,
} from "../../config/course";

export type CourseTree = {
  course: Course;
  modules: { module: CourseModule; lessons: Lesson[] }[];
}[];

export const lessonPathParam = z
  .string()
  .regex(
    new RegExp(`^${COURSES_DIR}/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$`),
    "invalid lesson path",
  );

export const takeIdParam = z.string().regex(/^\d+$/, "invalid take id");

const lessonFields = z.object({
  title: z.string().trim().min(1),
  description: z.string(),
  objectives: z.array(z.string()),
  notes: z.string(),
  recordingProfile: z
    .object({ webcam: z.boolean(), microphone: z.boolean() })
    .partial(),
  postProduction: z
    .object({
      autoTranscribe: z.boolean(),
      autoDetectSilence: z.boolean(),
      autoRemoveSilence: z.boolean(),
      silencePreset,
      generateChapters: z.boolean(),
      intro: z.boolean(),
      outro: z.boolean(),
      autoProcess: z.boolean(),
      autoPublish: z.boolean(),
    })
    .partial(),
  status: lessonStatus,
});

export const lessonPatch = lessonFields.partial().strict();
export type LessonPatch = z.infer<typeof lessonPatch>;

export const courseFields = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  language: courseLanguage,
  outputProfile,
  glossary: z.array(glossaryTerm),
});

export const coursePatch = courseFields.partial().strict();
export type CoursePatch = z.infer<typeof coursePatch>;

export const createRequest = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("course"),
    name: z.string().trim().min(1),
    description: z.string().optional(),
    language: courseLanguage.optional(),
  }),
  z.object({
    kind: z.literal("module"),
    courseId: slug,
    title: z.string().trim().min(1),
  }),
  lessonFields
    .omit({ status: true })
    .partial()
    .extend({
      kind: z.literal("lesson"),
      courseId: slug,
      moduleId: slug,
      title: z.string().trim().min(1),
    }),
]);
export type CreateRequest = z.infer<typeof createRequest>;

export const patchCourseRequest = z.object({
  kind: z.literal("course"),
  courseId: slug,
  patch: coursePatch,
});
export type PatchCourseRequest = z.infer<typeof patchCourseRequest>;

export const patchLessonRequest = z.object({
  lessonPath: lessonPathParam,
  patch: lessonPatch,
});
export type PatchLessonRequest = z.infer<typeof patchLessonRequest>;

export const selectTakeRequest = z.object({
  lessonPath: lessonPathParam,
  takeId: takeIdParam,
});
export type SelectTakeRequest = z.infer<typeof selectTakeRequest>;

export const takeFileName = z.enum(["markers.json", "session.json"]);
export type TakeFileName = z.infer<typeof takeFileName>;

export type DiskSpaceResponse = { freeBytes: number };
