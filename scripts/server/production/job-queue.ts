// Single, process-wide job queue. Heavy work (ffmpeg, whisper, rendering)
// never runs concurrently: production and render jobs share this queue, and
// the legacy transcribe endpoint takes the same lock via runExclusive().
//
// Job state is persisted in <lesson>/production/job.json so the UI can poll it
// (GET PRODUCTION_STATUS) and so it survives a page reload.
import fs from "fs";
import path from "path";
import type { JobKind, JobState, JobStatus } from "../../../config/course";
import {
  isTerminalJobStatus,
  jobState,
  productionPath,
} from "../../../config/course";
import { readJson, resolvePublicPath, writeJsonAtomic } from "../course-store";

export type { JobKind, JobState };

export const jobFile = (lessonPath: string) =>
  path.join(resolvePublicPath(productionPath(lessonPath)), "job.json");

export const readJobState = (lessonPath: string): JobState | null => {
  const file = jobFile(lessonPath);
  if (!fs.existsSync(file)) {
    return null;
  }
  const parsed = jobState.safeParse(readJson(file));
  return parsed.success ? parsed.data : null;
};

export type JobContext = {
  signal: AbortSignal;
  update: (
    patch: Partial<Omit<JobState, "id" | "kind" | "lessonPath">>,
  ) => void;
  state: () => JobState;
};

type QueuedJob = {
  state: JobState;
  controller: AbortController;
  run: (ctx: JobContext) => Promise<void>;
  onSettled: (state: JobState) => void;
};

// Active (queued or running) jobs, keyed by lesson path.
const active = new Map<string, QueuedJob>();
let chain: Promise<unknown> = Promise.resolve();

// Serializes any async work behind the jobs that are already queued.
export const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = chain.then(fn, fn);
  chain = result.catch(() => undefined);
  return result;
};

const PROGRESS_WRITE_INTERVAL_MS = 500;
const lastProgressWrite = new WeakMap<QueuedJob, number>();

// Progress callbacks (model downloads, renders) fire many times per second.
// Only status changes are written every time; plain progress is throttled.
// GET status serves the in-memory state for active jobs, so it stays live.
// A failed write is logged, never thrown: it must not crash the server.
const persist = (job: QueuedJob, { force = true } = {}) => {
  const now = Date.now();
  job.state.updatedAt = new Date(now).toISOString();
  if (
    !force &&
    now - (lastProgressWrite.get(job) ?? 0) < PROGRESS_WRITE_INTERVAL_MS
  ) {
    return;
  }
  lastProgressWrite.set(job, now);
  try {
    writeJsonAtomic(jobFile(job.state.lessonPath), job.state);
  } catch (err) {
    console.warn(`Could not write job state for ${job.state.lessonPath}:`, err);
  }
};

export const getActiveJob = (lessonPath: string) => {
  return active.get(lessonPath)?.state ?? null;
};

const finish = (job: QueuedJob, status: JobStatus, error: string | null) => {
  job.state.status = status;
  job.state.error = error;
  job.state.finishedAt = new Date().toISOString();
  if (status === "COMPLETED") {
    job.state.progress = 1;
    job.state.step = "Done";
  } else if (status === "CANCELLED") {
    job.state.step = "Cancelled";
  } else {
    job.state.step = "Failed";
  }
  active.delete(job.state.lessonPath);
  try {
    persist(job);
  } catch (e) {
    console.error(e);
  }
  try {
    job.onSettled(job.state);
  } catch (e) {
    console.error(e);
  }
};

export const enqueueJob = ({
  kind,
  lessonPath,
  takeId,
  run,
  onSettled,
}: {
  kind: JobKind;
  lessonPath: string;
  takeId: string | null;
  run: (ctx: JobContext) => Promise<void>;
  // Called once with the final state (COMPLETED / FAILED / CANCELLED).
  onSettled: (state: JobState) => void;
}): JobState => {
  if (active.has(lessonPath)) {
    throw new Error("A job is already queued or running for this lesson");
  }
  const now = new Date().toISOString();
  const job: QueuedJob = {
    state: {
      id: `${kind}-${Date.now()}`,
      kind,
      lessonPath,
      takeId,
      status: "QUEUED",
      step: "Waiting for other jobs to finish",
      progress: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    },
    controller: new AbortController(),
    run,
    onSettled,
  };
  active.set(lessonPath, job);
  persist(job);

  runExclusive(async () => {
    if (job.controller.signal.aborted) {
      return finish(job, "CANCELLED", null);
    }
    const ctx: JobContext = {
      signal: job.controller.signal,
      state: () => job.state,
      update: (patch) => {
        if (job.controller.signal.aborted && !patch.status) {
          return;
        }
        const statusChanged =
          patch.status !== undefined && patch.status !== job.state.status;
        Object.assign(job.state, patch);
        if (patch.progress !== undefined) {
          job.state.progress = Math.max(0, Math.min(1, patch.progress));
        }
        persist(job, { force: statusChanged });
      },
    };
    try {
      await job.run(ctx);
      if (job.controller.signal.aborted) {
        finish(job, "CANCELLED", null);
      } else {
        finish(job, "COMPLETED", null);
      }
    } catch (e) {
      if (job.controller.signal.aborted) {
        finish(job, "CANCELLED", null);
      } else {
        console.error(e);
        finish(job, "FAILED", (e as Error).message ?? String(e));
      }
    }
  });

  return job.state;
};

// Returns false when there is no active job for the lesson.
export const cancelJob = (lessonPath: string): boolean => {
  const job = active.get(lessonPath);
  if (!job) {
    return false;
  }
  job.controller.abort();
  job.state.step = "Cancelling";
  persist(job);
  return true;
};

// job.json may claim a job is running although this server process does not
// know about it (the server was restarted mid-job). Such jobs are marked FAILED.
export const reconcileJobState = (
  lessonPath: string,
  onInterrupted: (state: JobState) => void,
): JobState | null => {
  const state = readJobState(lessonPath);
  if (!state || isTerminalJobStatus(state.status) || active.has(lessonPath)) {
    return state;
  }
  const next: JobState = {
    ...state,
    status: "FAILED",
    step: "Failed",
    error: "Interrupted (the server was restarted)",
    updatedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
  writeJsonAtomic(jobFile(lessonPath), next);
  onInterrupted(next);
  return next;
};
