import fs from "fs";
import path from "path";
import type { Course, CourseModule, Lesson } from "../../config/course";
import { course, courseModule, lesson } from "../../config/course";
import type { CoursePatch, CourseTree, LessonPatch } from "./course-api";

export const COURSE_FILE = "course.json";
export const MODULE_FILE = "module.json";
export const LESSON_FILE = "lesson.json";

export const listSubdirs = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

const readEntries = <T>(
  dir: string,
  file: string,
  parse: (data: unknown) => T,
): T[] => {
  return listSubdirs(dir).flatMap((name) => {
    const jsonPath = path.join(dir, name, file);
    if (!fs.existsSync(jsonPath)) {
      return [];
    }

    try {
      return [parse(JSON.parse(fs.readFileSync(jsonPath, "utf-8")))];
    } catch (e) {
      console.warn(`Skipping invalid ${jsonPath}: ${(e as Error).message}`);
      return [];
    }
  });
};

const byOrder = (a: { order: number }, b: { order: number }) =>
  a.order - b.order;

export const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order + 1), 0);

export const readModules = (courseDir: string): CourseModule[] =>
  readEntries(courseDir, MODULE_FILE, (d) => courseModule.parse(d)).sort(
    byOrder,
  );

export const readLessons = (moduleDir: string): Lesson[] =>
  readEntries(moduleDir, LESSON_FILE, (d) => lesson.parse(d)).sort(byOrder);

export const buildCourseTree = (coursesDir: string): CourseTree => {
  return readEntries(coursesDir, COURSE_FILE, (d) => course.parse(d))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => {
      const courseDir = path.join(coursesDir, c.id);
      return {
        course: c,
        modules: readModules(courseDir).map((m) => ({
          module: m,
          lessons: readLessons(path.join(courseDir, m.id)),
        })),
      };
    });
};

const definedOnly = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

export const applyLessonPatch = (l: Lesson, patch: LessonPatch): Lesson => {
  const { recordingProfile, postProduction, ...rest } = patch;
  return lesson.parse({
    ...l,
    ...definedOnly(rest),
    recordingProfile: {
      ...l.recordingProfile,
      ...definedOnly(recordingProfile ?? {}),
    },
    postProduction: {
      ...l.postProduction,
      ...definedOnly(postProduction ?? {}),
    },
  });
};

export const applyCoursePatch = (c: Course, patch: CoursePatch): Course => {
  const { videoStyle, ...rest } = patch;
  return course.parse({
    ...c,
    ...definedOnly(rest),
    videoStyle: { ...c.videoStyle, ...definedOnly(videoStyle ?? {}) },
  });
};
