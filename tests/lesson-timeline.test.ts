import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import {
  framePieceToOriginalSegment,
  getOutputDurationMs,
  getSegmentRangeIfFirstPiece,
  mapChapters,
  mapOriginalToOutput,
  mapOriginalToOutputSnapped,
  mapOutputToOriginal,
  normalizeSegments,
  remapCaptions,
  segmentsToFramePieces,
} from "../remotion/lesson/timeline";

// Keep 1s-3s and 5s-6s of the take.
const segments = [
  { startMs: 1000, endMs: 3000 },
  { startMs: 5000, endMs: 6000 },
];

const word = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: 1,
});

describe("normalizeSegments", () => {
  test("sorts, clamps, merges and drops empty segments", () => {
    expect(
      normalizeSegments(
        [
          { startMs: 5000, endMs: 9000 },
          { startMs: -100, endMs: 1000 },
          { startMs: 800, endMs: 1500 },
          { startMs: 2000, endMs: 2000 },
        ],
        8000,
      ),
    ).toEqual([
      { startMs: 0, endMs: 1500 },
      { startMs: 5000, endMs: 8000 },
    ]);
  });

  test("output duration", () => {
    expect(getOutputDurationMs(segments)).toBe(3000);
  });
});

describe("mapOriginalToOutput", () => {
  test("maps times inside segments", () => {
    expect(mapOriginalToOutput(1000, segments)).toBe(0);
    expect(mapOriginalToOutput(2500, segments)).toBe(1500);
    expect(mapOriginalToOutput(5000, segments)).toBe(2000);
    expect(mapOriginalToOutput(5500, segments)).toBe(2500);
    expect(mapOriginalToOutput(6000, segments)).toBe(3000);
  });

  test("returns null inside cuts", () => {
    expect(mapOriginalToOutput(0, segments)).toBeNull();
    expect(mapOriginalToOutput(4000, segments)).toBeNull();
    expect(mapOriginalToOutput(3000, segments)).toBeNull();
    expect(mapOriginalToOutput(7000, segments)).toBeNull();
  });

  test("snapped variant moves into the next segment", () => {
    expect(mapOriginalToOutputSnapped(0, segments)).toBe(0);
    expect(mapOriginalToOutputSnapped(4000, segments)).toBe(2000);
    expect(mapOriginalToOutputSnapped(7000, segments)).toBeNull();
  });
});

describe("mapOutputToOriginal", () => {
  test("maps output times back into the kept segments", () => {
    expect(mapOutputToOriginal(0, segments)).toBe(1000);
    expect(mapOutputToOriginal(1500, segments)).toBe(2500);
    expect(mapOutputToOriginal(2000, segments)).toBe(5000);
    expect(mapOutputToOriginal(2500, segments)).toBe(5500);
  });

  test("is the inverse of mapOriginalToOutput inside segments", () => {
    for (const ms of [1000, 1999, 2999, 5000, 5999]) {
      const out = mapOriginalToOutput(ms, segments) as number;
      expect(mapOutputToOriginal(out, segments)).toBe(ms);
    }
  });

  test("clamps outside the output and handles no segments", () => {
    expect(mapOutputToOriginal(-100, segments)).toBe(1000);
    expect(mapOutputToOriginal(3000, segments)).toBe(6000);
    expect(mapOutputToOriginal(9999, segments)).toBe(6000);
    expect(mapOutputToOriginal(10, [])).toBeNull();
  });
});

describe("remapCaptions", () => {
  test("drops words inside cuts and shifts the rest", () => {
    const captions = [
      word("before", 200, 600),
      word(" hello", 1200, 1500),
      word(" world", 2800, 3400),
      word(" cut", 3500, 4000),
      word(" again", 5100, 5300),
    ];

    expect(remapCaptions(captions, segments)).toEqual([
      word(" hello", 200, 500),
      // clamped to the end of its segment
      { ...word(" world", 1800, 2000), timestampMs: 1800 },
      word(" again", 2100, 2300),
    ]);
  });

  test("keeps null timestamps", () => {
    const [c] = remapCaptions(
      [{ ...word("x", 1500, 1600), timestampMs: null }],
      segments,
    );
    expect(c?.timestampMs).toBeNull();
  });
});

describe("mapChapters", () => {
  test("maps, snaps and dedupes chapters", () => {
    expect(
      mapChapters(
        [
          { timeMs: 5500, title: "Second" },
          { timeMs: 0, title: "Intro" },
          { timeMs: 1000, title: "First" },
          { timeMs: 3500, title: "In cut" },
          { timeMs: 9000, title: "After end" },
        ],
        segments,
      ),
    ).toEqual([
      { timeMs: 0, title: "First" },
      { timeMs: 2000, title: "In cut" },
      { timeMs: 2500, title: "Second" },
    ]);
  });
});

describe("segmentsToFramePieces", () => {
  test("creates one piece per segment without chapters", () => {
    expect(segmentsToFramePieces({ segments, chapters: [], fps: 30 })).toEqual([
      {
        from: 0,
        durationInFrames: 60,
        trimBefore: 30,
        trimAfter: 90,
        chapter: null,
        segmentIndex: 0,
      },
      {
        from: 60,
        durationInFrames: 30,
        trimBefore: 150,
        trimAfter: 180,
        chapter: null,
        segmentIndex: 1,
      },
    ]);
  });

  test("splits pieces at chapters", () => {
    const pieces = segmentsToFramePieces({
      segments,
      chapters: [
        { timeMs: 1000, title: "A" },
        { timeMs: 2000, title: "B" },
      ],
      fps: 30,
    });
    expect(pieces).toEqual([
      {
        from: 0,
        durationInFrames: 30,
        trimBefore: 30,
        trimAfter: 60,
        chapter: "A",
        segmentIndex: 0,
      },
      {
        from: 30,
        durationInFrames: 30,
        trimBefore: 60,
        trimAfter: 90,
        chapter: "B",
        segmentIndex: 0,
      },
      {
        from: 60,
        durationInFrames: 30,
        trimBefore: 150,
        trimAfter: 180,
        chapter: null,
        segmentIndex: 1,
      },
    ]);
    expect(framePieceToOriginalSegment(pieces[1]!, 30)).toEqual({
      startMs: 2000,
      endMs: 3000,
    });
    // Captions are attached per segment: first piece covers the whole segment
    expect(getSegmentRangeIfFirstPiece(pieces, 0, 30)).toEqual({
      startMs: 1000,
      endMs: 3000,
    });
    expect(getSegmentRangeIfFirstPiece(pieces, 1, 30)).toBeNull();
    expect(getSegmentRangeIfFirstPiece(pieces, 2, 30)).toEqual({
      startMs: 5000,
      endMs: 6000,
    });
  });

  test("has no drift with fractional frame durations", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 517,
    }));
    const pieces = segmentsToFramePieces({
      segments: many,
      chapters: [],
      fps: 30,
    });
    const total = pieces.reduce((a, p) => a + p.durationInFrames, 0);
    expect(total).toBe(Math.round((getOutputDurationMs(many) / 1000) * 30));
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i]!.from).toBe(
        pieces[i - 1]!.from + pieces[i - 1]!.durationInFrames,
      );
    }
  });
});
