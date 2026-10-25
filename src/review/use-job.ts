import { useCallback, useEffect, useRef, useState } from "react";
import type { JobState } from "../../config/course";
import { isTerminalJobStatus } from "../../config/course";
import {
  cancelJob,
  fetchJobStatus,
  startProduction,
  startRender,
} from "../actions/production";

export const JOB_POLL_INTERVAL_MS = 1500;

export const isJobActive = (job: JobState | null): boolean =>
  job !== null && !isTerminalJobStatus(job.status);

// Latest production/render job of a lesson. Polls while a job is queued or
// running and calls `onSettled` once when an observed job finishes.
export const useLessonJob = (
  lessonPath: string | null,
  onSettled?: (job: JobState) => void,
) => {
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const apply = useCallback((next: JobState | null) => setJob(next), []);

  // Report a job that was seen running and is now finished.
  const previous = useRef<JobState | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = job;
    if (
      prev &&
      job &&
      prev.id === job.id &&
      isJobActive(prev) &&
      !isJobActive(job)
    ) {
      onSettledRef.current?.(job);
    }
  }, [job]);

  const poll = useCallback(async () => {
    if (!lessonPath) {
      return;
    }
    try {
      apply(await fetchJobStatus(lessonPath));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apply, lessonPath]);

  useEffect(() => {
    previous.current = null;
    setJob(null);
    setError(null);
    poll();
  }, [poll]);

  const active = isJobActive(job);
  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = setInterval(poll, JOB_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, poll]);

  const run = useCallback(
    async (
      fn: (path: string) => Promise<JobState | { cancelled: boolean }>,
    ) => {
      if (!lessonPath) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await fn(lessonPath);
        if ("id" in result) {
          apply(result);
        } else {
          await poll();
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [apply, lessonPath, poll],
  );

  const process = useCallback(
    (retranscribe = false) => run((p) => startProduction(p, retranscribe)),
    [run],
  );
  const exportLesson = useCallback(() => run(startRender), [run]);
  const cancel = useCallback(() => run(cancelJob), [run]);

  return { job, active, busy, error, process, exportLesson, cancel };
};
