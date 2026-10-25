import type { Caption } from "@remotion/captions";
import fs from "fs";
import path from "path";
import type {
  Course,
  CourseModule,
  EditPlan,
  Lesson,
  Marker,
  RecordingSession,
} from "../../../config/course";
import {
  TAKE_FILES,
  editPlan,
  marker,
  modulePath,
  productionPath,
  recordingSession,
  takePath,
} from "../../../config/course";
import { readCourse, readJson, resolvePublicPath } from "../course-store";

const MEDIA_EXTENSIONS = [".mp4", ".webm"];

const findMedia = (dir: string, prefix: string): string | null => {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const file = fs
    .readdirSync(dir)
    .find(
      (f) =>
        path.parse(f).name === prefix &&
        MEDIA_EXTENSIONS.includes(path.extname(f).toLowerCase()),
    );
  return file ? path.join(dir, file) : null;
};

export type TakeFiles = {
  takeId: string;
  dir: string;
  display: string | null;
  webcam: string | null;
  captions: string;
  markers: string;
  session: string;
};

export const getTakeFiles = (lessonPath: string, takeId: string): TakeFiles => {
  const dir = resolvePublicPath(takePath(lessonPath, takeId));
  return {
    takeId,
    dir,
    display: findMedia(dir, TAKE_FILES.displayPrefix),
    webcam: findMedia(dir, TAKE_FILES.webcamPrefix),
    captions: path.join(dir, TAKE_FILES.captions),
    markers: path.join(dir, TAKE_FILES.markers),
    session: path.join(dir, TAKE_FILES.session),
  };
};

export const readMarkers = (take: TakeFiles): Marker[] => {
  if (!fs.existsSync(take.markers)) {
    return [];
  }
  return marker.array().parse(readJson(take.markers));
};

export const readSession = (take: TakeFiles): RecordingSession | null => {
  if (!fs.existsSync(take.session)) {
    return null;
  }
  const parsed = recordingSession.safeParse(readJson(take.session));
  return parsed.success ? parsed.data : null;
};

export const readCaptions = (take: TakeFiles): Caption[] | null => {
  if (!fs.existsSync(take.captions)) {
    return null;
  }
  return readJson<Caption[]>(take.captions);
};

export const readCourseSafe = (lesson: Lesson): Course | null => {
  try {
    return readCourse(lesson.courseId);
  } catch {
    return null;
  }
};

export const readModuleSafe = (lesson: Lesson): CourseModule | null => {
  try {
    return readJson<CourseModule>(
      path.join(
        resolvePublicPath(modulePath(lesson.courseId, lesson.moduleId)),
        "module.json",
      ),
    );
  } catch {
    return null;
  }
};

// production/* files
export const productionFiles = (lessonPath: string) => {
  const dir = resolvePublicPath(productionPath(lessonPath));
  return {
    dir,
    silence: path.join(dir, "silence.json"),
    editPlan: path.join(dir, "edit-plan.json"),
    analysis: path.join(dir, "analysis.json"),
    job: path.join(dir, "job.json"),
  };
};

// production/analysis.json — facts about the take that the EditPlan contract
// does not carry (most importantly the media duration).
export type Analysis = {
  takeId: string;
  durationMs: number;
  audioSource: "display" | "webcam" | null;
  display: string | null;
  webcam: string | null;
  analyzedAt: string;
};

export const readAnalysis = (lessonPath: string): Analysis | null => {
  const file = productionFiles(lessonPath).analysis;
  return fs.existsSync(file) ? readJson<Analysis>(file) : null;
};

export const readEditPlan = (lessonPath: string): EditPlan | null => {
  const file = productionFiles(lessonPath).editPlan;
  return fs.existsSync(file) ? editPlan.parse(readJson(file)) : null;
};
