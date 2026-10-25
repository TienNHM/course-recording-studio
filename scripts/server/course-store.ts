// Shared file-system access for course data under public/.
// Every path coming from a request must go through resolvePublicPath().
import fs from "fs";
import path from "path";
import type { Course, Lesson } from "../../config/course";
import { COURSES_DIR, course, lesson } from "../../config/course";

export const PUBLIC_DIR = path.join(process.cwd(), "public");

// Resolves a path relative to public/ and refuses anything outside public/courses.
export const resolvePublicPath = (relative: string): string => {
  const resolved = path.resolve(PUBLIC_DIR, relative);
  const root = path.resolve(PUBLIC_DIR, COURSES_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path is outside of ${COURSES_DIR}/: ${relative}`);
  }
  return resolved;
};

export const readJson = <T>(file: string): T => {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
};

// Write to a temp file and rename, so a crash never leaves half-written JSON.
export const writeJsonAtomic = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
};

export const readLesson = (lessonDir: string): Lesson => {
  return lesson.parse(
    readJson(path.join(resolvePublicPath(lessonDir), "lesson.json")),
  );
};

export const writeLesson = (lessonDir: string, data: Lesson) => {
  writeJsonAtomic(
    path.join(resolvePublicPath(lessonDir), "lesson.json"),
    lesson.parse(data),
  );
};

export const updateLesson = (
  lessonDir: string,
  patch: (l: Lesson) => Lesson,
): Lesson => {
  const next = patch(readLesson(lessonDir));
  writeLesson(lessonDir, next);
  return next;
};

export const readCourse = (courseId: string): Course => {
  return course.parse(
    readJson(
      path.join(resolvePublicPath(`${COURSES_DIR}/${courseId}`), "course.json"),
    ),
  );
};
