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

  test("pauses at the edges win over whisper's edge timestamps", () => {
    // Whisper stretches the first/last words over the surrounding silence.
    expect(
      computeTrim({
        durationMs: 20_000,
        silences: [
          { startMs: 0, endMs: 2000 },
          { startMs: 17_000, endMs: 20_000 },
        ],
        captions: [word("Hello", 0, 2500), word(" world.", 2500, 19_990)],
      }),
    ).toEqual({ trimStartMs: 1650, trimEndMs: 17_250 });
  });

  test("no edge pause: that edge is not trimmed (captions ignored)", () => {
    expect(
      computeTrim({
        durationMs: 20_000,
        silences: [{ startMs: 8000, endMs: 11_000 }],
        captions: [word("Hello", 3000, 3500), word(" world.", 3600, 15_000)],
      }),
    ).toEqual({ trimStartMs: 0, trimEndMs: 20_000 });
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
  test("removes from inside the latest preceding pause", () => {
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
    ).toEqual(cut(10_250, 20_000, true, "marker"));
  });

  test("marker inside a pause: the mistake ends where the pause starts", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 20_400 },
        [
          { startMs: 12_400, endMs: 14_550 },
          { startMs: 19_300, endMs: 21_260 },
        ],
        60_000,
      ),
    ).toEqual(cut(12_650, 20_910, true, "marker"));
  });

  test("marker shortly after a pause counts as pressed in it", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 21_600 },
        [
          { startMs: 12_400, endMs: 14_550 },
          { startMs: 19_300, endMs: 21_260 },
        ],
        60_000,
      ),
    ).toEqual(cut(12_650, 20_910, true, "marker"));
  });

  test("short pauses count (no 2.5 s detection minimum)", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 20_000 },
        [{ startMs: 14_000, endMs: 14_600 }],
        60_000,
      ),
    ).toEqual(cut(14_250, 20_000, true, "marker"));
  });

  test("pauses more than 30 s before the mistake are ignored", () => {
    expect(
      markerCut(
        { type: "cut", timeMs: 40_000 },
        [{ startMs: 2000, endMs: 5000 }],
        60_000,
      ),
    ).toEqual(cut(37_000, 40_000, true, "marker"));
  });

  test("without a pause only 3 s are removed", () => {
    expect(markerCut({ type: "cut", timeMs: 30_000 }, [], 60_000)).toEqual(
      cut(27_000, 30_000, true, "marker"),
    );
  });

  test("clamps at 0", () => {
    expect(markerCut({ type: "cut", timeMs: 2000 }, [], 60_000)).toEqual(
      cut(0, 2000, true, "marker"),
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
    // silence cut 10250..13650 and marker cut 10250..20000 merge.
    expect(plan.cuts).toEqual([cut(10_250, 20_000, true, "marker")]);
    expect(plan.segments).toEqual([
      { startMs: 0, endMs: 10_250 },
      { startMs: 20_000, endMs: 60_000 },
    ]);
  });

  test("cut marker in a pause without an earlier pause: 3 s + the pause", () => {
    const plan = buildEditPlan(
      base({
        preset: "balanced",
        silences: [{ startMs: 30_000, endMs: 36_000 }],
        markers: [{ type: "cut", timeMs: 33_000 }],
      }),
    );
    // Mistake ends at 30 s, no earlier pause → 27 s; the cut runs to the end
    // of the pause, which also covers the silence suggestion.
    expect(plan.cuts).toEqual([cut(27_000, 35_650, true, "marker")]);
    expect(plan.segments).toEqual([
      { startMs: 0, endMs: 27_000 },
      { startMs: 35_650, endMs: 60_000 },
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
          { type: "chapter", timeMs: 28_000, title: "Part 2" },
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

// A real 94 s Vietnamese take (net-backend-zero-senior / bai-1): speech
// [2140,12396] [14548,19299] [21258,32798] [43709,64295] [66421,81602]
// [83722,90524] plus sentence pauses. [14548,19299] is a verbal slip
// ("… à không, xin lỗi, mình nói nhầm") followed by a cut marker at 20405.
// `silences` = silencedetect (-38 dB, d=0.5 s) of that take.
describe("buildEditPlan on a real take", () => {
  const pauses: [number, number][] = [
    [0, 2140],
    [7216, 7902],
    [12396, 14548],
    [19299, 21258],
    [23886, 24556],
    [27817, 28482],
    [32798, 43709],
    [47668, 48331],
    [49916, 50611],
    [53275, 53976],
    [56207, 56871],
    [59898, 60574],
    [64295, 66421],
    [81602, 83722],
    [88007, 88677],
    [90524, 94333],
  ];
  const silences = pauses.map(([startMs, endMs]) => ({ startMs, endMs }));
  const markers = [
    { type: "cut", timeMs: 20_405 },
    { type: "chapter", timeMs: 20_805, title: "Khóa học có gì" },
    { type: "chapter", timeMs: 43_280, title: "Lộ trình 5 giai đoạn" },
    { type: "important", timeMs: 49_580 },
    { type: "chapter", timeMs: 65_990, title: "Dự án CRM xuyên suốt" },
    { type: "chapter", timeMs: 83_300, title: "Bắt đầu học" },
  ] as const;
  // Whisper's own timestamps: the first word at 0 ms, a hallucinated
  // sentence running to the very end.
  const captions = [
    word("Xin", 0, 350),
    word(" chào", 350, 930),
    word(" theo.", 90_660, 91_000),
    word(" Các", 91_000, 91_340),
    word(" dẫn.", 94_330, 94_330),
  ];

  test("conservative", () => {
    const plan = buildEditPlan(
      base({
        durationMs: 94_333,
        silences: silences.map((s) => ({ ...s })),
        markers: markers.map((m) => ({ ...m })),
        captions,
      }),
    );
    expect(plan.cuts).toEqual([
      // Leading silence, keeping 350 ms before the first word.
      cut(0, 1790, true, "trim"),
      // The slip: from the pause before it (after a 250 ms tail of the intro
      // sentence) to the end of the pause the marker was pressed in.
      cut(12_646, 20_908, true, "marker"),
      // The 10.9 s pause is only suggested.
      cut(33_048, 43_359, false, "silence"),
      // Trailing silence (and the hallucinated sentence in it).
      cut(90_774, 94_333, true, "trim"),
    ]);
    expect(plan.segments).toEqual([
      { startMs: 1790, endMs: 12_646 },
      { startMs: 20_908, endMs: 90_774 },
    ]);
    expect(plan.chapters.map((c) => c.timeMs)).toEqual([
      20_908, 43_280, 65_990, 83_300,
    ]);
  });

  test("balanced suggests the sentence pauses ≥ 3 s only", () => {
    const plan = buildEditPlan(
      base({
        durationMs: 94_333,
        preset: "balanced",
        silences: silences.map((s) => ({ ...s })),
        markers: markers.map((m) => ({ ...m })),
      }),
    );
    expect(plan.cuts.filter((c) => c.reason === "silence")).toEqual([
      cut(33_048, 43_359, false, "silence"),
    ]);
  });

  test("aggressive also suggests the ~2 s pauses", () => {
    const plan = buildEditPlan(
      base({
        durationMs: 94_333,
        preset: "aggressive",
        silences: silences.map((s) => ({ ...s })),
        markers: markers.map((m) => ({ ...m })),
      }),
    );
    expect(plan.cuts.filter((c) => c.reason === "silence")).toEqual([
      cut(33_048, 43_359, false, "silence"),
      cut(64_545, 66_071, false, "silence"),
      cut(81_852, 83_372, false, "silence"),
    ]);
  });
});
