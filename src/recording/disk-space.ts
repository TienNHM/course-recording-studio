import { useEffect, useState } from "react";
import { DISK_SPACE } from "../../scripts/server/constants";

export { LOW_DISK_SPACE_BYTES } from "./preflight";

// Returns null if the server is unavailable or does not report it.
export const fetchFreeDiskBytes = async (): Promise<number | null> => {
  if (!window.remotionServerEnabled) {
    return null;
  }

  try {
    const res = await fetch(new URL(DISK_SPACE, window.location.origin));
    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as { freeBytes?: unknown };
    return typeof json.freeBytes === "number" ? json.freeBytes : null;
  } catch {
    return null;
  }
};

/**
 * Free disk space of the server's public/ folder, refreshed every minute.
 * `checked` is false until the first answer (or failure).
 */
export const useFreeDiskSpace = (refreshMs = 60_000) => {
  const [state, setState] = useState<{
    freeBytes: number | null;
    checked: boolean;
  }>({ freeBytes: null, checked: false });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchFreeDiskBytes().then((freeBytes) => {
        if (!cancelled) {
          setState({ freeBytes, checked: true });
        }
      });
    load();
    const interval = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshMs]);

  return state;
};
