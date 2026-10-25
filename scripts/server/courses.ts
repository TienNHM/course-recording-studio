import fs from "fs";
import { IncomingMessage } from "http";
import path from "path";
import { z } from "zod";
import type { Course, CourseModule, Lesson } from "../../config/course";
import {
  COURSES_DIR,
  course,
  courseModule,
  coursePath,
  lesson,
  lessonPath,
  marker,
  modulePath,
  recordingSession,
  takePath,
} from "../../config/course";
import type { CreateRequest, DiskSpaceResponse } from "./course-api";
import {
  createRequest,
  lessonPathParam,
  patchCourseRequest,
  patchLessonRequest,
  selectTakeRequest,
  takeFileName,
  takeIdParam,
} from "./course-api";
import { maybeAutoProcess } from "./automation/pipeline";
import { uniqueSlug } from "./course-slug";
import {
  PUBLIC_DIR,
  readCourse,
  readJson,
  readLesson,
  resolvePublicPath,
  updateLesson,
  writeJsonAtomic,
  writeLesson,
} from "./course-store";
import {
  COURSE_FILE,
  MODULE_FILE,
  applyCoursePatch,
  applyLessonPatch,
  buildCourseTree,
  listSubdirs,
  nextOrder,
  readLessons,
  readModules,
} from "./course-tree";
import { HttpError, getQuery, jsonHandler, readJsonBody } from "./http-json";

const coursesRoot = () => resolvePublicPath(COURSES_DIR);

const readModule = (courseId: string, moduleId: string): CourseModule => {
  return courseModule.parse(
    readJson(
      path.join(resolvePublicPath(modulePath(courseId, moduleId)), MODULE_FILE),
    ),
  );
};

// Creates a course, module or lesson (ids are unique slugs of the titles).
export const createEntry = (
  req: CreateRequest,
): Course | CourseModule | Lesson => {
  if (req.kind === "course") {
    const id = uniqueSlug(req.name, listSubdirs(coursesRoot()), "course");
    const created = course.parse({
      id,
      name: req.name,
      description: req.description,
      language: req.language,
      createdAt: new Date().toISOString(),
    });
    writeJsonAtomic(
      path.join(resolvePublicPath(coursePath(id)), COURSE_FILE),
      created,
    );
    return created;
  }

  if (req.kind === "module") {
    readCourse(req.courseId);
    const courseDir = resolvePublicPath(coursePath(req.courseId));
    const created = courseModule.parse({
      id: uniqueSlug(req.title, listSubdirs(courseDir), "module"),
      courseId: req.courseId,
      title: req.title,
      order: nextOrder(readModules(courseDir)),
    });
    writeJsonAtomic(path.join(courseDir, created.id, MODULE_FILE), created);
    return created;
  }

  const { courseId, moduleId, ...fields } = req;
  readModule(courseId, moduleId);
  const moduleDir = resolvePublicPath(modulePath(courseId, moduleId));
  const created = lesson.parse({
    ...fields,
    id: uniqueSlug(req.title, listSubdirs(moduleDir), "lesson"),
    courseId,
    moduleId,
    order: nextOrder(readLessons(moduleDir)),
    status: "READY_TO_RECORD",
  });
  writeLesson(lessonPath(created), created);
  return created;
};

export const handleCourses = jsonHandler({
  GET: () => buildCourseTree(coursesRoot()),
  POST: async (req: IncomingMessage) => {
    return createEntry(createRequest.parse(await readJsonBody(req)));
  },
  PATCH: async (req: IncomingMessage) => {
    const { courseId, patch } = patchCourseRequest.parse(
      await readJsonBody(req),
    );
    const updated = applyCoursePatch(readCourse(courseId), patch);
    writeJsonAtomic(
      path.join(resolvePublicPath(coursePath(courseId)), COURSE_FILE),
      updated,
    );
    return updated;
  },
});

export const handleLesson = jsonHandler({
  PATCH: async (req: IncomingMessage) => {
    const { lessonPath: dir, patch } = patchLessonRequest.parse(
      await readJsonBody(req),
    );
    return updateLesson(dir, (l) => applyLessonPatch(l, patch));
  },
});

const takeFileSchemas = {
  "markers.json": z.array(marker),
  "session.json": recordingSession,
} as const;

export const handleTakeFile = jsonHandler({
  POST: async (req: IncomingMessage) => {
    const query = getQuery(req);
    const dir = lessonPathParam.parse(query.get("lessonPath"));
    const takeId = takeIdParam.parse(query.get("takeId"));
    const name = takeFileName.parse(query.get("name"));
    readLesson(dir);
    const data = takeFileSchemas[name].parse(await readJsonBody(req));
    writeJsonAtomic(
      path.join(resolvePublicPath(takePath(dir, takeId)), name),
      data,
    );
    return data;
  },
});

export const handleSelectTake = jsonHandler({
  POST: async (req: IncomingMessage) => {
    const { lessonPath: dir, takeId } = selectTakeRequest.parse(
      await readJsonBody(req),
    );
    if (!fs.existsSync(resolvePublicPath(takePath(dir, takeId)))) {
      throw new HttpError(404, `Take ${takeId} does not exist`);
    }

    const selected = updateLesson(dir, (l) => ({
      ...l,
      selectedTake: takeId,
      status: "RECORDED",
    }));
    // autoProcess: post-production starts as soon as the take is saved.
    const { productionJob } = maybeAutoProcess({
      lessonPath: dir,
      trigger: "select-take",
    });
    return productionJob ? readLesson(dir) : selected;
  },
});

export const handleDiskSpace = jsonHandler({
  GET: (): DiskSpaceResponse => {
    const stats = fs.statfsSync(PUBLIC_DIR);
    return { freeBytes: stats.bavail * stats.bsize };
  },
});
