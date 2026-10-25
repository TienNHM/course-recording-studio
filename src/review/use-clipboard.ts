import { useCallback, useEffect, useRef, useState } from "react";

/** Copies text and remembers which item was copied for ~2 s (for "Copied ✓"). */
export const useClipboard = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(false);
      setCopied(id);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(true);
    }
  }, []);

  return { copied, error, copy };
};
