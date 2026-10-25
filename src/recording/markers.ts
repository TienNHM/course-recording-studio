import type { Marker, MarkerType } from "../../config/course";
import { elapsedMediaMs, PauseClock } from "./pause-clock";

export const MARKER_TYPES: readonly MarkerType[] = [
  "important",
  "cut",
  "chapter",
];

/** Formats the default title of the n-th chapter (localized by the UI). */
export type ChapterTitleFormatter = (number: number) => string;

const englishChapterTitle: ChapterTitleFormatter = (n) => `Chapter ${n}`;

export const defaultChapterTitle = (
  existing: readonly Marker[],
  format: ChapterTitleFormatter = englishChapterTitle,
) => {
  const chapters = existing.filter((m) => m.type === "chapter").length;
  return format(chapters + 1);
};

// Creates a marker at the current media time (paused time excluded).
export const createMarker = ({
  type,
  clock,
  now,
  existing,
  title,
  formatChapterTitle,
}: {
  type: MarkerType;
  clock: PauseClock;
  now: number;
  existing: readonly Marker[];
  title?: string;
  formatChapterTitle?: ChapterTitleFormatter;
}): Marker => {
  const timeMs = Math.round(elapsedMediaMs(clock, now));
  if (type !== "chapter") {
    return { type, timeMs };
  }

  const trimmed = title?.trim();
  return {
    type,
    timeMs,
    title: trimmed
      ? trimmed
      : defaultChapterTitle(existing, formatChapterTitle),
  };
};

export const addMarker = (
  existing: readonly Marker[],
  marker: Marker,
): Marker[] => {
  return [...existing, marker].sort((a, b) => a.timeMs - b.timeMs);
};
