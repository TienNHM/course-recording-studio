/**
 * Namespace "recording": strings for the recorder view (src/App.tsx Recorder, src/TopBar.tsx, src/recording/**, device pickers).
 *
 * OWNER: the recording agent. Fill this file with every user-facing string of
 * the recorder view (src/App.tsx Recorder, src/TopBar.tsx, src/recording/**, device pickers) (replace the example keys freely). Vietnamese is the source of
 * truth: add keys here first, then the same keys in ../en/recording.ts —
 * TypeScript reports missing/extra keys there.
 *
 * Usage: const t = useT("recording"); t("title"); t("key", { name: "…" })
 * Nested objects become dotted keys; use plural() for counts.
 * See docs/design-system.md → "i18n".
 */
import type { Messages } from "../../types";

const recording = {
  title: "Quay bài giảng",
  example: {
    withVariable: "Đang quay {lesson}",
  },
};

export default recording;
export type RecordingMessages = Messages<typeof recording>;
