import type { Caption } from "@remotion/captions";
import { joinBackticks } from "../../processing/join-backticks";
import { postprocessCaptions } from "../../processing/postprocess-subs";
import type { UnserializedSrt } from "./serialize-srt";

export type SrtCueRules = {
  // The SRT standard recommends not more than 42 characters per line
  maxCharsPerLine: number;
  maxLines: number;
  // A cue never lasts longer than this…
  maxCueDurationMs: number;
  // …and never spans a pause between two words that is at least this long.
  minPauseMs: number;
  // A sentence end starts a new cue once the cue has at least this many chars.
  sentenceBreakMinChars: number;
};

export const DEFAULT_SRT_CUE_RULES: SrtCueRules = {
  maxCharsPerLine: 42,
  maxLines: 2,
  maxCueDurationMs: 7000,
  minPauseMs: 1200,
  sentenceBreakMinChars: 12,
};

const cueText = (words: Caption[]) =>
  words
    .map((w) => w.text.trim())
    .filter((t) => t !== "")
    .join(" ");

// Greedy line wrapping (used to check whether a cue still fits).
const greedyLineCount = (text: string, maxCharsPerLine: number) => {
  let lines = 0;
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length > maxCharsPerLine && current !== "") {
      lines++;
      current = word;
    } else {
      current = candidate;
    }
  }
  return current === "" ? lines : lines + 1;
};

// Splits a cue into at most two balanced lines (shortest longest line).
export const wrapCueText = (
  text: string,
  maxCharsPerLine = DEFAULT_SRT_CUE_RULES.maxCharsPerLine,
): string => {
  if (text.length <= maxCharsPerLine) {
    return text;
  }
  const words = text.split(" ");
  let best: [string, string] | null = null;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ");
    const second = words.slice(i).join(" ");
    if (
      best === null ||
      Math.max(first.length, second.length) <
        Math.max(best[0].length, best[1].length)
    ) {
      best = [first, second];
    }
  }
  return best ? best.join("\n") : text;
};

const endsSentence = (word: Caption) =>
  /[.!?…]["'”’)]*$/u.test(word.text.trim());

const endsClause = (word: Caption) =>
  /[,;:.!?…]["'”’)]*$/u.test(word.text.trim());

// Index of the last word ending with punctuation in the second half of a
// full cue (so that the carried-over rest stays short), or null.
const findPunctuationSplit = (words: Caption[]): number | null => {
  for (let i = words.length - 2; i >= Math.floor(words.length / 2); i--) {
    if (endsClause(words[i] as Caption)) {
      return i;
    }
  }
  return null;
};

// Groups words into subtitle cues. A new cue starts when
// - the pause before a word is ≥ minPauseMs (a cue never spans a pause),
// - the cue would not fit into maxLines × maxCharsPerLine or would last
//   longer than maxCueDurationMs (then it preferably ends at a punctuation
//   mark in its second half and the rest is carried over),
// - the previous word ends a sentence and the cue is long enough already,
// - the previous word has pageBreakAfter set.
export const groupCaptionsIntoCues = (
  captions: Caption[],
  rules: SrtCueRules = DEFAULT_SRT_CUE_RULES,
): Caption[][] => {
  const cues: Caption[][] = [];
  let current: Caption[] = [];

  for (const word of captions) {
    const previous = current[current.length - 1];
    if (previous) {
      const first = current[0] as Caption;
      const candidateText = cueText([...current, word]);
      const pause = word.startMs - previous.endMs;
      const hardBreak =
        pause >= rules.minPauseMs ||
        (endsSentence(previous) &&
          cueText(current).length >= rules.sentenceBreakMinChars) ||
        Boolean(previous.pageBreakAfter);
      const full =
        greedyLineCount(candidateText, rules.maxCharsPerLine) >
          rules.maxLines || word.endMs - first.startMs > rules.maxCueDurationMs;

      if (hardBreak) {
        cues.push(current);
        current = [];
      } else if (full) {
        // The cue is full: rather than cutting mid-phrase, end it after the
        // last punctuation in its second half and carry the rest over.
        const splitAfter = findPunctuationSplit(current);
        if (splitAfter === null) {
          cues.push(current);
          current = [];
        } else {
          cues.push(current.slice(0, splitAfter + 1));
          current = current.slice(splitAfter + 1);
        }
      }
    }
    current.push(word);
  }

  if (current.length > 0) {
    cues.push(current);
  }
  return cues;
};

export const calculateSrt = ({
  startFrame,
  captions,
  fps,
  rules = DEFAULT_SRT_CUE_RULES,
}: {
  captions: Caption[];
  startFrame: number;
  fps: number;
  rules?: SrtCueRules;
}): UnserializedSrt[] => {
  const postprocessed = joinBackticks(postprocessCaptions(captions));
  const cues = groupCaptionsIntoCues(postprocessed, rules);
  const offset = -(startFrame / fps) * 1000;

  const srtSegments: UnserializedSrt[] = [];
  for (const cue of cues) {
    const first = cue[0];
    const last = cue[cue.length - 1];
    if (!first || !last) {
      continue;
    }

    const text = cueText(cue);
    if (text === "") {
      continue;
    }

    srtSegments.push({
      firstTimestampMs: Math.max(0, Math.round(first.startMs + offset)),
      lastTimestampMs: Math.max(0, last.endMs + offset),
      text:
        rules.maxLines > 1 ? wrapCueText(text, rules.maxCharsPerLine) : text,
      captions: cue,
    });
  }

  return srtSegments;
};
