import { describe, expect, test } from "bun:test";
import path from "path";
import {
  buildImportedSession,
  canRemuxToMp4,
  checkMarkers,
  ffmpegConvertArgs,
  importRecordingRequest,
  planSource,
  publishedUrlPath,
} from "../scripts/server/import-recording";

const abs = (name: string) => path.resolve("some dir", name);

describe("planSource", () => {
  test("mp4 and webm are copied as-is", () => {
    expect(planSource(abs("a.mp4"), "displayPath")).toMatchObject({
      extension: "mp4",
      targetExtension: "mp4",
      needsConversion: false,
    });
    expect(planSource(abs("a.WEBM"), "displayPath")).toMatchObject({
      extension: "webm",
      targetExtension: "webm",
      needsConversion: false,
    });
  });

  test("mov and mkv are converted to mp4", () => {
    for (const ext of ["mov", "mkv", "MOV"]) {
      expect(planSource(abs(`rec.${ext}`), "displayPath")).toMatchObject({
        targetExtension: "mp4",
        needsConversion: true,
      });
    }
  });

  test("rejects relative paths", () => {
    expect(() => planSource("rec.mp4", "displayPath")).toThrow(/absolute path/);
  });

  test("rejects unsupported extensions", () => {
    expect(() => planSource(abs("rec.avi"), "displayPath")).toThrow(
      /mp4\/webm\/mov\/mkv/,
    );
    expect(() => planSource(abs("rec"), "webcamPath")).toThrow(/no extension/);
  });
});

describe("conversion", () => {
  test("only h264 with aac/mp3/no audio is remuxed", () => {
    expect(canRemuxToMp4({ video: "h264", audio: "aac" })).toBe(true);
    expect(canRemuxToMp4({ video: "h264", audio: null })).toBe(true);
    expect(canRemuxToMp4({ video: "hevc", audio: "aac" })).toBe(false);
    expect(canRemuxToMp4({ video: "h264", audio: "pcm_s16le" })).toBe(false);
    expect(canRemuxToMp4({ video: null, audio: "aac" })).toBe(false);
  });

  test("ffmpeg args keep paths as single arguments", () => {
    const remux = ffmpegConvertArgs(
      "C:/in dir/a.mov",
      "C:/out dir/b.mp4",
      "remux",
    );
    expect(remux).toContain("C:/in dir/a.mov");
    expect(remux[remux.length - 1]).toBe("C:/out dir/b.mp4");
    expect(remux.join(" ")).toContain("-c copy");
    const transcode = ffmpegConvertArgs("a.mkv", "b.mp4", "transcode");
    expect(transcode).toContain("libx264");
    expect(transcode).toContain("yuv420p");
  });
});

describe("markers and session", () => {
  test("markers after the end are rejected", () => {
    expect(checkMarkers([{ type: "cut", timeMs: 5000 }], 10000)).toBeNull();
    expect(checkMarkers([{ type: "cut", timeMs: 10500 }], 10000)).toBeNull();
    expect(
      checkMarkers([{ type: "chapter", timeMs: 12000, title: "x" }], 10000),
    ).toMatch(/after the end/);
    expect(checkMarkers([{ type: "cut", timeMs: 99999 }], null)).toBeNull();
  });

  test("session is COMPLETED and ends at the take id", () => {
    const s = buildImportedSession({
      takeId: "1000000",
      durationMs: 4000,
      hasWebcam: true,
    });
    expect(s).toEqual({
      takeId: "1000000",
      status: "COMPLETED",
      startedAt: 996000,
      endedAt: 1000000,
      durationMs: 4000,
      sources: ["display", "webcam"],
    });
  });
});

describe("request schema", () => {
  test("validates lesson path, take id and markers", () => {
    const ok = importRecordingRequest.safeParse({
      lessonPath: "courses/a/b/c",
      displayPath: "D:/x.mp4",
      markers: [{ type: "important", timeMs: 1 }],
      takeId: "123",
    });
    expect(ok.success).toBe(true);
    expect(
      importRecordingRequest.safeParse({
        lessonPath: "../etc",
        displayPath: "D:/x.mp4",
      }).success,
    ).toBe(false);
    expect(
      importRecordingRequest.safeParse({
        lessonPath: "courses/a/b/c",
        displayPath: "D:/x.mp4",
        takeId: "abc",
      }).success,
    ).toBe(false);
    expect(
      importRecordingRequest.safeParse({
        lessonPath: "courses/a/b/c",
        displayPath: "D:/x.mp4",
        markers: [{ type: "oops", timeMs: 1 }],
      }).success,
    ).toBe(false);
  });

  test("published URL paths are encoded per segment", () => {
    expect(publishedUrlPath("courses/a b/c/published/lesson.mp4")).toBe(
      "/courses/a%20b/c/published/lesson.mp4",
    );
  });
});
