import type { Course, CourseModule, Lesson } from "../../config/course";
import type {
  CoursePatch,
  CourseTree,
  CreateRequest,
  LessonPatch,
} from "../../scripts/server/course-api";
import { COURSES_API, LESSON_API } from "../../scripts/server/constants";

const request = async <T>(
  route: string,
  method: string,
  body?: unknown,
): Promise<T> => {
  const res = await fetch(route, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed with status ${res.status}`);
  }

  return json as T;
};

export const fetchCourseTree = () => request<CourseTree>(COURSES_API, "GET");

export const createCourse = (
  body: Omit<Extract<CreateRequest, { kind: "course" }>, "kind">,
) => request<Course>(COURSES_API, "POST", { kind: "course", ...body });

export const createModule = (courseId: string, title: string) =>
  request<CourseModule>(COURSES_API, "POST", {
    kind: "module",
    courseId,
    title,
  });

export const createLesson = (
  courseId: string,
  moduleId: string,
  title: string,
) =>
  request<Lesson>(COURSES_API, "POST", {
    kind: "lesson",
    courseId,
    moduleId,
    title,
  });

export const patchCourse = (courseId: string, patch: CoursePatch) =>
  request<Course>(COURSES_API, "PATCH", { kind: "course", courseId, patch });

export const patchLesson = (lessonPath: string, patch: LessonPatch) =>
  request<Lesson>(LESSON_API, "PATCH", { lessonPath, patch });
