// Groups word-level captions into editable lines and writes edited line text
// back into the words without touching any timing.
import type { Caption } from "@remotion/captions";

export type TranscriptLine = {
  // Index of the first word in the captions array
  start: number;
  // Exclusive end index
  end: number;
  startMs: number;
  endMs: number;
  text: string;
};

// A new line starts after a pause, after sentence punctuation or when the
// current line gets long.
const PAUSE_MS = 1000;
const MAX_WORDS = 14;

export const groupIntoLines = (captions: Caption[]): TranscriptLine[] => {
  const lines: TranscriptLine[] = [];
  let start = 0;
  for (let i = 0; i < captions.length; i++) {
    const word = captions[i] as Caption;
    const next = captions[i + 1];
    const endsSentence = /[.!?…]["')\]]?$/.test(word.text.trim());
    const pause = next ? next.startMs - word.endMs >= PAUSE_MS : true;
    if (!next || endsSentence || pause || i + 1 - start >= MAX_WORDS) {
      const words = captions.slice(start, i + 1);
      lines.push({
        start,
        end: i + 1,
        startMs: (words[0] as Caption).startMs,
        endMs: word.endMs,
        text: words
          .map((w) => w.text)
          .join("")
          .trim(),
      });
      start = i + 1;
    }
  }
  return lines;
};

// Writes `text` into the words [line.start, line.end). Tokens are assigned to
// words in order (keeping each word's leading-space style); extra tokens are
// appended to the last word, missing tokens leave words empty.
export const applyLineText = (
  captions: Caption[],
  line: Pick<TranscriptLine, "start" | "end">,
  text: string,
): Caption[] => {
  const count = line.end - line.start;
  if (count <= 0) {
    return captions;
  }
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push(
      i === count - 1 ? tokens.slice(i).join(" ") : (tokens[i] ?? ""),
    );
  }
  return captions.map((caption, index) => {
    if (index < line.start || index >= line.end) {
      return caption;
    }
    const piece = pieces[index - line.start] ?? "";
    const leading = /^\s/.test(caption.text) ? " " : "";
    return { ...caption, text: piece ? `${leading}${piece}` : "" };
  });
};
