// Pure helpers that map the original take timeline (what was recorded)
// to the output timeline (the concatenation of the kept segments).
// No Remotion runtime imports here so that this file can be unit-tested with bun.
import type { Caption } from "@remotion/captions";

export type TimelineSegment = {
  startMs: number;
  endMs: number;
};

export type TimelineChapter = {
  timeMs: number;
  title: string;
};

/**
 * Sorts segments, clamps them to [0, durationMs] (if given),
 * merges overlapping / touching ones and drops empty ones.
 */
export const normalizeSegments = (
  segments: TimelineSegment[],
  durationMs: number | null = null,
): TimelineSegment[] => {
  const clamped = segments
    .map((s) => {
      const startMs = Math.max(0, s.startMs);
      const endMs =
        durationMs === null ? s.endMs : Math.min(s.endMs, durationMs);
      return { startMs, endMs };
    })
    .filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: TimelineSegment[] = [];
  for (const segment of clamped) {
    const last = merged[merged.length - 1];
    if (last && segment.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, segment.endMs);
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
};

export const getOutputDurationMs = (segments: TimelineSegment[]): number => {
  return segments.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
};

const findSegment = (
  ms: number,
  segments: TimelineSegment[],
): { segment: TimelineSegment; outputStartMs: number } | null => {
  let outputStartMs = 0;
  for (const segment of segments) {
    if (ms >= segment.startMs && ms < segment.endMs) {
      return { segment, outputStartMs };
    }

    outputStartMs += segment.endMs - segment.startMs;
  }

  // The very end of the last segment is still part of the output.
  const last = segments[segments.length - 1];
  if (last && ms === last.endMs) {
    return {
      segment: last,
      outputStartMs: outputStartMs - (last.endMs - last.startMs),
    };
  }

  return null;
};

/**
 * Maps a time on the original take timeline to the output timeline.
 * Returns null if the time lies inside a cut (or outside of all segments).
 * Segments are expected to be normalized (sorted, non-overlapping).
 */
export const mapOriginalToOutput = (
  ms: number,
  segments: TimelineSegment[],
): number | null => {
  const found = findSegment(ms, segments);
  if (!found) {
    return null;
  }

  return found.outputStartMs + (ms - found.segment.startMs);
};

/**
 * Inverse of mapOriginalToOutput(): maps a time on the output timeline
 * (concatenated kept segments, without intro) to the original take timeline.
 * Times before 0 clamp to the first segment start, times after the end clamp
 * to the end of the last segment. Returns null if there are no segments.
 */
export const mapOutputToOriginal = (
  ms: number,
  segments: TimelineSegment[],
): number | null => {
  const first = segments[0];
  if (!first) {
    return null;
  }

  if (ms <= 0) {
    return first.startMs;
  }

  let outputStartMs = 0;
  for (const segment of segments) {
    const length = segment.endMs - segment.startMs;
    if (ms < outputStartMs + length) {
      return segment.startMs + (ms - outputStartMs);
    }

    outputStartMs += length;
  }

  return (segments[segments.length - 1] as TimelineSegment).endMs;
};

/**
 * Like mapOriginalToOutput(), but a time inside a cut snaps forward
 * to the start of the next kept segment. Returns null if there is no
 * kept segment at or after the time.
 */
export const mapOriginalToOutputSnapped = (
  ms: number,
  segments: TimelineSegment[],
): number | null => {
  const exact = mapOriginalToOutput(ms, segments);
  if (exact !== null) {
    return exact;
  }

  let outputStartMs = 0;
  for (const segment of segments) {
    if (segment.startMs >= ms) {
      return outputStartMs;
    }

    outputStartMs += segment.endMs - segment.startMs;
  }

  return null;
};

/**
 * Remaps word-level captions from the original take timeline to the output timeline.
 * - Words whose start lies inside a cut are dropped.
 * - A word that starts in a segment but extends into a cut is shortened
 *   so that it ends at the end of its segment.
 */
export const remapCaptions = (
  captions: Caption[],
  segments: TimelineSegment[],
): Caption[] => {
  const result: Caption[] = [];

  for (const caption of captions) {
    const found = findSegment(caption.startMs, segments);
    if (!found) {
      continue;
    }

    const { segment, outputStartMs } = found;
    const toOutput = (ms: number) =>
      outputStartMs +
      (Math.min(Math.max(ms, segment.startMs), segment.endMs) -
        segment.startMs);

    const startMs = toOutput(caption.startMs);
    const endMs = Math.max(startMs, toOutput(caption.endMs));

    result.push({
      ...caption,
      startMs,
      endMs,
      timestampMs:
        caption.timestampMs === null ? null : toOutput(caption.timestampMs),
    });
  }

  return result;
};

/**
 * Maps chapters to the output timeline. Chapters inside a cut snap to the
 * next kept segment; chapters after the last segment are dropped.
 * Two chapters on the same output time: the later one wins.
 */
export const mapChapters = (
  chapters: TimelineChapter[],
  segments: TimelineSegment[],
): TimelineChapter[] => {
  const mapped = [...chapters]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((c) => {
      const timeMs = mapOriginalToOutputSnapped(c.timeMs, segments);
      return timeMs === null ? null : { timeMs, title: c.title };
    })
    .filter((c): c is TimelineChapter => c !== null);

  const deduped: TimelineChapter[] = [];
  for (const chapter of mapped) {
    const last = deduped[deduped.length - 1];
    if (last && last.timeMs === chapter.timeMs) {
      deduped[deduped.length - 1] = chapter;
      continue;
    }

    deduped.push(chapter);
  }

  return deduped;
};

export type FramePiece = {
  // First frame of the original take that is shown
  trimBefore: number;
  // trimBefore + durationInFrames
  trimAfter: number;
  // Start on the output timeline (without intro), in frames
  from: number;
  durationInFrames: number;
  // Set if a chapter starts with this piece
  chapter: string | null;
  // Index of the (normalized) segment this piece belongs to
  segmentIndex: number;
};

const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

/**
 * Converts segments into frame-exact pieces for rendering.
 * Output frame boundaries are derived from cumulative ms (no drift),
 * and pieces are additionally split where a chapter starts so that every
 * chapter begins with its own piece.
 */
export const segmentsToFramePieces = ({
  segments,
  chapters,
  fps,
}: {
  segments: TimelineSegment[];
  chapters: TimelineChapter[];
  fps: number;
}): FramePiece[] => {
  const chapterFrames = mapChapters(chapters, segments).map((c) => ({
    frame: msToFrame(c.timeMs, fps),
    title: c.title,
  }));

  const pieces: FramePiece[] = [];
  let cumulativeMs = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex] as TimelineSegment;
    const fromFrame = msToFrame(cumulativeMs, fps);
    cumulativeMs += segment.endMs - segment.startMs;
    const endFrame = msToFrame(cumulativeMs, fps);
    if (endFrame <= fromFrame) {
      continue;
    }

    const trimBefore = msToFrame(segment.startMs, fps);

    // Split points inside this segment (relative output frames)
    const splits = chapterFrames.filter(
      (c) => c.frame >= fromFrame && c.frame < endFrame,
    );
    const boundaries = [fromFrame, ...splits.map((s) => s.frame), endFrame];
    const uniqueBoundaries = boundaries.filter(
      (b, i) => i === 0 || b !== boundaries[i - 1],
    );

    for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
      const start = uniqueBoundaries[i] as number;
      const end = uniqueBoundaries[i + 1] as number;
      const chapter = splits.filter((s) => s.frame === start).pop();
      const pieceTrimBefore = trimBefore + (start - fromFrame);
      pieces.push({
        from: start,
        durationInFrames: end - start,
        trimBefore: pieceTrimBefore,
        trimAfter: pieceTrimBefore + (end - start),
        chapter: chapter ? chapter.title : null,
        segmentIndex,
      });
    }
  }

  return pieces;
};

/** The original-timeline range (in ms) that a frame piece shows. */
export const framePieceToOriginalSegment = (
  piece: Pick<FramePiece, "trimBefore" | "trimAfter">,
  fps: number,
): TimelineSegment => {
  return {
    startMs: (piece.trimBefore / fps) * 1000,
    endMs: (piece.trimAfter / fps) * 1000,
  };
};

/**
 * The original-timeline range of the whole segment that `piece` belongs to,
 * if `piece` is the first piece of its segment (otherwise null).
 * Used to compute captions per segment rather than per (chapter-split) piece.
 */
export const getSegmentRangeIfFirstPiece = (
  pieces: FramePiece[],
  index: number,
  fps: number,
): TimelineSegment | null => {
  const piece = pieces[index];
  if (!piece) {
    return null;
  }

  const previous = pieces[index - 1];
  if (previous && previous.segmentIndex === piece.segmentIndex) {
    return null;
  }

  const sameSegment = pieces.filter(
    (p) => p.segmentIndex === piece.segmentIndex,
  );
  const last = sameSegment[sameSegment.length - 1] as FramePiece;
  return framePieceToOriginalSegment(
    { trimBefore: piece.trimBefore, trimAfter: last.trimAfter },
    fps,
  );
};
