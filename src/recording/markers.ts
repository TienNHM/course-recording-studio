import type { Marker, MarkerType } from "../../config/course";
import { elapsedMediaMs, PauseClock } from "./pause-clock";

export const MARKER_LABELS: Record<MarkerType, string> = {
  cut: "Cut",
  important: "Important",
  chapter: "Chapter",
};

export const defaultChapterTitle = (existing: readonly Marker[]) => {
  const chapters = existing.filter((m) => m.type === "chapter").length;
  return `Chapter ${chapters + 1}`;
};

// Creates a marker at the current media time (paused time excluded).
export const createMarker = ({
  type,
  clock,
  now,
  existing,
  title,
}: {
  type: MarkerType;
  clock: PauseClock;
  now: number;
  existing: readonly Marker[];
  title?: string;
}): Marker => {
  const timeMs = Math.round(elapsedMediaMs(clock, now));
  if (type !== "chapter") {
    return { type, timeMs };
  }

  const trimmed = title?.trim();
  return {
    type,
    timeMs,
    title: trimmed ? trimmed : defaultChapterTitle(existing),
  };
};

export const addMarker = (
  existing: readonly Marker[],
  marker: Marker,
): Marker[] => {
  return [...existing, marker].sort((a, b) => a.timeMs - b.timeMs);
};
