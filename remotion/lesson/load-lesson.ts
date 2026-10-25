// Loads everything the "lesson" composition needs from public/ via staticFile().
// Runs inside calculateMetadata() (browser context, both in the Studio and while rendering).
import type { Caption } from "@remotion/captions";
import type { StaticFile } from "remotion";
import { staticFile } from "remotion";
import type { z } from "zod";
import type {
  Course,
  CourseModule,
  EditPlan,
  Lesson,
} from "../../config/course";
import {
  TAKE_FILES,
  course as courseSchema,
  courseModule as courseModuleSchema,
  coursePath,
  editPlan as editPlanSchema,
  lesson as lessonSchema,
  modulePath,
  productionPath,
  takePath,
} from "../../config/course";

const MEDIA_EXTENSIONS = ["mp4", "webm"] as const;

export type LessonMedia = {
  display: StaticFile;
  webcam: StaticFile | null;
  captions: StaticFile | null;
};

export type LoadedLesson = {
  lesson: Lesson;
  course: Course | null;
  module: CourseModule | null;
  editPlan: EditPlan | null;
  takeId: string;
  media: LessonMedia;
  captions: Caption[] | null;
};

const toStaticFile = (name: string): StaticFile => {
  return { name, src: staticFile(name) } as StaticFile;
};

const stripSlashes = (p: string) => p.replace(/^\/+/, "").replace(/\/+$/, "");

const fetchJson = async (path: string): Promise<unknown | null> => {
  const res = await fetch(staticFile(path), { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Could not load ${path}: HTTP ${res.status}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Dev servers may answer unknown paths with an HTML page instead of a 404.
    if (text.trimStart().startsWith("<")) {
      return null;
    }

    throw new Error(`${path} is not valid JSON`);
  }
};

const parseOptionalJson = async <T extends z.ZodTypeAny>(
  path: string,
  schema: T,
): Promise<z.infer<T> | null> => {
  const data = await fetchJson(path);
  if (data === null) {
    return null;
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`${path} is invalid: ${parsed.error.message}`);
  }

  return parsed.data;
};

// Checks if a static file exists without downloading it.
const exists = async (path: string): Promise<boolean> => {
  try {
    const res = await fetch(staticFile(path), {
      method: "HEAD",
      cache: "no-store",
    });
    if (!res.ok) {
      return false;
    }

    // Guard against SPA fallbacks answering every path with index.html
    const type = res.headers.get("content-type") ?? "";
    return !type.includes("text/html");
  } catch {
    return false;
  }
};

const findMedia = async (
  dir: string,
  prefix: string,
): Promise<StaticFile | null> => {
  for (const ext of MEDIA_EXTENSIONS) {
    const name = `${dir}/${prefix}.${ext}`;
    if (await exists(name)) {
      return toStaticFile(name);
    }
  }

  return null;
};

export const loadLesson = async (
  rawLessonPath: string,
): Promise<LoadedLesson> => {
  const lessonDir = stripSlashes(rawLessonPath);

  const lesson = await parseOptionalJson(
    `${lessonDir}/lesson.json`,
    lessonSchema,
  );
  if (!lesson) {
    throw new Error(`No lesson found at public/${lessonDir}/lesson.json`);
  }

  if (!lesson.selectedTake) {
    throw new Error(
      `Lesson "${lesson.title}" has no selected take yet. Record a take first.`,
    );
  }

  const takeId = lesson.selectedTake;
  const takeDir = takePath(lessonDir, takeId);

  const [course, module, editPlan, display, webcam, captionsExist] =
    await Promise.all([
      parseOptionalJson(
        `${coursePath(lesson.courseId)}/course.json`,
        courseSchema,
      ),
      parseOptionalJson(
        `${modulePath(lesson.courseId, lesson.moduleId)}/module.json`,
        courseModuleSchema,
      ),
      parseOptionalJson(
        `${productionPath(lessonDir)}/edit-plan.json`,
        editPlanSchema,
      ),
      findMedia(takeDir, TAKE_FILES.displayPrefix),
      findMedia(takeDir, TAKE_FILES.webcamPrefix),
      exists(`${takeDir}/${TAKE_FILES.captions}`),
    ]);

  if (!display && !webcam) {
    throw new Error(
      `No recording found in public/${takeDir} (expected display.mp4/webm)`,
    );
  }

  if (editPlan && editPlan.takeId !== takeId) {
    console.warn(
      `edit-plan.json was made for take ${editPlan.takeId}, but the selected take is ${takeId}. Ignoring the edit plan.`,
    );
  }

  const captionsFile = captionsExist
    ? toStaticFile(`${takeDir}/${TAKE_FILES.captions}`)
    : null;

  const captions = captionsFile
    ? ((await fetchJson(captionsFile.name)) as Caption[] | null)
    : null;

  return {
    lesson,
    course,
    module,
    editPlan: editPlan && editPlan.takeId === takeId ? editPlan : null,
    takeId,
    media: {
      // A webcam-only take is shown like a screen-only take.
      display: (display ?? webcam) as StaticFile,
      webcam: display ? webcam : null,
      captions: captionsFile,
    },
    captions: Array.isArray(captions) ? captions : null,
  };
};
