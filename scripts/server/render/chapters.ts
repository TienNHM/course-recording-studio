// Pure helpers for the published chapters.json.
import type { LessonLanguage } from "../../../remotion/lesson/i18n";
import {
  DEFAULT_LESSON_LANGUAGE,
  getLessonStrings,
} from "../../../remotion/lesson/i18n";
import type { TimelineChapter } from "../../../remotion/lesson/timeline";

// YouTube only shows chapters if the first one starts at 0:00. With an intro
// card (or a first chapter marker later in the take) the first chapter starts
// later, so a localized 0:00 chapter ("Mở đầu" / "Intro") is prepended.
export const ensureChapterAtZero = (
  chapters: TimelineChapter[],
  language: LessonLanguage = DEFAULT_LESSON_LANGUAGE,
): TimelineChapter[] => {
  const sorted = [...chapters].sort((a, b) => a.timeMs - b.timeMs);
  const first = sorted[0];
  if (!first || first.timeMs <= 0) {
    return sorted;
  }
  return [
    { timeMs: 0, title: getLessonStrings(language).introChapter },
    ...sorted,
  ];
};

// Parses the chapters.json artifact emitted by the composition and returns the
// published file content.
export const buildPublishedChapters = (
  artifact: string,
  language: LessonLanguage = DEFAULT_LESSON_LANGUAGE,
): string => {
  const parsed = JSON.parse(artifact) as TimelineChapter[];
  if (!Array.isArray(parsed)) {
    throw new Error("chapters.json artifact is not an array");
  }
  return JSON.stringify(ensureChapterAtZero(parsed, language), null, 2);
};
