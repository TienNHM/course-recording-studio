// Validation for transcript edits made in the Review UI.
import type { Caption } from "@remotion/captions";
import { z } from "zod";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

export const captionList = z.array(captionSchema);

// The Review UI only edits text. Returns a description of the problem if
// `next` changes the number of captions or any timing, otherwise null.
export const checkCaptionEdit = (
  previous: Caption[] | null,
  next: Caption[],
): string | null => {
  if (!previous) {
    return "The selected take has no captions to edit";
  }
  if (previous.length !== next.length) {
    return `Expected ${previous.length} captions, got ${next.length}`;
  }
  for (let i = 0; i < next.length; i++) {
    const a = previous[i] as Caption;
    const b = next[i] as Caption;
    if (
      a.startMs !== b.startMs ||
      a.endMs !== b.endMs ||
      a.timestampMs !== b.timestampMs
    ) {
      return `Caption ${i} has different timing; only text can be edited`;
    }
  }
  return null;
};
