// Transcript helpers on top of the word-level captions of a take (pure).
import type { Caption } from "@remotion/captions";
import { formatMs } from "./edit-plan-tools";

export type TranscriptLine = {
  startMs: number;
  endMs: number;
  // Caption indices covered by this line (inclusive).
  fromCaption: number;
  toCaption: number;
  text: string;
};

export type Transcript = {
  text: string;
  lines: TranscriptLine[];
  captionCount: number;
};

const PAUSE_BREAK_MS = 700;
const MAX_LINE_MS = 8000;
const MAX_LINE_CHARS = 120;

// Groups captions into readable lines: a new line starts after a sentence end,
// a pause, or when the line gets too long.
export const buildTranscript = (captions: Caption[]): Transcript => {
  const lines: TranscriptLine[] = [];
  let current: TranscriptLine | null = null;
  captions.forEach((c, i) => {
    const prev = captions[i - 1];
    const startNew =
      !current ||
      (prev !== undefined && c.startMs - prev.endMs > PAUSE_BREAK_MS) ||
      /[.?!…]\s*$/.test(current.text) ||
      c.endMs - current.startMs > MAX_LINE_MS ||
      current.text.length > MAX_LINE_CHARS;
    if (startNew) {
      if (current) {
        lines.push(current);
      }
      current = {
        startMs: c.startMs,
        endMs: c.endMs,
        fromCaption: i,
        toCaption: i,
        text: "",
      };
    }
    const line = current as TranscriptLine;
    line.text += c.text;
    line.endMs = c.endMs;
    line.toCaption = i;
  });
  if (current) {
    lines.push(current);
  }
  const trimmed = lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text !== "");
  return {
    text: captions
      .map((c) => c.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
    lines: trimmed,
    captionCount: captions.length,
  };
};

export const formatTimedLines = (lines: TranscriptLine[]) =>
  lines.map((l) => `[${formatMs(l.startMs)}] ${l.text}`).join("\n");

export type TextReplacement = {
  find: string;
  replace: string;
  caseSensitive?: boolean;
  // Only match whole words (Unicode-aware, works with Vietnamese).
  wholeWord?: boolean;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replaces phrases in the transcript, even when a phrase spans several
// captions (words). Timing and the number of captions never change: the
// replacement goes into the caption where the match starts and the other
// captions covered by the match lose the matched characters.
export const replaceInCaptions = (
  captions: Caption[],
  replacements: TextReplacement[],
): { captions: Caption[]; replaced: number } => {
  let texts = captions.map((c) => c.text);
  let replaced = 0;
  for (const r of replacements) {
    if (r.find === "") {
      continue;
    }
    const owners: number[] = [];
    texts.forEach((t, i) => {
      for (let k = 0; k < t.length; k++) {
        owners.push(i);
      }
    });
    const joined = texts.join("");
    const pattern = r.wholeWord
      ? `(?<![\\p{L}\\p{N}_])${escapeRegExp(r.find)}(?![\\p{L}\\p{N}_])`
      : escapeRegExp(r.find);
    const regex = new RegExp(pattern, `gu${r.caseSensitive ? "" : "i"}`);
    const next: string[] = texts.map(() => "");
    const append = (k: number, value: string) => {
      const owner = owners[k] as number;
      next[owner] = (next[owner] ?? "") + value;
    };
    let cursor = 0;
    for (const match of joined.matchAll(regex)) {
      const start = match.index;
      for (let k = cursor; k < start; k++) {
        append(k, joined.charAt(k));
      }
      append(start, r.replace);
      cursor = start + match[0].length;
      replaced++;
    }
    for (let k = cursor; k < joined.length; k++) {
      append(k, joined.charAt(k));
    }
    texts = next;
  }
  return {
    captions: captions.map((c, i) => ({ ...c, text: texts[i] as string })),
    replaced,
  };
};

// Applies per-caption text edits by index.
export const editCaptionTexts = (
  captions: Caption[],
  edits: { index: number; text: string }[],
): Caption[] => {
  const next = captions.map((c) => ({ ...c }));
  for (const e of edits) {
    const caption = next[e.index];
    if (!caption) {
      throw new Error(
        `No caption with index ${e.index} (there are ${captions.length})`,
      );
    }
    caption.text = e.text;
  }
  return next;
};
