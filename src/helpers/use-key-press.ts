import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// True when the user is typing somewhere and single-key shortcuts must not fire.
export const isTypingInField = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as Element).tagName !== "string") {
    return false;
  }

  const element = target as HTMLElement;
  // tagName is uppercase for HTML elements
  const tagName = element.tagName.toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    element.isContentEditable === true
  );
};

export const useKeyPress = ({
  keys,
  callback,
  metaKey,
  target,
  enabled = true,
  shortcut = false,
}: {
  keys: string[];
  callback: (event: KeyboardEvent) => void;
  metaKey: boolean;
  // Defaults to the main document. Pass a Picture-in-Picture document to
  // listen there instead.
  target?: Document | null;
  enabled?: boolean;
  // Single-key shortcut: ignored while typing in a field, while a dialog is
  // open, on key repeat and when Ctrl/Alt is held.
  shortcut?: boolean;
}) => {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const keysAsString = keys
    .map((k) => (shortcut ? k.toLowerCase() : k))
    .join("\u0000");

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (shortcut) {
        if (event.repeat || event.ctrlKey || event.altKey) {
          return;
        }

        if (isTypingInField(event.target)) {
          return;
        }

        const doc = (event.target as Node | null)?.ownerDocument ?? document;
        // Dialogs, open selects and menus own the keyboard
        if (
          doc.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')
        ) {
          return;
        }
      }

      const pressed = shortcut ? event.key.toLowerCase() : event.key;
      if (
        keysAsString
          .split("\u0000")
          .some((key) => pressed === key && event.metaKey === metaKey)
      ) {
        callbackRef.current(event);
      }
    },
    [keysAsString, metaKey, shortcut],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const doc = target === undefined ? document : target;
    if (!doc) {
      return;
    }

    doc.addEventListener("keydown", handleKeyPress);

    return () => doc.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress, target, enabled]);
};
