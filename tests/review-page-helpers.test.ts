import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import type { EditPlan } from "../config/course";
import {
  buildLineTokens,
  buildTimelineGeometry,
  computeReviewSummary,
  estimateRemainingMs,
  findRanges,
  fixAliases,
  formatYouTubeChapters,
  fractionToMs,
  matchesQuery,
  originalMsToPlayerMs,
  playerMsToOriginalMs,
  rangeToBox,
  resetCutChanges,
  setSilenceChanges,
  sortChapterDrafts,
  stepCut,
  validateChapters,
  draftToChapter,
  type ChapterDraft,
} from "../src/review/review-helpers";

const plan: EditPlan = {
  takeId: "1",
  durationMs: 100_000,
  segments: [
    { startMs: 2_000, endMs: 30_000 },
    { startMs: 40_000, endMs: 90_000 },
  ],
  cuts: [
    { startMs: 0, endMs: 2_000, reason: "trim", accepted: true },
    { startMs: 30_000, endMs: 40_000, reason: "marker", accepted: true },
    { startMs: 50_000, endMs: 60_000, reason: "silence", accepted: false },
    { startMs: 90_000, endMs: 100_000, reason: "trim", accepted: true },
  ],
  chapters: [
    { timeMs: 2_000, title: "Mở đầu" },
    { timeMs: 45_000, title: "Phần 2" },
  ],
  layout: "screen-only",
  intro: null,
  outro: true,
};

const word = (text: string, confidence: number | null = 1): Caption => ({
  text,
  startMs: 0,
  endMs: 0,
  timestampMs: null,
  confidence,
});

describe("summary", () => {
  test("durations, cuts, chapters and words", () => {
    const summary = computeReviewSummary(plan, [
      word("Xin"),
      word(" chào"),
      word(" "),
    ]);
    expect(summary.rawMs).toBe(100_000);
    expect(summary.finalMs).toBe(78_000);
    expect(summary.removedMs).toBe(22_000);
    expect(summary.removedRatio).toBeCloseTo(0.22);
    expect(summary.acceptedCuts).toBe(3);
    expect(summary.pendingSuggestions).toBe(1);
    expect(summary.chapters).toBe(2);
    expect(summary.words).toBe(2);
    expect(computeReviewSummary(plan, null).words).toBeNull();
  });

  test("falls back to the furthest known time without durationMs", () => {
    const legacy = { ...plan, durationMs: undefined };
    expect(computeReviewSummary(legacy, null).rawMs).toBe(100_000);
  });
});

describe("bulk cut actions", () => {
  test("accept / reject all silences", () => {
    expect(setSilenceChanges(plan.cuts, true)).toEqual([
      { index: 2, accepted: true },
    ]);
    expect(setSilenceChanges(plan.cuts, false)).toEqual([]);
  });

  test("reset to the automatic plan", () => {
    const edited = plan.cuts.map((c, i) =>
      i === 1
        ? { ...c, accepted: false }
        : i === 2
          ? { ...c, accepted: true }
          : c,
    );
    expect(resetCutChanges(edited, false)).toEqual([
      { index: 1, accepted: true },
      { index: 2, accepted: false },
    ]);
    expect(resetCutChanges(edited, true)).toEqual([
      { index: 1, accepted: true },
    ]);
    expect(resetCutChanges(plan.cuts, false)).toEqual([]);
  });

  test("steps through cuts by start time", () => {
    expect(stepCut(plan.cuts, null, 35_000, 1)).toBe(2);
    expect(stepCut(plan.cuts, null, 35_000, -1)).toBe(1);
    expect(stepCut(plan.cuts, 2, 0, 1)).toBe(3);
    expect(stepCut(plan.cuts, 3, 0, 1)).toBe(3);
    expect(stepCut(plan.cuts, 0, 0, -1)).toBe(0);
    expect(stepCut([], null, 0, 1)).toBeNull();
  });
});

describe("timeline geometry", () => {
  test("boxes are percentages of the take", () => {
    expect(rangeToBox(25_000, 50_000, 100_000)).toEqual({
      leftPct: 25,
      widthPct: 25,
    });
    expect(rangeToBox(-10, 200_000, 100_000)).toEqual({
      leftPct: 0,
      widthPct: 100,
    });
    expect(rangeToBox(0, 10, 0)).toEqual({ leftPct: 0, widthPct: 0 });
  });

  test("segments, cuts, chapters and ticks", () => {
    const g = buildTimelineGeometry({
      durationMs: 100_000,
      segments: plan.segments,
      cuts: plan.cuts,
      chapters: [...plan.chapters].reverse(),
    });
    expect(g.segments[1]).toMatchObject({ leftPct: 40, widthPct: 50 });
    expect(g.cuts.map((c) => c.kind)).toEqual([
      "accepted",
      "accepted",
      "suggested",
      "accepted",
    ]);
    expect(g.cuts[2]).toMatchObject({ index: 2, leftPct: 50, widthPct: 10 });
    // Sorted by position, original index kept.
    expect(g.chapters.map((c) => [c.index, c.leftPct])).toEqual([
      [1, 2],
      [0, 45],
    ]);
    expect(g.ticks.map((t) => t.ms)).toEqual([
      0, 25_000, 50_000, 75_000, 100_000,
    ]);
  });

  test("click position → time", () => {
    expect(fractionToMs(0.5, 100_000)).toBe(50_000);
    expect(fractionToMs(-1, 100_000)).toBe(0);
    expect(fractionToMs(2, 100_000)).toBe(100_000);
  });

  test("player ↔ original mapping with the intro offset", () => {
    const intro = 3_000;
    // Intro → first kept frame
    expect(playerMsToOriginalMs(1_000, intro, plan.segments)).toBe(2_000);
    expect(
      playerMsToOriginalMs(3_000 + 28_000 + 5_000, intro, plan.segments),
    ).toBe(45_000);
    // Outro → end of the last kept part
    expect(playerMsToOriginalMs(999_000, intro, plan.segments)).toBe(90_000);
    expect(originalMsToPlayerMs(45_000, intro, plan.segments)).toBe(36_000);
    // Inside a cut → snaps to the next kept part
    expect(originalMsToPlayerMs(35_000, intro, plan.segments)).toBe(31_000);
    expect(originalMsToPlayerMs(95_000, intro, plan.segments)).toBeNull();
  });
});

describe("chapters", () => {
  const opts = {
    durationMs: plan.durationMs as number,
    segments: plan.segments,
  };

  test("errors and inside-cut warnings", () => {
    const checks = validateChapters(
      [
        { timeMs: 2_000, title: "A" },
        { timeMs: 35_000, title: "Inside marker cut" },
        { timeMs: 40_000, title: "Same as relocated" },
        { timeMs: null, title: "x" },
        { timeMs: 200_000, title: "y" },
        { timeMs: 95_000, title: "" },
      ],
      opts,
    );
    expect(checks[0]).toEqual({ errors: [], insideCut: null });
    expect(checks[1]).toEqual({
      errors: ["duplicateTime"],
      insideCut: { movedToMs: 40_000 },
    });
    expect(checks[2]?.errors).toEqual(["duplicateTime"]);
    expect(checks[3]?.errors).toEqual(["invalidTime"]);
    expect(checks[4]?.errors).toEqual(["outOfRange"]);
    expect(checks[5]).toEqual({
      errors: ["emptyTitle"],
      insideCut: { movedToMs: null },
    });
  });

  test("exact duplicates", () => {
    const checks = validateChapters(
      [
        { timeMs: 10_000, title: "a" },
        { timeMs: 10_000, title: "b" },
      ],
      opts,
    );
    expect(checks.every((c) => c.errors.includes("duplicateTime"))).toBe(true);
  });

  test("sorts by time, invalid last", () => {
    expect(
      sortChapterDrafts([
        { timeMs: null, k: "n" },
        { timeMs: 5, k: "b" },
        { timeMs: 1, k: "a" },
      ]).map((d) => d.k),
    ).toEqual(["a", "b", "n"]);
  });
});

describe("YouTube chapters", () => {
  test("00:00 Title lines, sorted", () => {
    expect(
      formatYouTubeChapters([
        { timeMs: 13_867, title: "Khóa học có gì" },
        { timeMs: 0, title: "Bài 1: Giới thiệu" },
        { timeMs: 3_725_000, title: "Cuối" },
      ]),
    ).toBe("00:00 Bài 1: Giới thiệu\n00:13 Khóa học có gì\n1:02:05 Cuối");
  });

  test("always starts at 00:00", () => {
    expect(formatYouTubeChapters([{ timeMs: 5_000, title: "A" }])).toBe(
      "00:00 A",
    );
    expect(
      formatYouTubeChapters([{ timeMs: 5_000, title: "A" }], {
        firstTitle: "Intro",
      }),
    ).toBe("00:00 Intro\n00:05 A");
  });

  test("drops empty titles and same-second duplicates", () => {
    expect(
      formatYouTubeChapters([
        { timeMs: 0, title: "A" },
        { timeMs: 900, title: "B" },
        { timeMs: 2_000, title: "  " },
      ]),
    ).toBe("00:00 A");
    expect(formatYouTubeChapters([])).toBe("");
  });
});

describe("transcript", () => {
  const glossary = [
    { term: "C#", aliases: ["C sáp", "C Sharp"] },
    { term: "ASP.NET Core", aliases: ["asp dot net core"] },
  ];

  test("search ignores case and Vietnamese diacritics", () => {
    expect(matchesQuery("Đường dẫn tệp", "duong dan")).toBe(true);
    expect(matchesQuery("Đường dẫn tệp", "TỆP")).toBe(true);
    expect(matchesQuery("Đường dẫn", "xyz")).toBe(false);
    expect(matchesQuery("anything", "  ")).toBe(true);
    expect(findRanges("Học Đường đi", "duong")).toEqual([{ start: 4, end: 9 }]);
    expect(findRanges("cat concat", "cat", true)).toEqual([
      { start: 0, end: 3 },
    ]);
  });

  test("tokens mark glossary terms, aliases, low confidence and search", () => {
    const tokens = buildLineTokens(
      [
        word("Học"),
        word(" C", 0.3),
        word(" sáp"),
        word(" và"),
        word(" ASP.NET"),
        word(" Core"),
      ],
      { glossary, query: "và" },
    );
    const alias = tokens
      .filter((t) => t.aliasOf === "C#")
      .map((t) => t.text)
      .join("");
    expect(alias).toBe("C sáp");
    expect(tokens.some((t) => t.text === "C" && t.lowConfidence)).toBe(true);
    expect(tokens.find((t) => t.search)?.text).toBe("và");
    expect(
      tokens
        .filter((t) => t.term === "ASP.NET Core")
        .map((t) => t.text)
        .join(""),
    ).toBe("ASP.NET Core");
    // Text is preserved exactly.
    expect(tokens.map((t) => t.text).join("")).toBe(
      "Học C sáp và ASP.NET Core",
    );
  });

  test("fixAliases replaces known misspellings", () => {
    expect(fixAliases("Học C sáp và asp dot net core", glossary)).toBe(
      "Học C# và ASP.NET Core",
    );
    expect(fixAliases("Không có gì", glossary)).toBe("Không có gì");
  });
});

describe("ETA", () => {
  const createdAt = "2026-10-25T10:00:00.000Z";
  const start = Date.parse(createdAt);
  test("extrapolates from progress", () => {
    expect(
      estimateRemainingMs({ progress: 0.25, createdAt }, start + 30_000),
    ).toBe(90_000);
  });
  test("unknown with too little progress or time", () => {
    expect(
      estimateRemainingMs({ progress: 0.01, createdAt }, start + 30_000),
    ).toBeNull();
    expect(
      estimateRemainingMs({ progress: 0.5, createdAt }, start + 1_000),
    ).toBeNull();
    expect(
      estimateRemainingMs({ progress: 1, createdAt }, start + 60_000),
    ).toBeNull();
  });
});

describe("draftToChapter", () => {
  const draft = (over: Partial<ChapterDraft>): ChapterDraft => ({
    key: "k",
    timeMs: 29_650,
    timeText: "00:29",
    title: " X ",
    savedTimeMs: 29_650,
    requestedTimeMs: 25_000,
    ...over,
  });

  test("keeps the requested time of an untouched displaced chapter", () => {
    expect(draftToChapter(draft({}))).toEqual({
      timeMs: 29_650,
      title: "X",
      requestedTimeMs: 25_000,
    });
  });

  test("an edited time replaces the requested time", () => {
    expect(draftToChapter(draft({ timeMs: 40_000 }))).toEqual({
      timeMs: 40_000,
      title: "X",
    });
  });

  test("new chapters have no requested time", () => {
    expect(
      draftToChapter(
        draft({ savedTimeMs: undefined, requestedTimeMs: undefined }),
      ),
    ).toEqual({ timeMs: 29_650, title: "X" });
  });
});
