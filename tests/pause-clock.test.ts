import { expect, test } from "bun:test";
import {
  createPauseClock,
  elapsedMediaMs,
  expectedFramesForDuration,
  isClockPaused,
  pauseClock,
  resumeClock,
  totalPausedMs,
} from "../src/recording/pause-clock";

test("elapsed time without pauses", () => {
  const clock = createPauseClock(1000);
  expect(elapsedMediaMs(clock, 1000)).toBe(0);
  expect(elapsedMediaMs(clock, 6000)).toBe(5000);
  expect(totalPausedMs(clock, 6000)).toBe(0);
});

test("elapsed time is frozen while paused", () => {
  const paused = pauseClock(createPauseClock(0), 4000);
  expect(isClockPaused(paused)).toBe(true);
  expect(elapsedMediaMs(paused, 4000)).toBe(4000);
  expect(elapsedMediaMs(paused, 9000)).toBe(4000);
  expect(totalPausedMs(paused, 9000)).toBe(5000);
});

test("multiple pauses are excluded", () => {
  let clock = createPauseClock(0);
  clock = pauseClock(clock, 10_000);
  clock = resumeClock(clock, 13_000);
  clock = pauseClock(clock, 20_000);
  clock = resumeClock(clock, 30_000);
  expect(isClockPaused(clock)).toBe(false);
  expect(clock.pausedMs).toBe(13_000);
  expect(elapsedMediaMs(clock, 40_000)).toBe(27_000);
});

test("pause and resume are idempotent", () => {
  let clock = createPauseClock(0);
  clock = pauseClock(clock, 1000);
  clock = pauseClock(clock, 2000);
  expect(clock.pausedAt).toBe(1000);
  clock = resumeClock(clock, 3000);
  clock = resumeClock(clock, 5000);
  expect(clock.pausedMs).toBe(2000);
  expect(elapsedMediaMs(clock, 6000)).toBe(4000);
});

test("stopping while paused uses the pause start", () => {
  let clock = createPauseClock(0);
  clock = pauseClock(clock, 7000);
  expect(elapsedMediaMs(clock, 60_000)).toBe(7000);
});

test("expected frames exclude paused time", () => {
  let clock = createPauseClock(0);
  clock = pauseClock(clock, 10_000);
  clock = resumeClock(clock, 20_000);
  const duration = elapsedMediaMs(clock, 30_000);
  expect(duration).toBe(20_000);
  expect(expectedFramesForDuration(duration, 30)).toBe(600);
});

test("never negative", () => {
  const clock = createPauseClock(5000);
  expect(elapsedMediaMs(clock, 1000)).toBe(0);
});
