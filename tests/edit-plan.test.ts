import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import { editPlan } from "../config/course";
import type {
  BuildEditPlanInput,
  Cut,
} from "../scripts/server/production/edit-plan";
import {
  applyEditPlanPatch,
  buildEditPlan,
  computeTrim,
  markerCut,
  normalizeCuts,
  recomputeSegments,
  relocateChapters,
  resolvePlanDurationMs,
} from "../scripts/server/production/edit-plan";

const word = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: null,
});

const base = (over: Partial<BuildEditPlanInput> = {}): BuildEditPlanInput => ({
  takeId: "123",
  durationMs: 60_000,
  silences: [],
  markers: [],
  captions: null,
  preset: "conservative",
  autoRemoveSilence: false,
  lessonTitle: "Intro to React",
  moduleTitle: "Basics",
  courseName: "React Course",
  hasWebcam: false,
  generateChapters: true,
  intro: true,
  outro: true,
  ...over,
});

const cut = (
  startMs: number,
  endMs: number,
  accepted = true,
  reason: Cut["reason"] = "silence",
): Cut => ({ startMs, endMs, accepted, reason });

describe("recomputeSegments", () => {
  test("no cuts keeps everything", () => {
    expect(recomputeSegments(10_000, [])).toEqual([
      { startMs: 0, endMs: 10_000 },
    ]);
  });

  test("complement of accepted cuts only", () => {
    expect(
      recomputeSegments(10_000, [cut(2000, 3000), cut(5000, 6000, false)]),
    ).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 3000, endMs: 10_000 },
    ]);
  });

  test("overlapping and adjacent cuts are merged", () => {
    expect(
      recomputeSegments(10_000, [
        cut(2000, 4000),
        cut(3000, 5000),
        cut(5000, 6000),
      ]),
    ).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 6000, endMs: 10_000 },
    ]);
  });

  test("segments shorter than 500 ms are dropped", () => {
    expect(recomputeSegments(10_000, [cut(0, 1000), cut(1400, 9700)])).toEqual(
      [],
    );
  });

  test("cuts outside the duration are clamped", () => {
    expect(recomputeSegments(5000, [cut(-100, 1000), cut(4000, 9000)])).toEqual(
      [{ startMs: 1000, endMs: 4000 }],
    );
  });

  test("zero duration", () => {
    expect(recomputeSegments(0, [])).toEqual([]);
  });
});

describe("normalizeCuts", () => {
  test("merges accepted cuts with reason priority", () => {
    expect(
      normalizeCuts(
        [cut(0, 2000, true, "trim"), cut(1500, 3000, true, "silence")],
        10_000,
      ),
    ).toEqual([cut(0, 3000, true, "trim")]);
  });

  test("suggestions covered by accepted cuts are removed or clipped", () => {
    const out = normalizeCuts(
      [
        cut(0, 3000, true, "trim"),
        cut(1000, 2000, false), // fully covered
        cut(2500, 6000, false), // partially covered → 3000..6000
        cut(5800, 7000, true, "marker"), // splits remainder
      ],
      10_000,
    );
    expect(out).toEqual([
      cut(0, 3000, true, "trim"),
      cut(3000, 5800, false),
      cut(5800, 7000, true, "marker"),
    ]);
  });

  test("tiny suggestion remainders are dropped", () => {
    expect(
      normalizeCuts([cut(0, 3000, true), cut(2000, 3300, false)], 10_000),
    ).toEqual([cut(0, 3000, true)]);
  });

  test("overlapping suggestions merge", () => {
    expect(
      normalizeCuts([cut(1000, 3000, false), cut(2000, 4000, false)], 10_000),
    ).toEqual([cut(1000, 4000, false)]);
  });
});

describe("computeTrim", () => {
  test("uses first/last caption words with padding", () => {
    expect(
      computeTrim({
        durationMs: 20_000,
        silences: [],
        captions: [
          word(" ", 0, 10),
          word(" Hello", 3000, 3500),
          word(" world", 3600, 15_000),
        ],
      }),
    ).toEqual({ trimStartMs: 2650, trimEndMs: 15_250 });
  });

  test("falls back to leading/trailing silences", () => {
    expect(
      computeTrim({
        durationMs: 20_000,
        silences: [
          { startMs: 0, endMs: 4000 },
          { startMs: 8000, endMs: 11_000 },
          { startMs: 17_000, endMs: 20_000 },
        ],
        captions: null,
      }),
    ).toEqual({ trimStartMs: 3650, trimEndMs: 17_250 });
  });

  test("never trims everything", () => {
    expect(
      computeTrim({
        durationMs: 5000,
        silences: [{ startMs: 0, endMs: 5000 }],
        captions: null,
      }),
    ).toEqual({ trimStartMs: 0, trimEndMs: 5000 });
  });
});

describe("markerCut", () => {
  test("removes from the latest preceding silence end", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 20_000 },
        [
          { startMs: 2000, endMs: 5000 },
          { startMs: 10_000, endMs: 12_000 },
          { startMs: 21_000, endMs: 23_000 },
        ],
        60_000,
      ),
    ).toEqual(cut(12_000, 20_000, true, "marker"));
  });

  test("falls back to 15 s before the marker", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 40_000 },
        [{ startMs: 2000, endMs: 5000 }],
        60_000,
      ),
    ).toEqual(cut(25_000, 40_000, true, "marker"));
  });

  test("clamps at 0", () => {
    expect(markerCut({ type: "cut", timeMs: 4000 }, [], 60_000)).toEqual(
      cut(0, 4000, true, "marker"),
    );
  });

  test("marker at 0 yields nothing", () => {
    expect(markerCut({ type: "cut", timeMs: 0 }, [], 60_000)).toBeNull();
  });
});

describe("relocateChapters", () => {
  const segments = [
    { startMs: 1000, endMs: 5000 },
    { startMs: 8000, endMs: 12_000 },
  ];
  test("moves chapters inside cuts to the next segment start", () => {
    expect(
      relocateChapters(
        [
          { timeMs: 0, title: "A" },
          { timeMs: 6000, title: "B" },
          { timeMs: 9000, title: "C" },
        ],
        segments,
      ),
    ).toEqual([
      { timeMs: 1000, title: "A" },
      { timeMs: 8000, title: "B" },
      { timeMs: 9000, title: "C" },
    ]);
  });

  test("drops chapters after the last segment and dedupes", () => {
    expect(
      relocateChapters(
        [
          { timeMs: 5500, title: "B" },
          { timeMs: 6000, title: "B2" },
          { timeMs: 13_000, title: "Z" },
        ],
        segments,
      ),
    ).toEqual([{ timeMs: 8000, title: "B" }]);
  });
});

describe("buildEditPlan", () => {
  test("no silences, no markers: whole take, one chapter, intro/outro", () => {
    const plan = buildEditPlan(base());
    expect(editPlan.parse(plan)).toEqual(plan);
    expect(plan).toEqual({
      takeId: "123",
      durationMs: 60_000,
      segments: [{ startMs: 0, endMs: 60_000 }],
      cuts: [],
      chapters: [{ timeMs: 0, title: "Intro to React" }],
      layout: "screen-only",
      intro: { title: "Intro to React", subtitle: "React Course · Basics" },
      outro: true,
    });
  });

  test("conservative: leading/trailing trim accepted, only ≥8 s silences suggested", () => {
    const plan = buildEditPlan(
      base({
        silences: [
          { startMs: 0, endMs: 3000 },
          { startMs: 10_000, endMs: 14_000 }, // 4 s → not suggested
          { startMs: 20_000, endMs: 30_000 }, // 10 s → suggested
          { startMs: 57_000, endMs: 60_000 },
        ],
      }),
    );
    expect(plan.cuts).toEqual([
      cut(0, 2650, true, "trim"),
      cut(20_250, 29_650, false, "silence"),
      cut(57_250, 60_000, true, "trim"),
    ]);
    expect(plan.segments).toEqual([{ startMs: 2650, endMs: 57_250 }]);
    // Chapter at 0 is inside the trim → moved to the first segment.
    expect(plan.chapters).toEqual([{ timeMs: 2650, title: "Intro to React" }]);
  });

  test("balanced + autoRemoveSilence accepts ≥3 s silences", () => {
    const plan = buildEditPlan(
      base({
        preset: "balanced",
        autoRemoveSilence: true,
        silences: [
          { startMs: 10_000, endMs: 12_000 }, // 2 s → ignored
          { startMs: 20_000, endMs: 24_000 }, // 4 s → accepted
        ],
      }),
    );
    expect(plan.cuts).toEqual([cut(20_250, 23_650, true, "silence")]);
    expect(plan.segments).toEqual([
      { startMs: 0, endMs: 20_250 },
      { startMs: 23_650, endMs: 60_000 },
    ]);
  });

  test("aggressive suggests ≥1.5 s silences", () => {
    const plan = buildEditPlan(
      base({
        preset: "aggressive",
        silences: [{ startMs: 10_000, endMs: 11_600 }],
      }),
    );
    expect(plan.cuts).toEqual([cut(10_250, 11_250, false, "silence")]);
    expect(plan.segments).toEqual([{ startMs: 0, endMs: 60_000 }]);
  });

  test("captions drive the trim", () => {
    const plan = buildEditPlan(
      base({
        captions: [word(" Hi", 5000, 5400), word(" there.", 5400, 50_000)],
      }),
    );
    expect(plan.segments).toEqual([{ startMs: 4650, endMs: 50_250 }]);
  });

  test("cut marker merges with an accepted silence cut", () => {
    const plan = buildEditPlan(
      base({
        preset: "balanced",
        autoRemoveSilence: true,
        silences: [{ startMs: 10_000, endMs: 14_000 }],
        markers: [{ type: "cut", timeMs: 20_000 }],
      }),
    );
    // silence cut 10250..13650, marker cut 14000..20000 → the 350 ms segment
    // between them is dropped, so the video jumps from 10250 to 20000.
    expect(plan.cuts).toEqual([
      cut(10_250, 13_650, true, "silence"),
      cut(14_000, 20_000, true, "marker"),
    ]);
    expect(plan.segments).toEqual([
      { startMs: 0, endMs: 10_250 },
      { startMs: 20_000, endMs: 60_000 },
    ]);
  });

  test("cut marker without silence removes 15 s, unaccepted silence clipped", () => {
    const plan = buildEditPlan(
      base({
        preset: "balanced",
        silences: [{ startMs: 30_000, endMs: 36_000 }],
        markers: [{ type: "cut", timeMs: 33_000 }],
      }),
    );
    // Marker: latest silence ending before 33 s within 15 s → none → 18..33 s.
    expect(plan.cuts).toEqual([
      cut(18_000, 33_000, true, "marker"),
      cut(33_000, 35_650, false, "silence"),
    ]);
    expect(plan.segments).toEqual([
      { startMs: 0, endMs: 18_000 },
      { startMs: 33_000, endMs: 60_000 },
    ]);
  });

  test("chapter markers become chapters; titles default to Chapter N", () => {
    const plan = buildEditPlan(
      base({
        hasWebcam: true,
        intro: false,
        outro: false,
        markers: [
          { type: "chapter", timeMs: 30_000 },
          { type: "chapter", timeMs: 1000, title: "Setup" },
          { type: "important", timeMs: 5000 },
        ],
      }),
    );
    expect(plan.chapters).toEqual([
      { timeMs: 1000, title: "Setup" },
      { timeMs: 30_000, title: "Chapter 2" },
    ]);
    expect(plan.layout).toBe("screen-webcam");
    expect(plan.intro).toBeNull();
    expect(plan.outro).toBe(false);
  });

  test("no chapters when generateChapters is off and no markers", () => {
    expect(buildEditPlan(base({ generateChapters: false })).chapters).toEqual(
      [],
    );
  });

  test("chapter inside a marker cut moves to the next segment", () => {
    const plan = buildEditPlan(
      base({
        markers: [
          { type: "chapter", timeMs: 25_000, title: "Part 2" },
          { type: "cut", timeMs: 30_000 },
        ],
      }),
    );
    expect(plan.chapters).toEqual([{ timeMs: 30_000, title: "Part 2" }]);
  });

  test("intro subtitle without module/course", () => {
    const plan = buildEditPlan(base({ moduleTitle: null, courseName: null }));
    expect(plan.intro).toEqual({ title: "Intro to React", subtitle: null });
  });
});

describe("applyEditPlanPatch", () => {
  test("toggling cuts recomputes segments and keeps indices stable", () => {
    const plan = buildEditPlan(
      base({ silences: [{ startMs: 20_000, endMs: 30_000 }] }),
    );
    expect(plan.cuts).toEqual([cut(20_250, 29_650, false, "silence")]);
    const next = applyEditPlanPatch(
      plan,
      { cuts: [{ index: 0, accepted: true }], layout: "screen-webcam" },
      60_000,
    );
    expect(next.cuts).toEqual([cut(20_250, 29_650, true, "silence")]);
    expect(next.segments).toEqual([
      { startMs: 0, endMs: 20_250 },
      { startMs: 29_650, endMs: 60_000 },
    ]);
    expect(next.layout).toBe("screen-webcam");
    const back = applyEditPlanPatch(
      next,
      { cuts: [{ index: 0, accepted: false }], intro: null },
      60_000,
    );
    expect(back.segments).toEqual([{ startMs: 0, endMs: 60_000 }]);
    expect(back.intro).toBeNull();
  });

  test("chapters are relocated into kept segments", () => {
    const plan = buildEditPlan(
      base({
        autoRemoveSilence: true,
        silences: [{ startMs: 20_000, endMs: 30_000 }],
      }),
    );
    const next = applyEditPlanPatch(
      plan,
      { chapters: [{ timeMs: 25_000, title: "X" }] },
      60_000,
    );
    expect(next.chapters).toEqual([{ timeMs: 29_650, title: "X" }]);
  });

  test("unknown cut index throws", () => {
    expect(() =>
      applyEditPlanPatch(
        buildEditPlan(base()),
        { cuts: [{ index: 3, accepted: true }] },
        60_000,
      ),
    ).toThrow();
  });
});

describe("resolvePlanDurationMs", () => {
  test("prefers the plan's own duration", () => {
    const plan = buildEditPlan(base());
    expect(resolvePlanDurationMs(plan, 1234)).toBe(60_000);
  });

  test("falls back to analysis.json, then the furthest known time", () => {
    const legacy = {
      ...buildEditPlan(
        base({ silences: [{ startMs: 20_000, endMs: 30_000 }] }),
      ),
      durationMs: undefined,
    };
    expect(resolvePlanDurationMs(legacy, 61_000)).toBe(61_000);
    expect(resolvePlanDurationMs(legacy, null)).toBe(60_000);
  });
});
