import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import { VIDEO_PALETTES, withAlpha } from "../config/themes";
import {
  calculateSrt,
  groupCaptionsIntoCues,
  wrapCueText,
} from "../remotion/captions/srt/helpers/calculate-srt";
import {
  LESSON_STRINGS,
  chapterTitleOrFallback,
  getLessonStrings,
  parseLessonTitle,
} from "../remotion/lesson/i18n";
import {
  computeLessonTimeline,
  getBodyChapters,
  getOutputChapters,
  segmentsToFramePieces,
} from "../remotion/lesson/timeline";
import { buildTranscriptMarkdown } from "../scripts/server/render/subtitles";

const w = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: 1,
});

describe("computeLessonTimeline", () => {
  const base = {
    introDurationInFrames: 105,
    bodyDurationInFrames: 2422,
    outroDurationInFrames: 120,
    transitionDurationInFrames: 18,
  };

  test("fade overlaps intro/body and body/outro", () => {
    const t = computeLessonTimeline({ ...base, transition: "fade" });
    expect(t.introOverlapInFrames).toBe(18);
    expect(t.outroOverlapInFrames).toBe(18);
    expect(t.bodyStartFrame).toBe(87);
    expect(t.outroStartFrame).toBe(87 + 2422 - 18);
    expect(t.totalDurationInFrames).toBe(105 + 2422 + 120 - 2 * 18);
    expect(t.cutFrames).toEqual([96, 2491 + 9]);
  });

  test("slide behaves like fade", () => {
    const fade = computeLessonTimeline({ ...base, transition: "fade" });
    const slide = computeLessonTimeline({ ...base, transition: "slide" });
    expect(slide).toEqual(fade);
  });

  test("none and light-leak keep hard cuts (no overlap)", () => {
    for (const transition of ["none", "light-leak"] as const) {
      const t = computeLessonTimeline({ ...base, transition });
      expect(t.bodyStartFrame).toBe(105);
      expect(t.outroStartFrame).toBe(105 + 2422);
      expect(t.totalDurationInFrames).toBe(105 + 2422 + 120);
      expect(t.cutFrames).toEqual([105, 2527]);
    }
  });

  test("no intro / no outro", () => {
    const t = computeLessonTimeline({
      ...base,
      introDurationInFrames: 0,
      outroDurationInFrames: 0,
      transition: "fade",
    });
    expect(t.bodyStartFrame).toBe(0);
    expect(t.outroStartFrame).toBeNull();
    expect(t.totalDurationInFrames).toBe(2422);
    expect(t.cutFrames).toEqual([]);
  });

  test("overlap never exceeds half of a short part", () => {
    const t = computeLessonTimeline({
      ...base,
      bodyDurationInFrames: 20,
      transition: "fade",
    });
    expect(t.introOverlapInFrames).toBe(10);
    expect(t.outroOverlapInFrames).toBe(10);
    expect(t.totalDurationInFrames).toBe(105 + 20 + 120 - 20);
  });
});

describe("body / output chapters", () => {
  // The real lesson: two segments, chapters at the start of segment 2 and later.
  const segments = [
    { startMs: 1790, endMs: 12646 },
    { startMs: 20908, endMs: 90774 },
  ];
  const chapters = [
    { timeMs: 20908, title: "Khóa học có gì" },
    { timeMs: 43280, title: "Lộ trình 5 giai đoạn" },
    { timeMs: 65990, title: "Dự án CRM xuyên suốt" },
    { timeMs: 83300, title: "Bắt đầu học" },
  ];
  const pieces = segmentsToFramePieces({ segments, chapters, fps: 30 });

  test("chapters relative to the body, with durations", () => {
    const body = getBodyChapters(pieces);
    expect(body.map((c) => c.fromFrame)).toEqual([326, 997, 1678, 2197]);
    expect(body.map((c) => c.index)).toEqual([0, 1, 2, 3]);
    expect(body.every((c) => c.total === 4)).toBe(true);
    expect(body[0]?.durationInFrames).toBe(997 - 326);
    expect(body[3]?.durationInFrames).toBe(2422 - 2197);
  });

  test("output chapters are shifted by the body start (intro − overlap)", () => {
    const body = getBodyChapters(pieces);
    const out = getOutputChapters({
      bodyChapters: body,
      bodyStartFrame: 87,
      fps: 30,
    });
    expect(out).toEqual([
      { timeMs: Math.round((413 / 30) * 1000), title: "Khóa học có gì" },
      { timeMs: Math.round((1084 / 30) * 1000), title: "Lộ trình 5 giai đoạn" },
      { timeMs: Math.round((1765 / 30) * 1000), title: "Dự án CRM xuyên suốt" },
      { timeMs: Math.round((2284 / 30) * 1000), title: "Bắt đầu học" },
    ]);
  });
});

describe("i18n", () => {
  test("strings for both languages, vi by default", () => {
    expect(getLessonStrings("vi").thanksForWatching).toBe(
      "Cảm ơn bạn đã theo dõi",
    );
    expect(getLessonStrings("en").thanksForWatching).toBe(
      "Thanks for watching",
    );
    expect(getLessonStrings(undefined)).toBe(LESSON_STRINGS.vi);
    expect(getLessonStrings("fr")).toBe(LESSON_STRINGS.vi);
    expect(LESSON_STRINGS.vi.chapterProgress(2, 4)).toBe("Chương 2/4");
    expect(LESSON_STRINGS.en.chapterProgress(2, 4)).toBe("Chapter 2/4");
  });

  test("both dictionaries have the same keys", () => {
    expect(Object.keys(LESSON_STRINGS.en).sort()).toEqual(
      Object.keys(LESSON_STRINGS.vi).sort(),
    );
  });

  test("parseLessonTitle splits the lesson label", () => {
    expect(parseLessonTitle("Bài 1: Giới thiệu khóa học")).toEqual({
      label: "Bài 1",
      title: "Giới thiệu khóa học",
    });
    expect(parseLessonTitle("Lesson 12 — Dependency injection")).toEqual({
      label: "Lesson 12",
      title: "Dependency injection",
    });
    expect(parseLessonTitle("Giới thiệu")).toEqual({
      label: null,
      title: "Giới thiệu",
    });
  });

  test("fallback chapter titles", () => {
    expect(chapterTitleOrFallback("  ", 1, "vi")).toBe("Chương 2");
    expect(chapterTitleOrFallback("", 0, "en")).toBe("Chapter 1");
    expect(chapterTitleOrFallback(" Setup ", 0, "en")).toBe("Setup");
  });
});

describe("SRT cue grouping", () => {
  test("never spans a pause ≥ 1.2 s", () => {
    const cues = groupCaptionsIntoCues([
      w(" và", 23_000, 23_200),
      w(" mỗi", 23_200, 23_400),
      w(" bài.", 23_400, 23_900),
      w(" Lộ", 34_000, 34_300),
      w(" trình", 34_300, 34_700),
    ]);
    expect(cues.map((c) => c.map((x) => x.text.trim()).join(" "))).toEqual([
      "và mỗi bài.",
      "Lộ trình",
    ]);
  });

  test("short pauses stay inside a cue", () => {
    const cues = groupCaptionsIntoCues([w(" a", 0, 200), w(" b", 1300, 1500)]);
    expect(cues).toHaveLength(1);
  });

  test("caps cue duration at 7 s", () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      w(" x", i * 600, i * 600 + 500),
    );
    const cues = groupCaptionsIntoCues(words);
    for (const cue of cues) {
      const first = cue[0] as Caption;
      const last = cue[cue.length - 1] as Caption;
      expect(last.endMs - first.startMs).toBeLessThanOrEqual(7000);
    }
    expect(cues.flat()).toHaveLength(20);
  });

  test("caps cues at two lines of 42 chars", () => {
    const words = Array.from({ length: 40 }, (_, i) =>
      w(" word", i * 100, i * 100 + 90),
    );
    const cues = groupCaptionsIntoCues(words);
    for (const cue of cues) {
      const text = cue.map((x) => x.text.trim()).join(" ");
      expect(text.length).toBeLessThanOrEqual(84);
    }
  });

  test("breaks after a sentence once the cue is long enough", () => {
    const cues = groupCaptionsIntoCues([
      w(" Hôm", 0, 200),
      w(" nay", 200, 400),
      w(" là", 400, 600),
      w(" buổi", 600, 800),
      w(" khai", 800, 1000),
      w(" giảng.", 1000, 1400),
      w(" Mình", 1500, 1700),
      w(" sẽ", 1700, 1900),
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[1]?.[0]?.text).toBe(" Mình");
  });

  test("a full cue ends at the last punctuation of its second half", () => {
    const text =
      "Xin chào các bạn, chào mừng các bạn đến với khóa học .NET backend, từ zero đến senior.";
    const words = text
      .split(" ")
      .map((t, i) => w(` ${t}`, i * 250, i * 250 + 200));
    const cues = groupCaptionsIntoCues(words).map((c) =>
      c.map((x) => x.text.trim()).join(" "),
    );
    expect(cues).toEqual([
      "Xin chào các bạn, chào mừng các bạn đến với khóa học .NET backend,",
      "từ zero đến senior.",
    ]);
  });

  test("wrapCueText balances two lines", () => {
    expect(wrapCueText("short")).toBe("short");
    const wrapped = wrapCueText(
      "Mỗi bài học đều có bài tập kèm lời giải, và có câu hỏi tự kiểm tra",
    );
    const lines = wrapped.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 42)).toBe(true);
  });

  test("calculateSrt: timestamps follow words, text is wrapped", () => {
    const srt = calculateSrt({
      captions: [
        w(" Xin", 1000, 1200),
        w(" chào", 1200, 1500),
        w(" các", 4000, 4200),
        w(" bạn.", 4200, 4600),
      ],
      startFrame: 0,
      fps: 30,
    });
    expect(
      srt.map((s) => [s.firstTimestampMs, s.lastTimestampMs, s.text]),
    ).toEqual([
      [1000, 1500, "Xin chào"],
      [4000, 4600, "các bạn."],
    ]);
  });
});

describe("transcript.md localization", () => {
  const plan = {
    segments: [{ startMs: 0, endMs: 10_000 }],
    chapters: [{ timeMs: 5000, title: "Main" }],
  };
  const captions = [w(" Hello.", 1000, 1500), w(" Part", 6000, 6500)];

  test('text before the first chapter goes under "Mở đầu" / "Intro"', () => {
    expect(
      buildTranscriptMarkdown({ title: "T", captions, plan, language: "vi" }),
    ).toBe("# T\n\n## Mở đầu\n\nHello.\n\n## Main\n\nPart\n");
    expect(
      buildTranscriptMarkdown({ title: "T", captions, plan, language: "en" }),
    ).toBe("# T\n\n## Intro\n\nHello.\n\n## Main\n\nPart\n");
  });
});

describe("video palettes", () => {
  test("dotnet matches the course site purple", () => {
    expect(VIDEO_PALETTES.dotnet.brandFrom).toBe("#7C5CE0");
  });

  test("opaque palette colors are hex (WebGL effects parse them)", () => {
    for (const palette of Object.values(VIDEO_PALETTES)) {
      for (const key of [
        "brandFrom",
        "brandTo",
        "accent",
        "background",
      ] as const) {
        expect(palette[key]).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  test("withAlpha", () => {
    expect(withAlpha("#7C5CE0", 0.5)).toBe("rgba(124, 92, 224, 0.5)");
  });
});
