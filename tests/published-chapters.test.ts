import { describe, expect, test } from "bun:test";
import {
  buildPublishedChapters,
  ensureChapterAtZero,
} from "../scripts/server/render/chapters";

describe("ensureChapterAtZero", () => {
  test("prepends the intro title when the first chapter starts later", () => {
    expect(
      ensureChapterAtZero(
        [
          { timeMs: 3000, title: "Setup" },
          { timeMs: 60_000, title: "Next" },
        ],
        "Intro to React",
      ),
    ).toEqual([
      { timeMs: 0, title: "Intro to React" },
      { timeMs: 3000, title: "Setup" },
      { timeMs: 60_000, title: "Next" },
    ]);
  });

  test('falls back to "Intro" without an intro title', () => {
    expect(ensureChapterAtZero([{ timeMs: 5000, title: "A" }], null)).toEqual([
      { timeMs: 0, title: "Intro" },
      { timeMs: 5000, title: "A" },
    ]);
    expect(ensureChapterAtZero([{ timeMs: 5000, title: "A" }], "  ")).toEqual([
      { timeMs: 0, title: "Intro" },
      { timeMs: 5000, title: "A" },
    ]);
  });

  test("keeps chapters that already start at 0:00 (sorted)", () => {
    expect(
      ensureChapterAtZero(
        [
          { timeMs: 9000, title: "B" },
          { timeMs: 0, title: "A" },
        ],
        "Intro",
      ),
    ).toEqual([
      { timeMs: 0, title: "A" },
      { timeMs: 9000, title: "B" },
    ]);
  });

  test("no chapters stays empty", () => {
    expect(ensureChapterAtZero([], "Intro")).toEqual([]);
  });
});

describe("buildPublishedChapters", () => {
  test("parses the artifact and returns pretty JSON", () => {
    const out = buildPublishedChapters(
      JSON.stringify([{ timeMs: 3000, title: "Lesson" }]),
      "Title card",
    );
    expect(JSON.parse(out)).toEqual([
      { timeMs: 0, title: "Title card" },
      { timeMs: 3000, title: "Lesson" },
    ]);
  });

  test("rejects non-array content", () => {
    expect(() => buildPublishedChapters("{}", null)).toThrow();
  });
});
