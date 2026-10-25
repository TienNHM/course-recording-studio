// Pure helpers for published subtitle / transcript files.
import type { Caption } from "@remotion/captions";
import type { EditPlan } from "../../../config/course";
import type { LessonLanguage } from "../../../remotion/lesson/i18n";
import {
  DEFAULT_LESSON_LANGUAGE,
  getLessonStrings,
} from "../../../remotion/lesson/i18n";

// SRT → WebVTT: add the header, use "." as the millisecond separator in
// timings, drop the numeric cue counters (optional in VTT, kept harmless
// otherwise) and normalize line endings.
export const srtToVtt = (srt: string): string => {
  const blocks = srt
    .replace(new RegExp("^\\uFEFF"), "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim().length > 0);

  const cues = blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.length > 1 && /^\d+$/.test((lines[0] as string).trim())) {
      lines.shift();
    }
    const [timing, ...text] = lines;
    const vttTiming = (timing ?? "").replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      "$1.$2",
    );
    return [vttTiming, ...text].join("\n");
  });

  return `WEBVTT\n\n${cues.join("\n\n")}${cues.length ? "\n" : ""}`;
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const isKept = (caption: Caption, segments: EditPlan["segments"]) => {
  const mid = (caption.startMs + caption.endMs) / 2;
  return segments.some((s) => mid >= s.startMs && mid < s.endMs);
};

// transcript.md: lesson title + the plain text of the captions that survive
// the edit (caption midpoint inside a kept segment), grouped by chapter.
// Text before the first chapter goes under a localized "Mở đầu" / "Intro"
// heading (no heading at all if the lesson has no chapters).
export const buildTranscriptMarkdown = ({
  title,
  captions,
  plan,
  language = DEFAULT_LESSON_LANGUAGE,
}: {
  title: string;
  captions: Caption[];
  plan: Pick<EditPlan, "segments" | "chapters">;
  language?: LessonLanguage;
}): string => {
  const strings = getLessonStrings(language);
  const chapters = [...plan.chapters].sort((a, b) => a.timeMs - b.timeMs);
  const kept = captions.filter((c) => isKept(c, plan.segments));

  type Group = { title: string | null; startMs: number; text: string[] };
  const groups: Group[] = [
    { title: null, startMs: -Infinity, text: [] },
    ...chapters.map((c) => ({ title: c.title, startMs: c.timeMs, text: [] })),
  ];

  for (const caption of kept) {
    let group = groups[0] as Group;
    for (const g of groups) {
      if (caption.startMs >= g.startMs) {
        group = g;
      }
    }
    group.text.push(caption.text);
  }

  const parts = [`# ${collapse(title)}`];
  for (const group of groups) {
    const text = collapse(group.text.join(""));
    if (group.title !== null) {
      parts.push(`## ${collapse(group.title) || strings.introChapter}`);
    } else if (text && chapters.length > 0) {
      parts.push(`## ${strings.introChapter}`);
    }
    if (text) {
      parts.push(text);
    }
  }
  return parts.join("\n\n") + "\n";
};
