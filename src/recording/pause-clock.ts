// Pure helpers to keep track of the media timeline of a take that can be
// paused and resumed. All times are wall-clock milliseconds (Date.now()).
// MediaRecorder does not record anything while paused, so the media timeline
// is the wall-clock time since start minus the total paused time.

export type PauseClock = {
  readonly startedAt: number;
  // Total paused time of all finished pauses.
  readonly pausedMs: number;
  // Start of the pause in progress, or null when running.
  readonly pausedAt: number | null;
};

export const createPauseClock = (now: number): PauseClock => ({
  startedAt: now,
  pausedMs: 0,
  pausedAt: null,
});

export const isClockPaused = (clock: PauseClock) => clock.pausedAt !== null;

export const pauseClock = (clock: PauseClock, now: number): PauseClock => {
  if (clock.pausedAt !== null) {
    return clock;
  }

  return { ...clock, pausedAt: Math.max(now, clock.startedAt) };
};

export const resumeClock = (clock: PauseClock, now: number): PauseClock => {
  if (clock.pausedAt === null) {
    return clock;
  }

  return {
    ...clock,
    pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt),
    pausedAt: null,
  };
};

// Total paused time, including a pause that is still in progress.
export const totalPausedMs = (clock: PauseClock, now: number): number => {
  if (clock.pausedAt === null) {
    return clock.pausedMs;
  }

  return clock.pausedMs + Math.max(0, now - clock.pausedAt);
};

// Elapsed media time: wall time since start, excluding paused time.
// Frozen while paused.
export const elapsedMediaMs = (clock: PauseClock, now: number): number => {
  const effectiveNow = clock.pausedAt ?? now;
  return Math.max(0, effectiveNow - clock.startedAt - clock.pausedMs);
};

export const expectedFramesForDuration = (durationMs: number, fps: number) =>
  (durationMs / 1000) * fps;
