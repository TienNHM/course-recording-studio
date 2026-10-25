// Pure functions that turn analysis results (silences, markers, captions)
// into a reviewable EditPlan. No file system access here, so it is unit-testable.
import type { Caption } from "@remotion/captions";
import type {
  EditPlan,
  Marker,
  SilencePreset,
  SilenceRange,
} from "../../../config/course";
import { PRESET_MIN_SILENCE_MS } from "./silence";

export type Cut = EditPlan["cuts"][number];
export type Segment = EditPlan["segments"][number];
export type Chapter = EditPlan["chapters"][number];
type CutReason = Cut["reason"];

// Audio kept before a cut starts (tail of the last word before the pause).
export const KEEP_BEFORE_CUT_MS = 250;
// Audio kept after a cut ends (lead-in before the next word).
export const KEEP_AFTER_CUT_MS = 350;
// Kept segments shorter than this are dropped (they would only be a flash).
export const MIN_SEGMENT_MS = 500;
// A "cut" marker removes back to the latest pause that ends at most this long
// before the mistake ends.
export const MARKER_CUT_LOOKBACK_MS = 30000;
// Without such a pause it removes only this much (it never guesses further).
export const MARKER_CUT_FALLBACK_MS = 3000;
// A marker pressed this soon after a pause ends (reaction time, the speaker
// already started the retake) counts as pressed during that pause.
export const MARKER_GRACE_MS = 500;
// A silence this close to the start/end of the take counts as leading/trailing.
export const EDGE_TOLERANCE_MS = 200;

const REASON_PRIORITY: Record<CutReason, number> = {
  trim: 3,
  marker: 2,
  silence: 1,
};

const strongerReason = (a: CutReason, b: CutReason): CutReason =>
  REASON_PRIORITY[a] >= REASON_PRIORITY[b] ? a : b;

const sortByStart = <T extends { startMs: number }>(arr: T[]): T[] =>
  [...arr].sort((a, b) => a.startMs - b.startMs);

// Merges overlapping or touching cuts (same acceptance state is assumed).
const mergeCuts = (cuts: Cut[]): Cut[] => {
  const out: Cut[] = [];
  for (const cut of sortByStart(cuts)) {
    const last = out[out.length - 1];
    if (last && cut.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, cut.endMs);
      last.reason = strongerReason(last.reason, cut.reason);
    } else {
      out.push({ ...cut });
    }
  }
  return out;
};

// Subtracts `ranges` (sorted, non-overlapping) from [startMs, endMs].
const subtractRanges = (
  range: { startMs: number; endMs: number },
  ranges: { startMs: number; endMs: number }[],
) => {
  const pieces: { startMs: number; endMs: number }[] = [];
  let cursor = range.startMs;
  for (const r of ranges) {
    if (r.endMs <= cursor || r.startMs >= range.endMs) {
      continue;
    }
    if (r.startMs > cursor) {
      pieces.push({ startMs: cursor, endMs: r.startMs });
    }
    cursor = Math.max(cursor, r.endMs);
  }
  if (cursor < range.endMs) {
    pieces.push({ startMs: cursor, endMs: range.endMs });
  }
  return pieces;
};

// Normalizes a cut list:
// - clamps to [0, durationMs] and removes empty cuts
// - merges overlapping/touching accepted cuts (reason priority trim > marker > silence)
// - removes the parts of suggestions that are already covered by accepted cuts
//   (remainders shorter than MIN_SEGMENT_MS are dropped), then merges suggestions
// - returns everything sorted by start time
export const normalizeCuts = (cuts: Cut[], durationMs: number): Cut[] => {
  const clamped = cuts
    .map((c) => ({
      ...c,
      startMs: Math.max(0, Math.min(durationMs, Math.round(c.startMs))),
      endMs: Math.max(0, Math.min(durationMs, Math.round(c.endMs))),
    }))
    .filter((c) => c.endMs > c.startMs);

  const accepted = mergeCuts(clamped.filter((c) => c.accepted));
  const suggestions = mergeCuts(
    clamped
      .filter((c) => !c.accepted)
      .flatMap((c) =>
        subtractRanges(c, accepted)
          .filter((p) => p.endMs - p.startMs >= MIN_SEGMENT_MS)
          .map((p) => ({ ...c, ...p })),
      ),
  );
  return sortByStart([...accepted, ...suggestions]);
};

// Kept segments = complement of the accepted cuts within [0, durationMs],
// without segments shorter than MIN_SEGMENT_MS.
export const recomputeSegments = (
  durationMs: number,
  cuts: Cut[],
): Segment[] => {
  if (durationMs <= 0) {
    return [];
  }
  const accepted = mergeCuts(
    cuts
      .filter((c) => c.accepted)
      .map((c) => ({
        ...c,
        startMs: Math.max(0, c.startMs),
        endMs: Math.min(durationMs, c.endMs),
      }))
      .filter((c) => c.endMs > c.startMs),
  );
  return subtractRanges({ startMs: 0, endMs: durationMs }, accepted).filter(
    (s) => s.endMs - s.startMs >= MIN_SEGMENT_MS,
  );
};

// A chapter that does not fall inside a kept segment moves to the start of the
// next segment; if there is none it is dropped. Chapters landing on the same
// time are de-duplicated (the first one wins).
export const relocateChapters = (
  chapters: Chapter[],
  segments: Segment[],
): Chapter[] => {
  const out: Chapter[] = [];
  // Always relocate from the requested time, so undoing a cut moves the
  // chapter back to where it was asked to start.
  const sorted = chapters
    .map((c) => ({ ...c, requestedTimeMs: c.requestedTimeMs ?? c.timeMs }))
    .sort((a, b) => a.requestedTimeMs - b.requestedTimeMs);
  for (const chapter of sorted) {
    const requested = chapter.requestedTimeMs;
    const inside = segments.some(
      (s) => requested >= s.startMs && requested < s.endMs,
    );
    let timeMs: number | null = requested;
    if (!inside) {
      const next = segments.find((s) => s.startMs >= requested);
      timeMs = next ? next.startMs : null;
    }
    if (timeMs === null || out.some((c) => c.timeMs === timeMs)) {
      continue;
    }
    // Remember the requested time only while the chapter is displaced.
    out.push(
      timeMs === requested
        ? { timeMs, title: chapter.title }
        : { timeMs, title: chapter.title, requestedTimeMs: requested },
    );
  }
  return out;
};

const isWord = (c: Caption) => c.text.trim().length > 0;

// Leading/trailing trim. Detected pauses touching the start/end of the take
// are preferred: whisper's edge timestamps are unreliable (the first word
// often starts at 0 ms and the last one ends at the end of the file, because
// the edges absorb the surrounding silence). The first/last caption words
// (like remotion/calculate-metadata/get-start-end-frame.ts) are only used when
// no pauses were detected at all (e.g. silence detection was off).
export const computeTrim = ({
  durationMs,
  silences,
  captions,
}: {
  durationMs: number;
  silences: SilenceRange[];
  captions: Caption[] | null;
}): { trimStartMs: number; trimEndMs: number } => {
  let trimStartMs = 0;
  let trimEndMs = durationMs;

  const words = (captions ?? []).filter(isWord);
  const first = words[0];
  const last = words[words.length - 1];

  if (silences.length === 0 && first && last) {
    trimStartMs = Math.max(0, first.startMs - KEEP_AFTER_CUT_MS);
    trimEndMs = Math.min(durationMs, last.endMs + KEEP_BEFORE_CUT_MS);
  } else {
    const leading = silences.find((s) => s.startMs <= EDGE_TOLERANCE_MS);
    if (leading) {
      trimStartMs = Math.max(0, leading.endMs - KEEP_AFTER_CUT_MS);
    }
    const trailing = silences.find(
      (s) => s.endMs >= durationMs - EDGE_TOLERANCE_MS,
    );
    if (trailing) {
      trimEndMs = Math.min(durationMs, trailing.startMs + KEEP_BEFORE_CUT_MS);
    }
  }

  // Never trim the take down to nothing.
  if (trimEndMs - trimStartMs < MIN_SEGMENT_MS) {
    return { trimStartMs: 0, trimEndMs: durationMs };
  }
  return { trimStartMs, trimEndMs };
};

// "cut" marker rule: the speaker makes a mistake, pauses, and presses the cut
// marker (usually during that pause). The mistake is the speech between the
// latest pause before it and the marker:
// - if the marker falls inside a pause (or at most MARKER_GRACE_MS after one),
//   the mistake ends where that pause starts and the cut ends where the pause
//   ends (minus the lead-in kept before the next word);
// - the cut starts inside the latest pause that ends at or before the end of
//   the mistake (no earlier than MARKER_CUT_LOOKBACK_MS before it), keeping
//   the usual tail after the previous word — so it never eats into earlier
//   speech;
// - without such a pause, only MARKER_CUT_FALLBACK_MS before the mistake ends
//   is removed.
// `silences` should contain every detected pause (silence.json), not only
// the ones long enough to be suggested as cuts. These cuts are always
// accepted (reason "marker").
export const markerCut = (
  marker: Marker,
  silences: SilenceRange[],
  durationMs: number,
): Cut | null => {
  const t = Math.min(marker.timeMs, durationMs);
  const containing = silences.find(
    (s) => s.startMs <= t && t <= s.endMs + MARKER_GRACE_MS,
  );
  const mistakeEndMs = containing ? containing.startMs : t;
  const endMs = containing
    ? Math.max(containing.startMs, containing.endMs - KEEP_AFTER_CUT_MS)
    : t;
  const preceding = silences
    .filter(
      (s) =>
        s.endMs <= mistakeEndMs &&
        s.endMs >= mistakeEndMs - MARKER_CUT_LOOKBACK_MS,
    )
    .sort((a, b) => b.endMs - a.endMs)[0];
  const startMs = preceding
    ? Math.min(preceding.startMs + KEEP_BEFORE_CUT_MS, preceding.endMs)
    : Math.max(0, mistakeEndMs - MARKER_CUT_FALLBACK_MS);
  if (endMs <= startMs) {
    return null;
  }
  return { startMs, endMs, reason: "marker", accepted: true };
};

// Suggested cut for a mid-take silence, keeping a little audio on both sides.
export const silenceCut = (
  silence: SilenceRange,
  accepted: boolean,
): Cut | null => {
  const startMs = silence.startMs + KEEP_BEFORE_CUT_MS;
  const endMs = silence.endMs - KEEP_AFTER_CUT_MS;
  if (endMs <= startMs) {
    return null;
  }
  return { startMs, endMs, reason: "silence", accepted };
};

export type BuildEditPlanInput = {
  takeId: string;
  durationMs: number;
  silences: SilenceRange[];
  markers: Marker[];
  captions: Caption[] | null;
  preset: SilencePreset;
  autoRemoveSilence: boolean;
  lessonTitle: string;
  moduleTitle: string | null;
  courseName: string | null;
  hasWebcam: boolean;
  generateChapters: boolean;
  intro: boolean;
  outro: boolean;
};

export const buildChapters = ({
  markers,
  generateChapters,
  lessonTitle,
}: {
  markers: Marker[];
  generateChapters: boolean;
  lessonTitle: string;
}): Chapter[] => {
  const chapterMarkers = markers
    .filter((m) => m.type === "chapter")
    .sort((a, b) => a.timeMs - b.timeMs);
  if (chapterMarkers.length > 0) {
    return chapterMarkers.map((m, i) => ({
      timeMs: m.timeMs,
      title: m.title?.trim() || `Chapter ${i + 1}`,
    }));
  }
  if (generateChapters) {
    return [{ timeMs: 0, title: lessonTitle }];
  }
  return [];
};

export const buildEditPlan = (input: BuildEditPlanInput): EditPlan => {
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const silences = sortByStart(input.silences);
  const threshold = PRESET_MIN_SILENCE_MS[input.preset];

  const cuts: Cut[] = [];

  // 1. Leading/trailing trim — always accepted.
  const { trimStartMs, trimEndMs } = computeTrim({
    durationMs,
    silences,
    captions: input.captions,
  });
  if (trimStartMs > 0) {
    cuts.push({
      startMs: 0,
      endMs: trimStartMs,
      reason: "trim",
      accepted: true,
    });
  }
  if (trimEndMs < durationMs) {
    cuts.push({
      startMs: trimEndMs,
      endMs: durationMs,
      reason: "trim",
      accepted: true,
    });
  }

  // 2. Long silences — suggestions, accepted only with autoRemoveSilence.
  for (const silence of silences) {
    if (silence.endMs - silence.startMs < threshold) {
      continue;
    }
    const cut = silenceCut(silence, input.autoRemoveSilence);
    if (cut) {
      cuts.push(cut);
    }
  }

  // 3. "cut" markers — always accepted.
  for (const m of input.markers) {
    if (m.type !== "cut") {
      continue;
    }
    const cut = markerCut(m, silences, durationMs);
    if (cut) {
      cuts.push(cut);
    }
  }

  const normalized = normalizeCuts(cuts, durationMs);
  const segments = recomputeSegments(durationMs, normalized);
  const chapters = relocateChapters(
    buildChapters({
      markers: input.markers,
      generateChapters: input.generateChapters,
      lessonTitle: input.lessonTitle,
    }),
    segments,
  );

  const subtitle =
    [input.courseName, input.moduleTitle].filter(Boolean).join(" · ") || null;

  return {
    takeId: input.takeId,
    durationMs,
    segments,
    cuts: normalized,
    chapters,
    layout: input.hasWebcam ? "screen-webcam" : "screen-only",
    intro: input.intro ? { title: input.lessonTitle, subtitle } : null,
    outro: input.outro,
  };
};

export type EditPlanPatch = {
  cuts?: { index: number; accepted: boolean }[];
  chapters?: Chapter[];
  layout?: EditPlan["layout"];
  intro?: EditPlan["intro"];
  outro?: boolean;
};

// Applies a Review UI change and recomputes segments + chapter positions.
// Cut indices refer to the plan's current `cuts` array. Cuts are not merged
// here, so indices stay stable across successive edits.
export const applyEditPlanPatch = (
  plan: EditPlan,
  patch: EditPlanPatch,
  durationMs: number,
): EditPlan => {
  const cuts = plan.cuts.map((c) => ({ ...c }));
  for (const change of patch.cuts ?? []) {
    const cut = cuts[change.index];
    if (!cut) {
      throw new Error(`No cut with index ${change.index}`);
    }
    cut.accepted = change.accepted;
  }
  const segments = recomputeSegments(durationMs, cuts);
  const chapters = relocateChapters(patch.chapters ?? plan.chapters, segments);
  return {
    ...plan,
    cuts,
    segments,
    chapters,
    layout: patch.layout ?? plan.layout,
    intro: patch.intro === undefined ? plan.intro : patch.intro,
    outro: patch.outro ?? plan.outro,
  };
};

// Duration of the original take for recomputing segments: the plan's own
// `durationMs`, else production/analysis.json (`analysisDurationMs`, only
// when it was made for the same take), else the furthest known time.
export const resolvePlanDurationMs = (
  plan: EditPlan,
  analysisDurationMs: number | null,
): number => {
  if (plan.durationMs !== undefined) {
    return plan.durationMs;
  }
  if (analysisDurationMs !== null) {
    return analysisDurationMs;
  }
  return inferDurationMs(plan);
};

// Plans without `durationMs`: fall back to the furthest known time.
export const inferDurationMs = (plan: EditPlan): number => {
  return Math.max(
    0,
    ...plan.segments.map((s) => s.endMs),
    ...plan.cuts.map((c) => c.endMs),
  );
};
