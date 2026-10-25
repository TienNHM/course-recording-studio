import { DISK_SPACE } from "../../scripts/server/constants";

export const LOW_DISK_SPACE_BYTES = 5 * 1024 * 1024 * 1024;

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

export const formatGigabytes = (bytes: number) =>
  `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
