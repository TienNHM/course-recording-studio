import { describe, expect, test } from "bun:test";
import {
  levelFromTimeDomain,
  meterPosition,
} from "../src/recording/audio-level";
import { pickDefaultMicrophone } from "../src/recording/device-label";
import { defaultChapterTitle } from "../src/recording/markers";
import {
  canStartRecording,
  computePreflight,
  isSlotVisible,
  LOW_DISK_SPACE_BYTES,
  microphonePrefix,
  MIC_HEARD_THRESHOLD,
  PreflightInput,
  preflightSummary,
} from "../src/recording/preflight";
import {
  RECORDER_SHORTCUTS,
  resolveShortcut,
  SHORTCUT_KEYS,
} from "../src/recording/shortcuts";

const none = { selected: false, loading: false, hasVideo: false };
const live = { selected: true, loading: false, hasVideo: true };

const ready: PreflightInput = {
  serverEnabled: true,
  hasLesson: true,
  webcamRequired: false,
  microphoneRequired: true,
  micSelected: true,
  hasAudio: true,
  micPeak: 0.2,
  screen: live,
  webcam: none,
  anyVideo: true,
  freeDiskBytes: 100 * 1024 ** 3,
  diskChecked: true,
};

const stateOf = (input: PreflightInput, id: string) =>
  computePreflight(input).find((c) => c.id === id);

describe("pre-flight checks", () => {
  test("everything ready", () => {
    const checks = computePreflight(ready);
    expect(checks.map((c) => c.id)).toEqual([
      "lesson",
      "mic",
      "screen",
      "webcam",
      "disk",
    ]);
    expect(checks.map((c) => c.state)).toEqual([
      "ok",
      "ok",
      "ok",
      "skipped",
      "ok",
    ]);
    expect(canStartRecording(ready)).toBe(true);
    expect(preflightSummary(checks, true)).toBe("ready");
  });

  test("missing lesson or server is only a warning", () => {
    expect(stateOf({ ...ready, hasLesson: false }, "lesson")).toEqual({
      id: "lesson",
      state: "warning",
      reason: "missing",
    });
    expect(stateOf({ ...ready, serverEnabled: false }, "lesson")?.reason).toBe(
      "noServer",
    );
    const checks = computePreflight({ ...ready, hasLesson: false });
    expect(preflightSummary(checks, true)).toBe("warnings");
  });

  test("microphone: missing, listening, silent, heard", () => {
    expect(stateOf({ ...ready, micSelected: false }, "mic")?.state).toBe(
      "error",
    );
    expect(stateOf({ ...ready, micPeak: null }, "mic")?.state).toBe("pending");
    expect(stateOf({ ...ready, micPeak: 0 }, "mic")).toEqual({
      id: "mic",
      state: "warning",
      reason: "silent",
    });
    expect(
      stateOf({ ...ready, micPeak: MIC_HEARD_THRESHOLD }, "mic")?.state,
    ).toBe("ok");
    expect(
      stateOf(
        { ...ready, microphoneRequired: false, micSelected: false },
        "mic",
      )?.state,
    ).toBe("skipped");
  });

  test("screen: missing blocks, loading waits, webcam-only warns", () => {
    const noScreen = { ...ready, screen: none, anyVideo: false };
    expect(stateOf(noScreen, "screen")?.state).toBe("error");
    expect(canStartRecording(noScreen)).toBe(false);
    expect(preflightSummary(computePreflight(noScreen), false)).toBe(
      "blocked",
    );

    expect(
      stateOf(
        { ...noScreen, screen: { ...none, selected: true, loading: true } },
        "screen",
      )?.state,
    ).toBe("pending");

    const webcamOnly = { ...ready, screen: none, webcam: live, anyVideo: true };
    expect(stateOf(webcamOnly, "screen")?.reason).toBe("otherVideo");
    expect(canStartRecording(webcamOnly)).toBe(true);
  });

  test("webcam follows the lesson's recording profile", () => {
    expect(stateOf(ready, "webcam")?.reason).toBe("notRequired");
    expect(stateOf({ ...ready, webcam: live }, "webcam")?.reason).toBe(
      "extra",
    );
    expect(stateOf({ ...ready, webcamRequired: true }, "webcam")).toEqual({
      id: "webcam",
      state: "warning",
      reason: "missing",
    });
    expect(
      stateOf({ ...ready, webcamRequired: true, webcam: live }, "webcam")
        ?.state,
    ).toBe("ok");
  });

  test("disk space", () => {
    expect(stateOf({ ...ready, diskChecked: false }, "disk")?.state).toBe(
      "pending",
    );
    expect(stateOf({ ...ready, freeDiskBytes: null }, "disk")?.state).toBe(
      "skipped",
    );
    expect(
      stateOf({ ...ready, freeDiskBytes: LOW_DISK_SPACE_BYTES - 1 }, "disk")
        ?.reason,
    ).toBe("low");
  });

  test("audio is required unless the lesson records no microphone", () => {
    expect(canStartRecording({ ...ready, hasAudio: false })).toBe(false);
    expect(
      canStartRecording({
        ...ready,
        hasAudio: false,
        microphoneRequired: false,
      }),
    ).toBe(true);
  });
});

describe("slots", () => {
  test("the microphone goes with the webcam only when the lesson uses one", () => {
    expect(microphonePrefix(true)).toBe("webcam");
    expect(microphonePrefix(false)).toBe("display");
  });

  test("visibility", () => {
    const opts = { showAlternatives: false, webcamShown: false };
    expect(isSlotVisible("display", opts)).toBe(true);
    expect(isSlotVisible("webcam", opts)).toBe(false);
    expect(isSlotVisible("webcam", { ...opts, webcamShown: true })).toBe(true);
    expect(isSlotVisible("alternative1", opts)).toBe(false);
    expect(
      isSlotVisible("alternative2", { ...opts, showAlternatives: true }),
    ).toBe(true);
  });

  test("default microphone", () => {
    const devices = [
      { kind: "audioinput" as const, deviceId: "default" },
      { kind: "audioinput" as const, deviceId: "usb" },
      { kind: "videoinput" as const, deviceId: "cam" },
    ];
    expect(pickDefaultMicrophone(devices, [null, "usb"])).toBe("usb");
    expect(pickDefaultMicrophone(devices, ["gone", null])).toBe("default");
    expect(pickDefaultMicrophone(devices.slice(1), [])).toBe("usb");
    expect(pickDefaultMicrophone([], [])).toBe(null);
  });
});

describe("shortcuts", () => {
  test("R starts, stops and cancels depending on the phase", () => {
    expect(resolveShortcut("r", "idle")).toBe("start");
    expect(resolveShortcut("R", "recording")).toBe("stop");
    expect(resolveShortcut("r", "countdown")).toBe("cancelCountdown");
    expect(resolveShortcut("r", "finished")).toBe(null);
  });

  test("markers and pause only while recording", () => {
    expect(resolveShortcut("p", "recording")).toBe("togglePause");
    expect(resolveShortcut("m", "recording")).toBe("markImportant");
    expect(resolveShortcut("b", "recording")).toBe("markCut");
    expect(resolveShortcut("c", "recording")).toBe("markChapter");
    for (const key of ["p", "m", "b", "c"]) {
      expect(resolveShortcut(key, "idle")).toBe(null);
      expect(resolveShortcut(key, "countdown")).toBe(null);
    }
  });

  test("Escape cancels the countdown only", () => {
    expect(resolveShortcut("Escape", "countdown")).toBe("cancelCountdown");
    expect(resolveShortcut("Escape", "recording")).toBe(null);
    expect(resolveShortcut("Escape", "idle")).toBe(null);
  });

  test("help lists every handled key once", () => {
    expect(new Set(SHORTCUT_KEYS).size).toBe(RECORDER_SHORTCUTS.length);
    expect([...SHORTCUT_KEYS].sort()).toEqual(
      ["b", "c", "escape", "m", "p", "r"].sort(),
    );
  });
});

describe("audio level", () => {
  test("silence and full scale", () => {
    expect(levelFromTimeDomain(new Uint8Array(64).fill(128))).toBe(0);
    const square = Uint8Array.from({ length: 64 }, (_, i) =>
      i % 2 ? 0 : 255,
    );
    expect(levelFromTimeDomain(square)).toBeGreaterThan(0.99);
    expect(levelFromTimeDomain([])).toBe(0);
  });

  test("meter uses a dB scale", () => {
    expect(meterPosition(0)).toBe(0);
    expect(meterPosition(1)).toBe(1);
    expect(meterPosition(0.001)).toBeCloseTo(0, 5);
    expect(meterPosition(0.1)).toBeCloseTo(2 / 3, 5);
  });
});

test("default chapter titles can be localized", () => {
  const existing = [{ type: "chapter" as const, timeMs: 0, title: "A" }];
  expect(defaultChapterTitle(existing)).toBe("Chapter 2");
  expect(defaultChapterTitle(existing, (n) => `Chương ${n}`)).toBe(
    "Chương 2",
  );
});
