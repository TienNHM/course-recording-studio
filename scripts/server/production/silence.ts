import type { SilencePreset, SilenceRange } from "../../../config/course";

// Silence detection defaults.
export const SILENCE_NOISE_DB = -38;
// Every pause at least this long is detected and stored in silence.json.
// Short pauses are needed to find sentence boundaries (e.g. the pause before
// a verbal slip that a "cut" marker removes); the preset only decides which
// of them become cut suggestions.
export const SILENCE_MIN_DETECT_MS = 500;

// A silence must be at least this long to become a (suggested) cut.
export const PRESET_MIN_SILENCE_MS: Record<SilencePreset, number> = {
  conservative: 8000,
  balanced: 3000,
  aggressive: 1500,
};

// Detection must find silences at least as short as the preset needs.
// The pause floor is below every preset, so this is always the floor.
export const getDetectionMinMs = (preset: SilencePreset) => {
  return Math.min(SILENCE_MIN_DETECT_MS, PRESET_MIN_SILENCE_MS[preset]);
};

// Parses ffmpeg `silencedetect` output:
//   [silencedetect @ 0x..] silence_start: 12.345
//   [silencedetect @ 0x..] silence_end: 15.678 | silence_duration: 3.333
// A trailing silence_start without an end lasts until the end of the media.
export const parseSilenceDetect = (
  stderr: string,
  durationMs: number,
): SilenceRange[] => {
  const ranges: SilenceRange[] = [];
  let openStart: number | null = null;
  const re = /silence_(start|end):\s*(-?\d+(?:\.\d+)?)/g;
  for (const match of stderr.matchAll(re)) {
    const kind = match[1];
    const ms = Math.round(Number(match[2]) * 1000);
    if (kind === "start") {
      openStart = Math.max(0, ms);
    } else if (openStart !== null) {
      ranges.push({ startMs: openStart, endMs: Math.min(ms, durationMs) });
      openStart = null;
    }
  }
  if (openStart !== null && openStart < durationMs) {
    ranges.push({ startMs: openStart, endMs: durationMs });
  }
  return ranges.filter((r) => r.endMs > r.startMs);
};
