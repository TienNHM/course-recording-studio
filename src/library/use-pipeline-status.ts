import { useCallback, useEffect, useRef, useState } from "react";
import { isTerminalJobStatus } from "../../config/course";
import { fetchPipelineStatus, type PipelineStatus } from "../actions/automation";

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 5000;

// GET /api/pipeline/status for one lesson: polls fast while a job runs and
// slowly otherwise (jobs may be started by the inbox watcher, an AI agent or
// the CLI). Calls `onSettled` when a running job is seen finishing.
export const usePipelineStatus = (
  lessonPath: string,
  onSettled?: () => void,
) => {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const wasRunning = useRef(false);

  const poll = useCallback(async () => {
    try {
      const next = await fetchPipelineStatus(lessonPath);
      setStatus(next);
      setError(null);
      const running = next.job !== null && !isTerminalJobStatus(next.job.status);
      if (wasRunning.current && !running) {
        onSettledRef.current?.();
      }
      wasRunning.current = running;
    } catch (e) {
      setError((e as Error).message);
    }
  }, [lessonPath]);

  useEffect(() => {
    setStatus(null);
    wasRunning.current = false;
    poll();
  }, [poll]);

  const running = status?.running ?? false;
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (document.visibilityState === "visible") {
          poll();
        }
      },
      running ? FAST_POLL_MS : SLOW_POLL_MS,
    );
    return () => clearInterval(interval);
  }, [poll, running]);

  return { status, error, refresh: poll };
};
