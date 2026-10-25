import { describe, expect, test } from "bun:test";
import {
  buildPublishedChapters,
  ensureChapterAtZero,
} from "../scripts/server/render/chapters";

describe("ensureChapterAtZero", () => {
  test('prepends a localized "Mở đầu" chapter when the first chapter starts later', () => {
    expect(
      ensureChapterAtZero(
        [
          { timeMs: 3000, title: "Setup" },
          { timeMs: 60_000, title: "Next" },
        ],
        "vi",
      ),
    ).toEqual([
      { timeMs: 0, title: "Mở đầu" },
      { timeMs: 3000, title: "Setup" },
      { timeMs: 60_000, title: "Next" },
    ]);
  });

  test('uses "Intro" for English courses and "Mở đầu" by default', () => {
    expect(ensureChapterAtZero([{ timeMs: 5000, title: "A" }], "en")).toEqual([
      { timeMs: 0, title: "Intro" },
      { timeMs: 5000, title: "A" },
    ]);
    expect(ensureChapterAtZero([{ timeMs: 5000, title: "A" }])).toEqual([
      { timeMs: 0, title: "Mở đầu" },
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
        "en",
      ),
    ).toEqual([
      { timeMs: 0, title: "A" },
      { timeMs: 9000, title: "B" },
    ]);
  });

  test("no chapters stays empty", () => {
    expect(ensureChapterAtZero([], "vi")).toEqual([]);
  });
});

describe("buildPublishedChapters", () => {
  test("parses the artifact and returns pretty JSON", () => {
    const out = buildPublishedChapters(
      JSON.stringify([{ timeMs: 3000, title: "Lesson" }]),
      "en",
    );
    expect(out).toContain("\n  ");
    expect(JSON.parse(out)).toEqual([
      { timeMs: 0, title: "Intro" },
      { timeMs: 3000, title: "Lesson" },
    ]);
  });

  test("rejects non-array content", () => {
    expect(() => buildPublishedChapters("{}", "vi")).toThrow();
  });
});
