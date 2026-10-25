// Keyboard shortcuts of the recorder. Pure data + resolution so the help
// popover, the key handlers and the tests share one source of truth.

export type RecorderPhase = "idle" | "countdown" | "recording" | "finished";

export type ShortcutAction =
  | "start"
  | "stop"
  | "cancelCountdown"
  | "togglePause"
  | "markImportant"
  | "markCut"
  | "markChapter";

export type ShortcutDefinition = {
  /** `KeyboardEvent.key`, lower case. */
  readonly key: string;
  /** Label shown in <Kbd>. */
  readonly label: string;
  /** i18n key under `recording.shortcuts.*`. */
  readonly description:
    | "record"
    | "pause"
    | "important"
    | "cut"
    | "chapter"
    | "cancel";
};

/** Listed in this order in the "?" help popover. */
export const RECORDER_SHORTCUTS: readonly ShortcutDefinition[] = [
  { key: "r", label: "R", description: "record" },
  { key: "p", label: "P", description: "pause" },
  { key: "m", label: "M", description: "important" },
  { key: "b", label: "B", description: "cut" },
  { key: "c", label: "C", description: "chapter" },
  { key: "escape", label: "Esc", description: "cancel" },
];

export const SHORTCUT_KEYS: readonly string[] = RECORDER_SHORTCUTS.map(
  (s) => s.key,
);

/** Key label for an action, e.g. for <Kbd> hints next to buttons. */
export const SHORTCUT_LABELS = {
  record: "R",
  pause: "P",
  important: "M",
  cut: "B",
  chapter: "C",
  cancel: "Esc",
} as const;

/**
 * What a key press does in the given phase, or null when it does nothing.
 * `key` is `KeyboardEvent.key` (any case).
 */
export const resolveShortcut = (
  key: string,
  phase: RecorderPhase,
): ShortcutAction | null => {
  const k = key.toLowerCase();
  if (phase === "countdown") {
    return k === "r" || k === "escape" ? "cancelCountdown" : null;
  }

  if (phase === "idle") {
    return k === "r" ? "start" : null;
  }

  if (phase === "recording") {
    switch (k) {
      case "r":
        return "stop";
      case "p":
        return "togglePause";
      case "m":
        return "markImportant";
      case "b":
        return "markCut";
      case "c":
        return "markChapter";
      default:
        return null;
    }
  }

  // "finished": the take is being saved; nothing to do from the keyboard.
  return null;
};
