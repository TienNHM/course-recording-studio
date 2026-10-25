// Pure helpers for the published chapters.json.
import type { TimelineChapter } from "../../../remotion/lesson/timeline";

export const DEFAULT_FIRST_CHAPTER_TITLE = "Intro";

// YouTube only shows chapters if the first one starts at 0:00. With an intro
// card (or a first chapter marker later in the take) the first chapter starts
// later, so a 0:00 chapter titled after the intro (or "Intro") is prepended.
export const ensureChapterAtZero = (
  chapters: TimelineChapter[],
  introTitle: string | null,
): TimelineChapter[] => {
  const sorted = [...chapters].sort((a, b) => a.timeMs - b.timeMs);
  const first = sorted[0];
  if (!first || first.timeMs <= 0) {
    return sorted;
  }
  const title = introTitle?.trim() || DEFAULT_FIRST_CHAPTER_TITLE;
  return [{ timeMs: 0, title }, ...sorted];
};

// Parses the chapters.json artifact emitted by the composition and returns the
// published file content.
export const buildPublishedChapters = (
  artifact: string,
  introTitle: string | null,
): string => {
  const parsed = JSON.parse(artifact) as TimelineChapter[];
  if (!Array.isArray(parsed)) {
    throw new Error("chapters.json artifact is not an array");
  }
  return JSON.stringify(ensureChapterAtZero(parsed, introTitle), null, 2);
};
