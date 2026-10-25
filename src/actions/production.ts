// Same-origin fetch helpers for post-production, review and export.
import type { Caption } from "@remotion/captions";
import type { EditPlan, JobState } from "../../config/course";
import {
  CAPTIONS_API,
  EDIT_PLAN_API,
  PRODUCTION_CANCEL,
  PRODUCTION_START,
  PRODUCTION_STATUS,
  RENDER_LESSON,
} from "../../scripts/server/constants";
import type { EditPlanPatch } from "../../scripts/server/production/edit-plan";

const request = async <T>(
  route: string,
  method: string,
  body?: unknown,
): Promise<T> => {
  const res = await fetch(route, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed with status ${res.status}`);
  }

  return json as T;
};

const withLessonPath = (route: string, lessonPath: string) =>
  `${route}?lessonPath=${encodeURIComponent(lessonPath)}`;

export const startProduction = (lessonPath: string, retranscribe = false) =>
  request<JobState>(PRODUCTION_START, "POST", { lessonPath, retranscribe });

export const fetchJobStatus = (lessonPath: string) =>
  request<JobState | null>(
    withLessonPath(PRODUCTION_STATUS, lessonPath),
    "GET",
  );

export const cancelJob = (lessonPath: string) =>
  request<{ cancelled: boolean }>(PRODUCTION_CANCEL, "POST", { lessonPath });

export const startRender = (lessonPath: string) =>
  request<JobState>(RENDER_LESSON, "POST", { lessonPath });

export const fetchEditPlan = (lessonPath: string) =>
  request<EditPlan>(withLessonPath(EDIT_PLAN_API, lessonPath), "GET");

export const updateEditPlan = (lessonPath: string, patch: EditPlanPatch) =>
  request<EditPlan>(EDIT_PLAN_API, "PUT", { lessonPath, ...patch });

export const fetchCaptions = (lessonPath: string) =>
  request<Caption[]>(withLessonPath(CAPTIONS_API, lessonPath), "GET");

export const updateCaptions = (lessonPath: string, captions: Caption[]) =>
  request<Caption[]>(CAPTIONS_API, "PUT", { lessonPath, captions });

// URL of a file under public/ (served at the site root by the Vite middleware).
export const publicUrl = (relativePath: string, version?: string | null) => {
  const encoded = relativePath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return version
    ? `/${encoded}?v=${encodeURIComponent(version)}`
    : `/${encoded}`;
};

// Reads a JSON file under public/, or null if it does not exist.
export const fetchPublicJson = async <T>(
  relativePath: string,
): Promise<T | null> => {
  const res = await fetch(publicUrl(relativePath), { cache: "no-store" });
  if (!res.ok) {
    return null;
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // The dev server answers unknown paths with index.html.
    return null;
  }
};
