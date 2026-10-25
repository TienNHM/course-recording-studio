// Server-side "find or create" of course → module → lesson by id or title
// (same matching as the MCP/CLI ensureLesson, so both are idempotent by slug).
import type { Course, CourseModule, Lesson } from "../../../config/course";
import {
  COURSES_DIR,
  type CourseLanguage,
  lessonPath as toLessonPath,
} from "../../../config/course";
import { matchByTitle } from "../course-match";
import { resolvePublicPath } from "../course-store";
import { buildCourseTree } from "../course-tree";
import { createEntry } from "../courses";

export type EnsuredLesson = {
  course: Course;
  module: CourseModule;
  lesson: Lesson;
  lessonPath: string;
  created: ("course" | "module" | "lesson")[];
};

export const ensureLessonByTitles = (input: {
  course: string;
  module: string;
  lesson: string;
  language?: CourseLanguage;
}): EnsuredLesson => {
  const created: EnsuredLesson["created"] = [];
  const tree = buildCourseTree(resolvePublicPath(COURSES_DIR));
  const courseEntry = matchByTitle(
    tree,
    input.course,
    (c) => c.course.id,
    (c) => c.course.name,
  );
  let course = courseEntry?.course;
  if (!course) {
    course = createEntry({
      kind: "course",
      name: input.course.trim(),
      language: input.language,
    }) as Course;
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
    module = createEntry({
      kind: "module",
      courseId: course.id,
      title: input.module.trim(),
    }) as CourseModule;
    created.push("module");
  }
  let lesson = matchByTitle(
    moduleEntry?.lessons ?? [],
    input.lesson,
    (l) => l.id,
    (l) => l.title,
  );
  if (!lesson) {
    lesson = createEntry({
      kind: "lesson",
      courseId: course.id,
      moduleId: module.id,
      title: input.lesson.trim(),
    }) as Lesson;
    created.push("lesson");
  }
  return { course, module, lesson, lessonPath: toLessonPath(lesson), created };
};
