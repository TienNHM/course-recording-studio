// Read-only endpoints used by the Review page (besides src/actions/production.ts).
import type { PipelineStatus } from "../../scripts/server/automation/decisions";
import { PIPELINE_STATUS, PUBLISHED_FILES } from "../../scripts/server/constants";
import type { PublishedFile } from "../../scripts/server/import-recording";

export type { PipelineStatus, PublishedFile };

const getJson = async <T>(route: string, lessonPath: string): Promise<T> => {
  const res = await fetch(
    `${route}?lessonPath=${encodeURIComponent(lessonPath)}`,
    { cache: "no-store" },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed with status ${res.status}`);
  }
  return json as T;
};

/** GET /api/pipeline/status — current/last job and what runs next. */
export const fetchPipelineStatus = (lessonPath: string) =>
  getJson<PipelineStatus>(PIPELINE_STATUS, lessonPath);

/** GET /api/lesson/published — files of the last export, with absolute paths. */
export const fetchPublishedFiles = (lessonPath: string) =>
  getJson<{ lessonPath: string; dir: string; files: PublishedFile[] }>(
    PUBLISHED_FILES,
    lessonPath,
  );
