import { expect, test } from "bun:test";
import { marker as markerSchema } from "../config/course";
import {
  addMarker,
  createMarker,
  defaultChapterTitle,
} from "../src/recording/markers";
import {
  createPauseClock,
  pauseClock,
  resumeClock,
} from "../src/recording/pause-clock";

test("marker time excludes paused time", () => {
  let clock = createPauseClock(0);
  clock = pauseClock(clock, 5000);
  clock = resumeClock(clock, 65_000);
  const m = createMarker({ type: "cut", clock, now: 70_000, existing: [] });
  expect(m).toEqual({ type: "cut", timeMs: 10_000 });
  expect(markerSchema.parse(m)).toEqual(m);
});

test("marker added while paused sits at the pause point", () => {
  const clock = pauseClock(createPauseClock(1000), 4000);
  const m = createMarker({
    type: "important",
    clock,
    now: 50_000,
    existing: [],
  });
  expect(m.timeMs).toBe(3000);
});

test("chapter markers get a default title", () => {
  const clock = createPauseClock(0);
  const first = createMarker({
    type: "chapter",
    clock,
    now: 1000,
    existing: [],
  });
  expect(first.title).toBe("Chapter 1");
  const existing = addMarker([{ type: "cut", timeMs: 500 }], first);
  expect(defaultChapterTitle(existing)).toBe("Chapter 2");
  const second = createMarker({
    type: "chapter",
    clock,
    now: 2000,
    existing,
    title: "   ",
  });
  expect(second.title).toBe("Chapter 2");
  const named = createMarker({
    type: "chapter",
    clock,
    now: 3000,
    existing,
    title: " Setup ",
  });
  expect(named.title).toBe("Setup");
});

test("non-chapter markers never carry a title", () => {
  const m = createMarker({
    type: "important",
    clock: createPauseClock(0),
    now: 10,
    existing: [],
    title: "ignored",
  });
  expect(m.title).toBeUndefined();
});

test("markers stay sorted", () => {
  const list = addMarker(
    [
      { type: "cut", timeMs: 100 },
      { type: "cut", timeMs: 300 },
    ],
    { type: "important", timeMs: 200 },
  );
  expect(list.map((m) => m.timeMs)).toEqual([100, 200, 300]);
});
