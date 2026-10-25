// Same-origin fetch helpers for the automatic pipeline and the inbox folder.
// See docs/automation.md → "HTTP API".
import type { ActivityEvent } from "../../scripts/server/automation/activity-log";
import type { PipelineStatus } from "../../scripts/server/automation/decisions";
import type { InboxStatus } from "../../scripts/server/automation/inbox-watcher";
import type { AutomationSettings } from "../../scripts/server/automation/settings";
import {
  AUTOMATION_INBOX,
  AUTOMATION_PROCESS_PENDING,
  AUTOMATION_SETTINGS,
  HEALTH,
  PIPELINE_STATUS,
  PUBLISHED_FILES,
} from "../../scripts/server/constants";

export type { ActivityEvent, AutomationSettings, InboxStatus, PipelineStatus };

export type AutomationSettingsResponse = AutomationSettings & {
  watcher: InboxStatus;
};

export type InboxResponse = {
  settings: AutomationSettings;
  watcher: InboxStatus;
  events: ActivityEvent[];
};

export type ProcessPendingResult = {
  dryRun: boolean;
  production: { lessonPath: string; jobId: string | null }[];
  render: { lessonPath: string; jobId: string | null }[];
  skipped: { lessonPath: string; reason: string }[];
};

export type HealthResponse = {
  ok: boolean;
  app: string;
  version: string;
  port: number;
  publicDir: string;
};

export type PublishedFile = {
  name: string;
  path: string;
  urlPath: string;
  sizeBytes: number;
  modifiedAt: string;
};

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

export const fetchPipelineStatus = (lessonPath: string) =>
  request<PipelineStatus>(withLessonPath(PIPELINE_STATUS, lessonPath), "GET");

export const fetchAutomationSettings = () =>
  request<AutomationSettingsResponse>(AUTOMATION_SETTINGS, "GET");

export const updateAutomationSettings = (patch: {
  inboxDir?: string | null;
  enabled?: boolean;
}) => request<AutomationSettingsResponse>(AUTOMATION_SETTINGS, "PUT", patch);

export const fetchInbox = () => request<InboxResponse>(AUTOMATION_INBOX, "GET");

export const processPending = (body: {
  courseId?: string;
  lessonPaths?: string[];
  dryRun?: boolean;
}) => request<ProcessPendingResult>(AUTOMATION_PROCESS_PENDING, "POST", body);

export const fetchHealth = () => request<HealthResponse>(HEALTH, "GET");

export const fetchPublishedFiles = (lessonPath: string) =>
  request<{ lessonPath: string; dir: string; files: PublishedFile[] }>(
    withLessonPath(PUBLISHED_FILES, lessonPath),
    "GET",
  );
