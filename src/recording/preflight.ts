// Pre-flight checklist shown before recording. Pure so it can be unit-tested;
// the UI (PreflightPanel) feeds it the live state of devices and the lesson.

import type { Prefix } from "../helpers/prefixes";

export const LOW_DISK_SPACE_BYTES = 5 * 1024 * 1024 * 1024;

/** RMS level (0..1) above which we consider the microphone "heard". */
export const MIC_HEARD_THRESHOLD = 0.02;

export type PreflightCheckId = "lesson" | "mic" | "screen" | "webcam" | "disk";

/**
 * - ok:      green tick
 * - warning: can record, but the user should look at it
 * - error:   recording is blocked
 * - pending: still being measured (mic level, disk space)
 * - skipped: not relevant for this lesson
 */
export type PreflightState = "ok" | "warning" | "error" | "pending" | "skipped";

/** Message keys under `recording.preflight.<id>.*`. */
export type PreflightReason =
  | "ok"
  | "missing"
  | "noServer"
  | "silent"
  | "listening"
  | "notRequired"
  | "optional"
  | "extra"
  | "low"
  | "unknown"
  | "loading"
  | "otherVideo";

export type PreflightCheck = {
  readonly id: PreflightCheckId;
  readonly state: PreflightState;
  readonly reason: PreflightReason;
};

export type SourceSummary = {
  /** A device / screen is selected for the slot. */
  readonly selected: boolean;
  /** The stream is loading (e.g. waiting for the screen picker). */
  readonly loading: boolean;
  /** The stream is live and has a video track. */
  readonly hasVideo: boolean;
};

export type PreflightInput = {
  readonly serverEnabled: boolean;
  readonly hasLesson: boolean;
  readonly webcamRequired: boolean;
  readonly microphoneRequired: boolean;
  /** A microphone is selected for the mic slot (or audio comes from the screen). */
  readonly micSelected: boolean;
  /** Recording would contain an audio track. */
  readonly hasAudio: boolean;
  /** Highest level heard recently (0..1), null while not measured. */
  readonly micPeak: number | null;
  readonly screen: SourceSummary;
  readonly webcam: SourceSummary;
  /** Any visible slot has live video (alternative sources included). */
  readonly anyVideo: boolean;
  readonly freeDiskBytes: number | null;
  readonly diskChecked: boolean;
};

const lessonCheck = (input: PreflightInput): PreflightCheck => {
  if (!input.serverEnabled) {
    return { id: "lesson", state: "warning", reason: "noServer" };
  }

  return input.hasLesson
    ? { id: "lesson", state: "ok", reason: "ok" }
    : { id: "lesson", state: "warning", reason: "missing" };
};

const micCheck = (input: PreflightInput): PreflightCheck => {
  if (!input.microphoneRequired && !input.micSelected) {
    return { id: "mic", state: "skipped", reason: "notRequired" };
  }

  if (!input.micSelected) {
    return { id: "mic", state: "error", reason: "missing" };
  }

  if (input.micPeak === null) {
    return { id: "mic", state: "pending", reason: "listening" };
  }

  return input.micPeak >= MIC_HEARD_THRESHOLD
    ? { id: "mic", state: "ok", reason: "ok" }
    : { id: "mic", state: "warning", reason: "silent" };
};

const screenCheck = (input: PreflightInput): PreflightCheck => {
  if (input.screen.hasVideo) {
    return { id: "screen", state: "ok", reason: "ok" };
  }

  if (input.screen.loading) {
    return { id: "screen", state: "pending", reason: "loading" };
  }

  // Webcam-only recordings are possible, but a course lesson almost always
  // shows the screen: warn instead of blocking.
  return input.anyVideo
    ? { id: "screen", state: "warning", reason: "otherVideo" }
    : { id: "screen", state: "error", reason: "missing" };
};

const webcamCheck = (input: PreflightInput): PreflightCheck => {
  if (input.webcamRequired) {
    if (input.webcam.hasVideo) {
      return { id: "webcam", state: "ok", reason: "ok" };
    }

    if (input.webcam.loading) {
      return { id: "webcam", state: "pending", reason: "loading" };
    }

    return { id: "webcam", state: "warning", reason: "missing" };
  }

  return input.webcam.hasVideo
    ? { id: "webcam", state: "ok", reason: "extra" }
    : { id: "webcam", state: "skipped", reason: "notRequired" };
};

const diskCheck = (input: PreflightInput): PreflightCheck => {
  if (!input.diskChecked) {
    return { id: "disk", state: "pending", reason: "loading" };
  }

  if (input.freeDiskBytes === null) {
    return { id: "disk", state: "skipped", reason: "unknown" };
  }

  return input.freeDiskBytes < LOW_DISK_SPACE_BYTES
    ? { id: "disk", state: "warning", reason: "low" }
    : { id: "disk", state: "ok", reason: "ok" };
};

export const computePreflight = (input: PreflightInput): PreflightCheck[] => [
  lessonCheck(input),
  micCheck(input),
  screenCheck(input),
  webcamCheck(input),
  diskCheck(input),
];

/**
 * Recording needs at least one live video track and, when the microphone is
 * required, an audio track. Everything else is advisory.
 */
export const canStartRecording = (
  input: Pick<PreflightInput, "anyVideo" | "hasAudio" | "microphoneRequired">,
): boolean => input.anyVideo && (input.hasAudio || !input.microphoneRequired);

/** Summary for the big Record button: "ready", "warnings" or "blocked". */
export const preflightSummary = (
  checks: readonly PreflightCheck[],
  canStart: boolean,
): "ready" | "warnings" | "blocked" => {
  if (!canStart || checks.some((c) => c.state === "error")) {
    return "blocked";
  }

  return checks.some((c) => c.state === "warning") ? "warnings" : "ready";
};

/**
 * Slot that records the microphone: the webcam when the lesson shows the
 * presenter, otherwise the screen (screen + mic is the common case for
 * lessons without a webcam, and keeps the take's layout "screen-only").
 */
export const microphonePrefix = (webcamRequired: boolean): Prefix =>
  webcamRequired ? "webcam" : "display";

/** Which slots are mounted (and therefore recorded). */
export const isSlotVisible = (
  prefix: Prefix,
  {
    showAlternatives,
    webcamShown,
  }: { showAlternatives: boolean; webcamShown: boolean },
): boolean => {
  if (prefix === "display") {
    return true;
  }

  if (prefix === "webcam") {
    return webcamShown;
  }

  return showAlternatives;
};
