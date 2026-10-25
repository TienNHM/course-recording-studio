import { Caption } from "@remotion/captions";

const autocorrectWord = (caption: Caption): Caption => {
  // Replace a single word with another one
  if (caption.text === " github") {
    return {
      ...caption,
      text: " GitHub",
    };
  }

  // Replace a pattern with a specific word
  if (caption.text.match(/ remotion\.$/)) {
    return {
      ...caption,
      text: caption.text.replace(/ remotion.$/, " Remotion."),
    };
  }
  // Add your own function to remap specific words.

  return caption;
};

export const autocorrectWords = (captions: Caption[]): Caption[] => {
  return captions.map(autocorrectWord);
};

// ---------------------------------------------------------------------------
// Glossary: replace aliases / misheard variants with the canonical term.
// Matching is case-insensitive and word-boundary aware (Unicode letters and
// digits count as word characters, so Vietnamese diacritics work).
// The canonical term itself is also matched, which fixes its casing.
// ---------------------------------------------------------------------------

export type GlossaryEntry = { term: string; aliases?: string[] };

const WORD_CHAR = "[\\p{L}\\p{N}_]";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalize = (s: string) => s.normalize("NFC").toLocaleLowerCase();

// Strip leading/trailing whitespace and punctuation from a caption token.
const coreOf = (text: string) => {
  const match = text.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su);
  return {
    leading: match?.[1] ?? "",
    core: match?.[2] ?? text,
    trailing: match?.[3] ?? "",
  };
};

type Rule = { words: string[]; pattern: RegExp; term: string };

const makeRules = (glossary: GlossaryEntry[]): Rule[] => {
  const rules: Rule[] = [];
  for (const entry of glossary) {
    const term = entry.term.normalize("NFC").trim();
    if (!term) {
      continue;
    }
    const variants = new Set(
      [term, ...(entry.aliases ?? [])]
        .map((a) => a.normalize("NFC").trim())
        .filter(Boolean),
    );
    for (const variant of variants) {
      const words = normalize(variant).split(/\s+/);
      rules.push({
        words,
        term,
        pattern: new RegExp(
          `(?<!${WORD_CHAR})${words.map(escapeRegex).join("\\s+")}(?!${WORD_CHAR})`,
          "giu",
        ),
      });
    }
  }
  // Longest variants first, so "visual studio code" wins over "code".
  return rules.sort((a, b) => b.words.length - a.words.length);
};

// Text-only version (e.g. for transcript.md or titles).
export const applyGlossaryToText = (
  text: string,
  glossary: GlossaryEntry[],
): string => {
  let out = text.normalize("NFC");
  for (const rule of makeRules(glossary)) {
    out = out.replace(rule.pattern, rule.term);
  }
  return out;
};

// Caption version. Whisper usually emits one word per caption, so multi-word
// aliases are matched across consecutive captions and merged into one caption
// (start of the first, end of the last). Single-caption matches are replaced
// inside the caption text.
export const applyGlossary = (
  captions: Caption[],
  glossary: GlossaryEntry[],
): Caption[] => {
  const rules = makeRules(glossary);
  if (rules.length === 0) {
    return captions;
  }
  const multiWord = rules.filter((r) => r.words.length > 1);

  const out: Caption[] = [];
  let i = 0;
  while (i < captions.length) {
    let merged: Caption | null = null;
    for (const rule of multiWord) {
      const n = rule.words.length;
      if (i + n > captions.length) {
        continue;
      }
      const slice = captions.slice(i, i + n);
      const matches = slice.every((c, k) => {
        const { core } = coreOf(c.text);
        return normalize(core) === rule.words[k];
      });
      if (!matches) {
        continue;
      }
      // Only allow punctuation at the edges of the phrase, not inside it.
      const innerPunctuation = slice.some((c, k) => {
        const { leading, trailing } = coreOf(c.text);
        return (k > 0 && leading.trim()) || (k < n - 1 && trailing.trim());
      });
      if (innerPunctuation) {
        continue;
      }
      const first = slice[0] as Caption;
      const last = slice[n - 1] as Caption;
      const confidences = slice
        .map((c) => c.confidence)
        .filter((c): c is number => c !== null);
      merged = {
        text: `${coreOf(first.text).leading}${rule.term}${coreOf(last.text).trailing}`,
        startMs: first.startMs,
        endMs: last.endMs,
        timestampMs: first.timestampMs,
        confidence:
          confidences.length === slice.length ? Math.min(...confidences) : null,
      };
      i += n;
      break;
    }
    if (merged) {
      out.push(merged);
      continue;
    }
    const caption = captions[i] as Caption;
    let text = caption.text.normalize("NFC");
    for (const rule of rules) {
      text = text.replace(rule.pattern, rule.term);
    }
    out.push(text === caption.text ? caption : { ...caption, text });
    i++;
  }
  return out;
};
