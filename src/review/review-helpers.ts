// Pure helpers of the Review page (no React, no DOM) — unit-tested in
// tests/review-page-helpers.test.ts.
import type { Caption } from "@remotion/captions";
import type { EditPlan, JobState } from "../../config/course";
import {
  mapOriginalToOutputSnapped,
  mapOutputToOriginal,
  type TimelineSegment,
} from "../../remotion/lesson/timeline";
import { inferDurationMs } from "../../scripts/server/production/edit-plan";
import { formatDuration } from "../i18n/format";

export type Cut = EditPlan["cuts"][number];
export type Chapter = EditPlan["chapters"][number];
export type CutChange = { index: number; accepted: boolean };

/** Duration of the original take (the plan's own value, else inferred). */
export const planDurationMs = (plan: EditPlan): number =>
  plan.durationMs ?? inferDurationMs(plan);

// ---------------------------------------------------------------------------
// Summary

export type ReviewSummary = {
  rawMs: number;
  /** Kept content (without intro / outro cards). */
  finalMs: number;
  removedMs: number;
  /** 0..1 share of the take that is removed. */
  removedRatio: number;
  acceptedCuts: number;
  pendingSuggestions: number;
  chapters: number;
  /** Non-empty caption words; null without a transcript. */
  words: number | null;
};

export const computeReviewSummary = (
  plan: EditPlan,
  captions: Caption[] | null,
): ReviewSummary => {
  const rawMs = planDurationMs(plan);
  const finalMs = plan.segments.reduce(
    (acc, s) => acc + Math.max(0, s.endMs - s.startMs),
    0,
  );
  const removedMs = Math.max(0, rawMs - finalMs);
  return {
    rawMs,
    finalMs,
    removedMs,
    removedRatio: rawMs > 0 ? removedMs / rawMs : 0,
    acceptedCuts: plan.cuts.filter((c) => c.accepted).length,
    pendingSuggestions: plan.cuts.filter((c) => !c.accepted).length,
    chapters: plan.chapters.length,
    words: captions
      ? captions.filter((c) => c.text.trim().length > 0).length
      : null,
  };
};

// ---------------------------------------------------------------------------
// Bulk cut actions

/**
 * What automatic post-production decides for a cut: trims and "cut" markers
 * are always applied, silences only with `autoRemoveSilence`.
 */
export const defaultCutAccepted = (
  cut: Pick<Cut, "reason">,
  autoRemoveSilence: boolean,
): boolean => (cut.reason === "silence" ? autoRemoveSilence : true);

/** Changes that bring every cut back to the automatic decision. */
export const resetCutChanges = (
  cuts: Cut[],
  autoRemoveSilence: boolean,
): CutChange[] =>
  cuts.flatMap((cut, index) => {
    const accepted = defaultCutAccepted(cut, autoRemoveSilence);
    return cut.accepted === accepted ? [] : [{ index, accepted }];
  });

/** Changes that accept (or reject) every silence suggestion. */
export const setSilenceChanges = (
  cuts: Cut[],
  accepted: boolean,
): CutChange[] =>
  cuts.flatMap((cut, index) =>
    cut.reason === "silence" && cut.accepted !== accepted
      ? [{ index, accepted }]
      : [],
  );

/**
 * Previous / next cut (by start time) for keyboard navigation. Starts from
 * the focused cut, or from the playhead when nothing is focused.
 */
export const stepCut = (
  cuts: Pick<Cut, "startMs">[],
  focused: number | null,
  playheadMs: number,
  direction: 1 | -1,
): number | null => {
  const order = cuts
    .map((c, index) => ({ startMs: c.startMs, index }))
    .sort((a, b) => a.startMs - b.startMs || a.index - b.index);
  if (order.length === 0) {
    return null;
  }
  const position =
    focused === null ? -1 : order.findIndex((o) => o.index === focused);
  if (position >= 0) {
    const next = order[position + direction];
    return next ? next.index : (order[position] as { index: number }).index;
  }
  if (direction === 1) {
    const next = order.find((o) => o.startMs > playheadMs + 1);
    return (next ?? (order[order.length - 1] as { index: number })).index;
  }
  const previous = [...order].reverse().find((o) => o.startMs < playheadMs - 1);
  return (previous ?? (order[0] as { index: number })).index;
};

// ---------------------------------------------------------------------------
// Timeline bar geometry (percentages of the original take)

export type TimelineBox = { leftPct: number; widthPct: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const msToPct = (ms: number, durationMs: number): number =>
  durationMs > 0 ? clamp((ms / durationMs) * 100, 0, 100) : 0;

export const rangeToBox = (
  startMs: number,
  endMs: number,
  durationMs: number,
): TimelineBox => {
  const leftPct = msToPct(Math.min(startMs, endMs), durationMs);
  const rightPct = msToPct(Math.max(startMs, endMs), durationMs);
  return { leftPct, widthPct: rightPct - leftPct };
};

/** Position on the bar (0..1 of its width) → time on the original take. */
export const fractionToMs = (fraction: number, durationMs: number): number =>
  Math.round(clamp(fraction, 0, 1) * Math.max(0, durationMs));

export type TimelineGeometry = {
  segments: (TimelineBox & { startMs: number; endMs: number })[];
  cuts: (TimelineBox & {
    index: number;
    cut: Cut;
    kind: "accepted" | "suggested";
  })[];
  chapters: { index: number; chapter: Chapter; leftPct: number }[];
  /** Evenly spaced ruler labels. */
  ticks: { ms: number; leftPct: number }[];
};

export const buildTimelineGeometry = ({
  durationMs,
  segments,
  cuts,
  chapters,
  tickCount = 5,
}: {
  durationMs: number;
  segments: TimelineSegment[];
  cuts: Cut[];
  chapters: Chapter[];
  tickCount?: number;
}): TimelineGeometry => ({
  segments: segments.map((s) => ({
    ...s,
    ...rangeToBox(s.startMs, s.endMs, durationMs),
  })),
  cuts: cuts.map((cut, index) => ({
    index,
    cut,
    kind: cut.accepted ? "accepted" : "suggested",
    ...rangeToBox(cut.startMs, cut.endMs, durationMs),
  })),
  chapters: chapters
    .map((chapter, index) => ({
      index,
      chapter,
      leftPct: msToPct(chapter.timeMs, durationMs),
    }))
    .sort((a, b) => a.leftPct - b.leftPct),
  ticks:
    durationMs > 0 && tickCount >= 2
      ? Array.from({ length: tickCount }, (_, i) => {
          const ms = Math.round((durationMs * i) / (tickCount - 1));
          return { ms, leftPct: msToPct(ms, durationMs) };
        })
      : [],
});

/**
 * Player position (ms on the rendered video, intro included) → time on the
 * original take. `introMs` is `info.introDurationInMs` (where the lesson
 * content starts; transitions overlap the intro). During the intro the
 * playhead sits on the first kept frame; after the content (outro) on the
 * last one.
 */
export const playerMsToOriginalMs = (
  playerMs: number,
  introMs: number,
  segments: TimelineSegment[],
): number | null => mapOutputToOriginal(playerMs - introMs, segments);

/** Inverse of playerMsToOriginalMs(); times inside a cut snap forward. */
export const originalMsToPlayerMs = (
  originalMs: number,
  introMs: number,
  segments: TimelineSegment[],
): number | null => {
  const output = mapOriginalToOutputSnapped(originalMs, segments);
  return output === null ? null : output + introMs;
};

// ---------------------------------------------------------------------------
// Chapters

export type ChapterDraft = {
  /** Stable React key. */
  key: string;
  /** Parsed time; null while the text is not a valid timecode. */
  timeMs: number | null;
  timeText: string;
  title: string;
};

export type ChapterError =
  | "invalidTime"
  | "emptyTitle"
  | "duplicateTime"
  | "outOfRange";

export type ChapterCheck = {
  errors: ChapterError[];
  /**
   * The chapter starts inside a removed part: on save it moves to the next
   * kept part (`movedToMs`), or is dropped when there is none (null).
   */
  insideCut: { movedToMs: number | null } | null;
};

const relocate = (timeMs: number, segments: TimelineSegment[]) => {
  if (segments.some((s) => timeMs >= s.startMs && timeMs < s.endMs)) {
    return timeMs;
  }
  return segments.find((s) => s.startMs >= timeMs)?.startMs ?? null;
};

export const validateChapters = (
  drafts: Pick<ChapterDraft, "timeMs" | "title">[],
  { durationMs, segments }: { durationMs: number; segments: TimelineSegment[] },
): ChapterCheck[] => {
  const effective = drafts.map((d) =>
    d.timeMs === null ? null : relocate(d.timeMs, segments),
  );
  return drafts.map((draft, i) => {
    const errors: ChapterError[] = [];
    let insideCut: ChapterCheck["insideCut"] = null;
    if (draft.timeMs === null) {
      errors.push("invalidTime");
    } else if (draft.timeMs < 0 || (durationMs > 0 && draft.timeMs > durationMs)) {
      errors.push("outOfRange");
    } else {
      const moved = effective[i] ?? null;
      if (moved !== draft.timeMs) {
        insideCut = { movedToMs: moved };
      }
      const duplicate = drafts.some(
        (other, j) =>
          j !== i &&
          other.timeMs !== null &&
          (other.timeMs === draft.timeMs ||
            (moved !== null && effective[j] === moved)),
      );
      if (duplicate) {
        errors.push("duplicateTime");
      }
    }
    if (!draft.title.trim()) {
      errors.push("emptyTitle");
    }
    return { errors, insideCut };
  });
};

/** Sorts drafts by time; drafts without a valid time keep their place at the end. */
export const sortChapterDrafts = <T extends Pick<ChapterDraft, "timeMs">>(
  drafts: T[],
): T[] =>
  drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      if (a.d.timeMs === null || b.d.timeMs === null) {
        return (a.d.timeMs === null ? 1 : 0) - (b.d.timeMs === null ? 1 : 0) || a.i - b.i;
      }
      return a.d.timeMs - b.d.timeMs || a.i - b.i;
    })
    .map(({ d }) => d);

/**
 * YouTube description chapters: one "00:00 Title" line per chapter, sorted,
 * starting at 00:00 (YouTube ignores the list otherwise). If the first
 * chapter starts later, `firstTitle` is inserted at 00:00, or — without it —
 * the first chapter is moved to 00:00. Chapters on the same second keep the
 * first one.
 */
export const formatYouTubeChapters = (
  chapters: Chapter[],
  options: { firstTitle?: string } = {},
): string => {
  const sorted = [...chapters]
    .map((c) => ({ seconds: Math.max(0, Math.floor(c.timeMs / 1000)), title: c.title.trim() }))
    .filter((c) => c.title !== "")
    .sort((a, b) => a.seconds - b.seconds);
  const lines: { seconds: number; title: string }[] = [];
  for (const chapter of sorted) {
    if (lines.some((l) => l.seconds === chapter.seconds)) {
      continue;
    }
    lines.push(chapter);
  }
  const first = lines[0];
  if (first && first.seconds > 0) {
    const firstTitle = options.firstTitle?.trim();
    if (firstTitle) {
      lines.unshift({ seconds: 0, title: firstTitle });
    } else {
      first.seconds = 0;
    }
  }
  return lines
    .map((l) => `${formatDuration(l.seconds * 1000)} ${l.title}`)
    .join("\n");
};

// ---------------------------------------------------------------------------
// Transcript: search, glossary and low-confidence highlighting

/**
 * Case- and diacritics-insensitive form of `text` ("Đường" → "duong") plus,
 * for every folded character, the index of the original character.
 */
export const foldWithMap = (text: string): { folded: string; map: number[] } => {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const piece = (text[i] as string)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/đ/g, "d");
    for (const ch of piece) {
      folded += ch;
      map.push(i);
    }
  }
  return { folded, map };
};

export const foldText = (text: string) => foldWithMap(text).folded;

/** Whether `text` contains `query` (case/diacritics-insensitive). */
export const matchesQuery = (text: string, query: string): boolean => {
  const q = foldText(query.trim());
  return q === "" || foldText(text).includes(q);
};

export type TextRange = { start: number; end: number };

const isWordChar = (ch: string | undefined) =>
  ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Ranges (in `text`) where `needle` occurs. With `wholeWord`, matches must not
 * be glued to letters/digits on either side.
 */
export const findRanges = (
  text: string,
  needle: string,
  wholeWord = false,
): TextRange[] => {
  const n = foldText(needle.trim());
  if (n === "") {
    return [];
  }
  const { folded, map } = foldWithMap(text);
  const ranges: TextRange[] = [];
  let from = 0;
  for (;;) {
    const at = folded.indexOf(n, from);
    if (at < 0) {
      break;
    }
    const endAt = at + n.length;
    if (!wholeWord || (!isWordChar(folded[at - 1]) && !isWordChar(folded[endAt]))) {
      ranges.push({
        start: map[at] as number,
        end: (map[endAt - 1] as number) + 1,
      });
    }
    from = at + 1;
  }
  return ranges;
};

export type GlossaryTerm = { term: string; aliases: string[] };

export type TranscriptToken = {
  text: string;
  /** Index of the caption word this text belongs to. */
  wordIndex: number;
  /** Whisper confidence below the threshold. */
  lowConfidence: boolean;
  /** Matches a glossary term as written. */
  term: string | null;
  /** Matches a known misspelling (alias) of this glossary term. */
  aliasOf: string | null;
  search: boolean;
};

export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Splits the words of one transcript line into styled tokens: low-confidence
 * words, glossary terms, glossary aliases (likely misrecognitions) and search
 * matches. Ranges may span several words.
 */
export const buildLineTokens = (
  words: Pick<Caption, "text" | "confidence">[],
  {
    glossary = [],
    query = "",
    threshold = LOW_CONFIDENCE_THRESHOLD,
  }: { glossary?: GlossaryTerm[]; query?: string; threshold?: number } = {},
): TranscriptToken[] => {
  const text = words.map((w) => w.text).join("");
  const wordAt: number[] = [];
  words.forEach((w, i) => {
    for (let k = 0; k < w.text.length; k++) {
      wordAt.push(i);
    }
  });

  const termAt: (string | null)[] = new Array(text.length).fill(null);
  const aliasAt: (string | null)[] = new Array(text.length).fill(null);
  const searchAt: boolean[] = new Array(text.length).fill(false);
  for (const entry of glossary) {
    for (const r of findRanges(text, entry.term, true)) {
      termAt.fill(entry.term, r.start, r.end);
    }
    for (const alias of entry.aliases) {
      if (foldText(alias) === foldText(entry.term)) {
        continue;
      }
      for (const r of findRanges(text, alias, true)) {
        if (termAt.slice(r.start, r.end).every((t) => t === null)) {
          aliasAt.fill(entry.term, r.start, r.end);
        }
      }
    }
  }
  for (const r of findRanges(text, query)) {
    searchAt.fill(true, r.start, r.end);
  }

  const tokens: TranscriptToken[] = [];
  for (let i = 0; i < text.length; i++) {
    const wordIndex = wordAt[i] as number;
    const confidence = words[wordIndex]?.confidence;
    const style = {
      wordIndex,
      lowConfidence:
        typeof confidence === "number" &&
        confidence < threshold &&
        /\S/.test(text[i] as string),
      term: termAt[i] ?? null,
      aliasOf: aliasAt[i] ?? null,
      search: searchAt[i] ?? false,
    };
    const last = tokens[tokens.length - 1];
    if (
      last &&
      last.wordIndex === style.wordIndex &&
      last.lowConfidence === style.lowConfidence &&
      last.term === style.term &&
      last.aliasOf === style.aliasOf &&
      last.search === style.search
    ) {
      last.text += text[i];
    } else {
      tokens.push({ text: text[i] as string, ...style });
    }
  }
  return tokens;
};

/** Replaces every glossary alias in `text` with its term. */
export const fixAliases = (text: string, glossary: GlossaryTerm[]): string => {
  let result = text;
  for (const entry of glossary) {
    for (const alias of entry.aliases) {
      if (foldText(alias) === foldText(entry.term)) {
        continue;
      }
      const ranges = findRanges(result, alias, true);
      for (const r of [...ranges].reverse()) {
        result = result.slice(0, r.start) + entry.term + result.slice(r.end);
      }
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// Export progress

/**
 * Rough time left for a job, from its progress and the time since it was
 * created. Null while there is too little progress to say.
 */
export const estimateRemainingMs = (
  job: Pick<JobState, "progress" | "createdAt">,
  nowMs: number,
): number | null => {
  const started = Date.parse(job.createdAt);
  const p = job.progress;
  if (!Number.isFinite(started) || !(p >= 0.03) || p >= 1) {
    return null;
  }
  const elapsed = nowMs - started;
  if (elapsed < 3000) {
    return null;
  }
  return Math.max(0, Math.round((elapsed * (1 - p)) / p));
};
