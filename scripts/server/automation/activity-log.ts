// Recent automation activity (inbox imports, automatic jobs): the last 50
// events, kept in memory and mirrored to public/courses/.automation-log.json
// so they survive a restart.
import fs from "fs";
import path from "path";
import { COURSES_DIR } from "../../../config/course";
import { PUBLIC_DIR, writeJsonAtomic } from "../course-store";

export const ACTIVITY_LOG_LIMIT = 50;

export type ActivityType =
  | "detected"
  | "imported"
  | "deferred"
  | "failed"
  | "auto-production"
  | "auto-render"
  | "pipeline"
  | "watcher";

export type ActivityEvent = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  type: ActivityType;
  message: string;
  lessonPath?: string;
  file?: string;
  jobId?: string;
};

export const activityLogFile = () =>
  path.join(PUBLIC_DIR, COURSES_DIR, ".automation-log.json");

let events: ActivityEvent[] | null = null;
let counter = 0;

const load = (): ActivityEvent[] => {
  if (events) {
    return events;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(activityLogFile(), "utf-8"));
    events = Array.isArray(parsed)
      ? (parsed as ActivityEvent[]).slice(-ACTIVITY_LOG_LIMIT)
      : [];
  } catch {
    events = [];
  }
  return events;
};

// Newest last; keeps at most `limit` events.
export const appendEvent = (
  list: ActivityEvent[],
  event: ActivityEvent,
  limit = ACTIVITY_LOG_LIMIT,
): ActivityEvent[] => [...list, event].slice(-limit);

export const logActivity = (
  event: Omit<ActivityEvent, "id" | "at" | "level"> & {
    level?: ActivityEvent["level"];
  },
): ActivityEvent => {
  const full: ActivityEvent = {
    id: `${Date.now()}-${++counter}`,
    at: new Date().toISOString(),
    level: event.level ?? "info",
    ...event,
  };
  events = appendEvent(load(), full);
  const prefix = `[automation] ${full.type}`;
  if (full.level === "error") {
    console.error(prefix, full.message);
  } else {
    console.log(prefix, full.message);
  }
  try {
    writeJsonAtomic(activityLogFile(), events);
  } catch (e) {
    console.warn("Could not write the automation log:", e);
  }
  return full;
};

// Newest first.
export const getActivity = (): ActivityEvent[] => [...load()].reverse();
