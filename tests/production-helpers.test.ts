import type { Caption } from "@remotion/captions";
import { describe, expect, test } from "bun:test";
import { applyGlossary, applyGlossaryToText } from "../config/autocorrect";
import { getWhisperModel } from "../config/whisper";
import {
  captionList,
  checkCaptionEdit,
} from "../scripts/server/production/captions";
import { parseLastFfmpegTimeMs } from "../scripts/server/production/ffmpeg";
import {
  getDetectionMinMs,
  parseSilenceDetect,
} from "../scripts/server/production/silence";
import { getThumbnailFrame } from "../scripts/server/render/render-lesson";
import {
  buildTranscriptMarkdown,
  srtToVtt,
} from "../scripts/server/render/subtitles";

const c = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: null,
});

describe("whisper model", () => {
  test("per language", () => {
    expect(getWhisperModel("en")).toBe("medium.en");
    expect(getWhisperModel("vi")).toBe("medium");
    expect(getWhisperModel(null)).toBe("medium");
  });
});

describe("parseSilenceDetect", () => {
  const out = `
[silencedetect @ 000001] silence_start: 0
[silencedetect @ 000001] silence_end: 3.204 | silence_duration: 3.204
size=N/A time=00:00:05.00 bitrate=N/A speed= 100x
[silencedetect @ 000001] silence_start: 10.5
[silencedetect @ 000001] silence_end: 14.25 | silence_duration: 3.75
[silencedetect @ 000001] silence_start: 57.1
`;
  test("pairs starts and ends; open end lasts until the duration", () => {
    expect(parseSilenceDetect(out, 60_000)).toEqual([
      { startMs: 0, endMs: 3204 },
      { startMs: 10_500, endMs: 14_250 },
      { startMs: 57_100, endMs: 60_000 },
    ]);
  });
  test("empty output", () => {
    expect(parseSilenceDetect("", 1000)).toEqual([]);
  });
  test("negative start is clamped", () => {
    expect(
      parseSilenceDetect("silence_start: -0.01\nsilence_end: 2", 5000),
    ).toEqual([{ startMs: 0, endMs: 2000 }]);
  });
  test("every preset detects all pauses ≥ 0.5 s", () => {
    expect(getDetectionMinMs("conservative")).toBe(500);
    expect(getDetectionMinMs("balanced")).toBe(500);
    expect(getDetectionMinMs("aggressive")).toBe(500);
  });
});

describe("parseLastFfmpegTimeMs", () => {
  test("takes the last time=", () => {
    expect(
      parseLastFfmpegTimeMs("time=00:00:01.00 x\ntime=00:01:02.50 y"),
    ).toBe(62_500);
    expect(parseLastFfmpegTimeMs("nothing")).toBeNull();
  });
});

describe("glossary", () => {
  const glossary = [
    { term: "GitHub", aliases: ["git hub"] },
    { term: "Visual Studio Code", aliases: ["vs code", "visual studio code"] },
    { term: "Remotion", aliases: ["remo tion", "promotion"] },
    { term: "Hàm", aliases: ["ham"] },
  ];

  test("text replacement is case-insensitive and word-boundary aware", () => {
    expect(
      applyGlossaryToText("Open VS Code and github, not githubs.", glossary),
    ).toBe("Open Visual Studio Code and GitHub, not githubs.");
    expect(applyGlossaryToText("hamburger ham", glossary)).toBe(
      "hamburger Hàm",
    );
  });

  test("single-word captions keep spacing and punctuation", () => {
    expect(
      applyGlossary(
        [c(" github,", 0, 100), c(" Promotion.", 100, 200)],
        glossary,
      ).map((x) => x.text),
    ).toEqual([" GitHub,", " Remotion."]);
  });

  test("multi-word aliases across captions are merged", () => {
    const out = applyGlossary(
      [
        c(" Open", 0, 100),
        c(" vs", 100, 200),
        c(" code.", 200, 300),
        c(" Git", 300, 400),
        c(" Hub", 400, 500),
      ],
      glossary,
    );
    expect(out).toEqual([
      c(" Open", 0, 100),
      { ...c(" Visual Studio Code.", 100, 300), timestampMs: 100 },
      { ...c(" GitHub", 300, 500), timestampMs: 300 },
    ]);
  });

  test("punctuation inside a phrase prevents merging", () => {
    const out = applyGlossary(
      [c(" git.", 0, 100), c(" hub", 100, 200)],
      glossary,
    );
    expect(out.map((x) => x.text)).toEqual([" git.", " hub"]);
  });

  test("Vietnamese diacritics are word characters", () => {
    expect(applyGlossaryToText("hàm ham hamđ", glossary)).toBe("Hàm Hàm hamđ");
  });

  test("empty glossary is a no-op", () => {
    const captions = [c(" hi", 0, 1)];
    expect(applyGlossary(captions, [])).toBe(captions);
  });
});

describe("srtToVtt", () => {
  test("converts timings and adds header", () => {
    const srt =
      "﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\nline 2\r\n";
    expect(srtToVtt(srt)).toBe(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello\n\n00:00:03.000 --> 00:00:04.000\nWorld\nline 2\n",
    );
  });
  test("empty", () => {
    expect(srtToVtt("")).toBe("WEBVTT\n\n");
  });
});

describe("buildTranscriptMarkdown", () => {
  test("keeps only captions in segments, grouped by chapter", () => {
    const md = buildTranscriptMarkdown({
      title: "Lesson 1",
      captions: [
        c(" Before", 0, 500),
        c(" Hello", 1000, 1500),
        c(" world.", 1500, 2000),
        c(" cut", 3000, 3500),
        c(" Part", 6000, 6500),
        c(" two.", 6500, 7000),
      ],
      plan: {
        segments: [
          { startMs: 800, endMs: 2500 },
          { startMs: 5000, endMs: 8000 },
        ],
        chapters: [
          { timeMs: 800, title: "Intro" },
          { timeMs: 5000, title: "Main" },
        ],
      },
    });
    expect(md).toBe(
      "# Lesson 1\n\n## Intro\n\nHello world.\n\n## Main\n\nPart two.\n",
    );
  });

  test("no chapters", () => {
    expect(
      buildTranscriptMarkdown({
        title: "T",
        captions: [c(" a", 0, 100)],
        plan: { segments: [{ startMs: 0, endMs: 1000 }], chapters: [] },
      }),
    ).toBe("# T\n\na\n");
  });
});

describe("thumbnail frame", () => {
  test("clamped", () => {
    expect(
      getThumbnailFrame({ fps: 30, durationInFrames: 1000, hasIntro: true }),
    ).toBe(30);
    expect(
      getThumbnailFrame({ fps: 30, durationInFrames: 1000, hasIntro: false }),
    ).toBe(60);
    expect(
      getThumbnailFrame({ fps: 30, durationInFrames: 10, hasIntro: false }),
    ).toBe(9);
  });
});

describe("checkCaptionEdit", () => {
  const caption = (text: string, startMs: number, endMs: number) => ({
    text,
    startMs,
    endMs,
    timestampMs: (startMs + endMs) / 2,
    confidence: null,
  });
  const original = [caption(" Hello", 0, 500), caption(" world", 500, 900)];

  test("accepts text-only edits", () => {
    expect(
      checkCaptionEdit(original, [
        caption(" Hi", 0, 500),
        caption(" there", 500, 900),
      ]),
    ).toBeNull();
    expect(captionList.parse(original)).toEqual(original);
  });

  test("rejects timing or count changes", () => {
    expect(checkCaptionEdit(original, [caption(" Hello", 0, 500)])).toContain(
      "Expected 2",
    );
    expect(
      checkCaptionEdit(original, [
        caption(" Hello", 0, 400),
        caption(" world", 500, 900),
      ]),
    ).toContain("Caption 0");
    expect(checkCaptionEdit(null, [])).not.toBeNull();
  });
});
