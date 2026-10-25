import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import {
  formatDuration,
  formatTimecode,
  parseTimecode,
} from "../src/review/timecode";
import { applyLineText, groupIntoLines } from "../src/review/transcript-lines";

const word = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: 1,
});

const captions = [
  word("Hello", 0, 400),
  word(" world.", 400, 900),
  word(" This", 1000, 1200),
  word(" is", 1200, 1300),
  word(" it", 1300, 1500),
  word(" again", 3000, 3400),
];

describe("timecode", () => {
  test("formats and parses", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(65_900)).toBe("1:05");
    expect(formatTimecode(3_725_000)).toBe("1:02:05");
    expect(parseTimecode("1:05")).toBe(65_000);
    expect(parseTimecode("1:02:05")).toBe(3_725_000);
    expect(parseTimecode("12.5")).toBe(12_500);
    expect(parseTimecode("a:00")).toBeNull();
    expect(parseTimecode("")).toBeNull();
    expect(formatDuration(4200)).toBe("4.2 s");
  });
});

describe("groupIntoLines", () => {
  test("splits on sentence end and pauses", () => {
    const lines = groupIntoLines(captions);
    expect(lines.map((l) => [l.start, l.end, l.text])).toEqual([
      [0, 2, "Hello world."],
      [2, 5, "This is it"],
      [5, 6, "again"],
    ]);
    expect(lines[1]?.startMs).toBe(1000);
    expect(lines[1]?.endMs).toBe(1500);
  });
});

describe("applyLineText", () => {
  test("same number of words keeps spacing and timing", () => {
    const next = applyLineText(captions, { start: 2, end: 5 }, "That was it");
    expect(next.map((c) => c.text)).toEqual([
      "Hello",
      " world.",
      " That",
      " was",
      " it",
      " again",
    ]);
    expect(next.map((c) => c.startMs)).toEqual(captions.map((c) => c.startMs));
  });

  test("extra words go to the last word, missing words become empty", () => {
    expect(
      applyLineText(captions, { start: 0, end: 2 }, "Hi there, world.")
        .map((c) => c.text)
        .slice(0, 2),
    ).toEqual(["Hi", " there, world."]);
    expect(
      applyLineText(captions, { start: 2, end: 5 }, "Done")
        .map((c) => c.text)
        .slice(2, 5),
    ).toEqual([" Done", "", ""]);
  });
});
