/**
 * Namespace "library": strings for the course library view (src/library/**).
 *
 * OWNER: the library agent. Fill this file with every user-facing string of
 * the course library view (src/library/**) (replace the example keys freely). Vietnamese is the source of
 * truth: add keys here first, then the same keys in ../en/library.ts —
 * TypeScript reports missing/extra keys there.
 *
 * Usage: const t = useT("library"); t("title"); t("key", { name: "…" })
 * Nested objects become dotted keys; use plural() for counts.
 * See docs/design-system.md → "i18n".
 */
import type { Messages } from "../../types";

const library = {
  title: "Thư viện khoá học",
  example: {
    withVariable: "Tiếp tục quay: {lesson}",
  },
};

export default library;
export type LibraryMessages = Messages<typeof library>;
