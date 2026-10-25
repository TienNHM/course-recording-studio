import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import {
  dropCaptionsInEdgePauses,
  fitCaptionsToPauses,
  whisperJsonToCaptions,
} from "../scripts/captions/whisper-captions";

const token = (text: string, tDtwMs: number, p = 0.9) => ({
  text,
  t_dtw: tDtwMs < 0 ? -1 : tDtwMs / 10,
  timestamps: { from: "", to: "" },
  offsets: { from: 0, to: 0 },
  id: 0,
  p,
});

const item = (
  text: string,
  from: number,
  to: number,
  tokens: ReturnType<typeof token>[],
) => ({
  text,
  offsets: { from, to },
  timestamps: { from: "", to: "" },
  tokens,
});

const cap = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: null,
});

describe("whisperJsonToCaptions", () => {
  test("one caption per word, timed by DTW, whole UTF-8 words", () => {
    const captions = whisperJsonToCaptions({
      transcription: [
        item("", 0, 0, [token("[_BEG_]", -1)]),
        // Whisper's offsets put the first word at 0 ms; DTW says 2420.
        item(" Xin", 0, 350, [token(" Xin", 2420, 0.5)]),
        item(" chào", 350, 930, [token(" ch", 2520), token("ào", 2600)]),
        item(" các", 930, 2000, [token(" các", 2820)]),
        // Long gap to the next word: own (clamped) duration.
        item(" bạn.", 2000, 9000, [token(" bạn", 3060), token(".", 8000)]),
        item(" Hôm", 9000, 9100, [token(" Hôm", 9000), token("[_TT_1]", -1)]),
      ],
    });
    expect(captions).toEqual([
      {
        text: "Xin",
        startMs: 2420,
        endMs: 2520,
        timestampMs: 2420,
        confidence: 0.5,
      },
      {
        text: " chào",
        startMs: 2520,
        endMs: 2820,
        timestampMs: 2520,
        confidence: 0.9,
      },
      {
        text: " các",
        startMs: 2820,
        endMs: 3060,
        timestampMs: 2820,
        confidence: 0.9,
      },
      {
        text: " bạn.",
        startMs: 3060,
        endMs: 4060,
        timestampMs: 3060,
        confidence: 0.9,
      },
      {
        text: " Hôm",
        startMs: 9000,
        endMs: 9200,
        timestampMs: 9000,
        confidence: 0.9,
      },
    ]);
  });

  test("falls back to offsets without DTW and keeps starts non-decreasing", () => {
    const captions = whisperJsonToCaptions({
      transcription: [
        item(" a", 1000, 1300, [token(" a", -1)]),
        item(" b", 900, 1500, [token(" b", -1)]),
      ],
    });
    expect(captions.map((c) => [c.startMs, c.endMs])).toEqual([
      [1000, 1000],
      [1000, 1600],
    ]);
  });
});

describe("dropCaptionsInEdgePauses", () => {
  const pauses = [
    { startMs: 0, endMs: 2140 },
    { startMs: 32_798, endMs: 43_709 },
    { startMs: 90_524, endMs: 94_333 },
  ];
  test("drops words deep inside the leading/trailing pause only", () => {
    const out = dropCaptionsInEdgePauses({
      durationMs: 94_333,
      pauses,
      captions: [
        cap(" Ừm", 300, 600), // hallucinated in the leading silence
        cap(" Xin", 1900, 2500), // timing slightly off: kept
        cap(" giữa", 40_000, 40_200), // mid-take pause: kept
        cap(" theo.", 90_560, 90_900), // just inside the pause: kept
        cap(" Các", 94_300, 94_300), // hallucinated
        cap(" bạn", 94_300, 94_333), // hallucinated
      ],
    });
    expect(out.map((c) => c.text)).toEqual(["Xin", " giữa", " theo."]);
  });

  test("short edge pauses are left alone", () => {
    const captions = [cap("A", 100, 200), cap(" B", 5000, 5200)];
    expect(
      dropCaptionsInEdgePauses({
        durationMs: 6000,
        pauses: [{ startMs: 0, endMs: 1000 }],
        captions,
      }),
    ).toEqual(captions);
  });
});

describe("fitCaptionsToPauses", () => {
  test("moves words out of pauses to the nearer edge", () => {
    const out = fitCaptionsToPauses({
      pauses: [
        { startMs: 12_396, endMs: 14_548 },
        { startMs: 32_798, endMs: 43_709 },
      ],
      captions: [
        cap(" quả", 12_220, 13_040),
        cap(" nhất.", 13_040, 13_380), // late: belongs before the pause
        cap(" Khóa", 14_700, 14_880),
        cap(" bài.", 32_760, 33_760), // runs into the pause
        cap(" Lộ", 43_420, 44_100), // early: belongs after the pause
      ],
    });
    expect(out.map((c) => [c.text, c.startMs, c.endMs, c.timestampMs])).toEqual(
      [
        [" quả", 12_220, 12_308, 12_220],
        [" nhất.", 12_308, 12_396, 12_308],
        [" Khóa", 14_700, 14_880, 14_700],
        [" bài.", 32_760, 32_798, 32_760],
        [" Lộ", 43_709, 44_100, 43_709],
      ],
    );
  });

  test("no pauses: unchanged", () => {
    const captions = [cap("A", 0, 100), cap(" B", 100, 300)];
    expect(fitCaptionsToPauses({ captions, pauses: [] })).toEqual(captions);
  });
});
