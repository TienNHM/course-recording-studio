// Pure helpers that turn whisper.cpp output into @remotion/captions Caption[]
// and clean it up. No file system / process access, so they are unit-testable.
import type { Caption } from "@remotion/captions";
import type { TranscriptionJson } from "@remotion/install-whisper-cpp";

type Item = TranscriptionJson<true>["transcription"][number];
type Token = Item["tokens"][number];

// Gaps between words up to this long count as continuous speech: a word lasts
// until the next one starts.
export const MAX_WORD_GAP_MS = 1000;
// Before a longer gap (or at the end) a word lasts whisper's own estimate,
// clamped to this range.
export const MIN_WORD_MS = 200;
export const MAX_WORD_MS = 1000;

// Special tokens such as [_BEG_] and [_TT_123].
const isSpecialToken = (t: Token) => /^\[_.*\]$/.test(t.text);

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// Converts whisper.cpp JSON produced with `--split-on-word` (one item per
// word) into captions, one per word.
//
// Why not toCaptions() from @remotion/install-whisper-cpp:
// - Item offsets (whisper's own timestamps) are unreliable: around long pauses
//   they smear words over the silence or collapse whole sentences onto one
//   timestamp, and the first/last word absorb the silence at the edges. The
//   DTW token timestamps (`t_dtw`, from `--dtw`) are much closer to the audio,
//   so a word starts at the DTW time of its first token when available.
// - Words are kept whole, so text never contains split multi-byte characters.
export const whisperJsonToCaptions = (
  json: Pick<TranscriptionJson<true>, "transcription">,
): Caption[] => {
  const words: { text: string; startMs: number; estMs: number; p: number }[] =
    [];
  for (const item of json.transcription) {
    if (item.text.trim() === "") {
      continue;
    }
    const tokens = (item.tokens ?? []).filter((t) => !isSpecialToken(t));
    const firstToken = tokens[0];
    const dtw =
      firstToken && firstToken.t_dtw >= 0 ? firstToken.t_dtw * 10 : null;
    const prev = words[words.length - 1];
    const startMs = Math.max(dtw ?? item.offsets.from, prev ? prev.startMs : 0);
    words.push({
      text: item.text,
      startMs,
      estMs: item.offsets.to - item.offsets.from,
      p: firstToken?.p ?? item.tokens?.[0]?.p ?? 0,
    });
  }

  return words.map((w, i) => {
    const next = words[i + 1];
    const ownEnd = w.startMs + clamp(w.estMs, MIN_WORD_MS, MAX_WORD_MS);
    const endMs =
      next && next.startMs - w.startMs <= MAX_WORD_GAP_MS
        ? next.startMs
        : next
          ? Math.min(ownEnd, next.startMs)
          : ownEnd;
    return {
      text: i === 0 ? w.text.trimStart() : w.text,
      startMs: w.startMs,
      endMs: Math.max(w.startMs, endMs),
      timestampMs: w.startMs,
      confidence: w.p,
    };
  });
};

// A pause at least this long at the start/end of a take is where whisper
// hallucinates ("Các bạn hãy đăng ký kênh…", "Thanks for watching!").
export const HALLUCINATION_MIN_PAUSE_MS = 1500;
// Words must start this far inside the pause to be dropped: timestamps of real
// words near the edge of speech can be a bit off.
export const HALLUCINATION_MARGIN_MS = 500;
const EDGE_TOLERANCE_MS = 200;

// Drops captions that lie inside a long pause at the very start or end of
// the take (whisper invents text there). Only use this on captions whose
// timing comes from whisperJsonToCaptions (DTW), not on older captions whose
// edge words were stretched over the silence.
export const dropCaptionsInEdgePauses = ({
  captions,
  pauses,
  durationMs,
}: {
  captions: Caption[];
  pauses: { startMs: number; endMs: number }[];
  durationMs: number;
}): Caption[] => {
  const long = pauses.filter(
    (p) => p.endMs - p.startMs >= HALLUCINATION_MIN_PAUSE_MS,
  );
  const leading = long.find((p) => p.startMs <= EDGE_TOLERANCE_MS);
  const trailing = long.find((p) => p.endMs >= durationMs - EDGE_TOLERANCE_MS);
  const out = captions.filter((c) => {
    if (leading && c.endMs <= leading.endMs - HALLUCINATION_MARGIN_MS) {
      return false;
    }
    if (trailing && c.startMs >= trailing.startMs + HALLUCINATION_MARGIN_MS) {
      return false;
    }
    return true;
  });
  // The first caption never starts with a space (like toCaptions()).
  const first = out[0];
  if (first && first !== captions[0]) {
    out[0] = { ...first, text: first.text.trimStart() };
  }
  return out;
};

// Speech kept before a pause for a word moved out of it.
export const TAIL_WORD_MS = 250;

// Whisper's word timestamps drift into pauses: the last word before a pause
// often "starts" well inside it, the first word after it slightly before its
// end. A caption whose midpoint lies in a removed pause disappears from the
// published subtitles/transcript, so words are moved out of detected pauses:
// - a word starting inside a pause moves to the nearer edge: just before the
//   pause (end of the previous speech) or to its end (start of the next);
// - a word starting before a pause ends where the pause starts.
// Start times stay non-decreasing and words never overlap.
export const fitCaptionsToPauses = ({
  captions,
  pauses,
}: {
  captions: Caption[];
  pauses: { startMs: number; endMs: number }[];
}): Caption[] => {
  const sorted = [...pauses].sort((a, b) => a.startMs - b.startMs);
  const out: Caption[] = [];
  for (const caption of captions) {
    const c = { ...caption };
    const prev = out[out.length - 1];
    const inside = sorted.find(
      (p) => p.startMs < c.startMs && c.startMs < p.endMs,
    );
    if (inside) {
      if (c.startMs - inside.startMs <= inside.endMs - c.startMs) {
        // Share the time with the previous word when it is close.
        const prevStart = prev?.startMs ?? 0;
        c.startMs = Math.round(
          Math.max(
            inside.startMs - TAIL_WORD_MS,
            (prevStart + inside.startMs) / 2,
          ),
        );
        c.endMs = inside.startMs;
      } else {
        c.startMs = inside.endMs;
        c.endMs = Math.max(c.endMs, inside.endMs);
      }
    }
    c.startMs = Math.max(c.startMs, prev?.startMs ?? 0);
    const next = sorted.find(
      (p) => c.startMs < p.startMs && p.startMs < c.endMs,
    );
    if (next) {
      c.endMs = next.startMs;
    }
    c.endMs = Math.max(c.startMs, c.endMs);
    if (prev && prev.endMs > c.startMs) {
      prev.endMs = Math.max(prev.startMs, c.startMs);
    }
    c.timestampMs = c.startMs;
    out.push(c);
  }
  return out;
};
