// Strings that appear in rendered lesson videos and in the published files
// (chapters.json, transcript.md). Driven by course.language.
// Pure module: used by the Remotion composition and by the render server.

export type LessonLanguage = "vi" | "en";

export const DEFAULT_LESSON_LANGUAGE: LessonLanguage = "vi";

export type LessonStrings = {
  // Outro card
  thanksForWatching: string;
  seeYouNext: string;
  // "Bài" / "Lesson" — prefix of lesson titles such as "Bài 1: …"
  lesson: string;
  // Chapter card: "Chương 2/4"
  chapter: string;
  chapterProgress: (index: number, total: number) => string;
  // Title for a chapter without a title
  fallbackChapterTitle: (index: number) => string;
  // 0:00 chapter in chapters.json / heading for text before the first chapter
  introChapter: string;
  // transcript.md
  transcriptHeading: string;
  // Placeholders (composition without a lesson)
  noLessonSelected: string;
  setLessonPathHint: string;
};

export const LESSON_STRINGS: Record<LessonLanguage, LessonStrings> = {
  vi: {
    thanksForWatching: "Cảm ơn bạn đã theo dõi",
    seeYouNext: "Hẹn gặp lại ở bài học tiếp theo",
    lesson: "Bài",
    chapter: "Chương",
    chapterProgress: (index, total) => `Chương ${index}/${total}`,
    fallbackChapterTitle: (index) => `Chương ${index}`,
    introChapter: "Mở đầu",
    transcriptHeading: "Nội dung bài học",
    noLessonSelected: "Chưa chọn bài học",
    setLessonPathHint:
      "Đặt prop lessonPath, ví dụ courses/khoa-hoc/module/bai-hoc",
  },
  en: {
    thanksForWatching: "Thanks for watching",
    seeYouNext: "See you in the next lesson",
    lesson: "Lesson",
    chapter: "Chapter",
    chapterProgress: (index, total) => `Chapter ${index}/${total}`,
    fallbackChapterTitle: (index) => `Chapter ${index}`,
    introChapter: "Intro",
    transcriptHeading: "Transcript",
    noLessonSelected: "No lesson selected",
    setLessonPathHint:
      "Set the lessonPath prop, e.g. courses/my-course/module/lesson",
  },
};

export const isLessonLanguage = (value: unknown): value is LessonLanguage =>
  value === "vi" || value === "en";

export const getLessonStrings = (language: string | null | undefined) =>
  LESSON_STRINGS[
    isLessonLanguage(language) ? language : DEFAULT_LESSON_LANGUAGE
  ];

export type ParsedLessonTitle = {
  // e.g. "Bài 1" / "Lesson 3" (as written in the title), or null
  label: string | null;
  // The title without the label
  title: string;
};

// Splits "Bài 1: Giới thiệu khóa học" into a label ("Bài 1") and the title.
// Both languages' prefixes are recognized regardless of the course language,
// the label is kept exactly as written.
export const parseLessonTitle = (raw: string): ParsedLessonTitle => {
  const title = raw.trim();
  const match =
    /^((?:bài|bai|lesson|lecture|part|phần)\s*\d+[a-z]?)\s*[:.\-–—|]\s*(.+)$/iu.exec(
      title,
    );
  if (!match) {
    return { label: null, title };
  }
  return {
    label: (match[1] as string).trim(),
    title: (match[2] as string).trim(),
  };
};

// Uses the fallback title for chapters without a title.
export const chapterTitleOrFallback = (
  title: string | null | undefined,
  index: number,
  language: LessonLanguage,
) => {
  const trimmed = title?.trim() ?? "";
  return trimmed === ""
    ? LESSON_STRINGS[language].fallbackChapterTitle(index + 1)
    : trimmed;
};
