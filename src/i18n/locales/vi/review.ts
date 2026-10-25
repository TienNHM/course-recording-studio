/**
 * Namespace "review": strings for the review & publish view (src/review/**).
 *
 * OWNER: the review agent. Fill this file with every user-facing string of
 * the review & publish view (src/review/**) (replace the example keys freely). Vietnamese is the source of
 * truth: add keys here first, then the same keys in ../en/review.ts —
 * TypeScript reports missing/extra keys there.
 *
 * Usage: const t = useT("review"); t("title"); t("key", { name: "…" })
 * Nested objects become dotted keys; use plural() for counts.
 * See docs/design-system.md → "i18n".
 */
import type { Messages } from "../../types";

const review = {
  title: "Duyệt & xuất bản",
  example: {
    withVariable: "Đang xử lý {lesson}",
  },
};

export default review;
export type ReviewMessages = Messages<typeof review>;
