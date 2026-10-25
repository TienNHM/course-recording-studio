import type { Marker } from "../../config/course";
import { elapsedMediaMs, PauseClock } from "./pause-clock";

// A small description of a take that is being recorded or has not been
// uploaded yet. The media itself is in OPFS (see store-file.ts); the manifest
// is what lets us recover it after a crash or a reload.
export type TakeManifest = {
  version: 1;
  // = String(startDate), the timestamp used in the OPFS file names
  id: string;
  lessonPath: string | null;
  startDate: number;
  clock: PauseClock;
  markers: Marker[];
  sources: { prefix: string; filename: string; mimeType: string }[];
  // Last time the recorder page was known to be alive
  lastAliveAt: number;
  // Set once the take was stopped normally
  takeId: string | null;
  endedAt: number | null;
  durationMs: number | null;
};

const KEY = "course-studio.unfinished-takes";

const isManifest = (value: unknown): value is TakeManifest => {
  const v = value as TakeManifest | null;
  return (
    typeof v === "object" &&
    v !== null &&
    v.version === 1 &&
    typeof v.id === "string" &&
    typeof v.startDate === "number" &&
    Array.isArray(v.sources) &&
    Array.isArray(v.markers) &&
    typeof v.clock === "object" &&
    v.clock !== null
  );
};

export const loadTakeManifests = (): TakeManifest[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isManifest) : [];
  } catch {
    return [];
  }
};

const writeAll = (manifests: TakeManifest[]) => {
  try {
    if (manifests.length === 0) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(manifests));
    }
  } catch (err) {
    console.warn("Could not persist the take manifest", err);
  }
};

export const saveTakeManifest = (manifest: TakeManifest) => {
  const others = loadTakeManifests().filter((m) => m.id !== manifest.id);
  writeAll([...others, manifest]);
};

export const removeTakeManifest = (id: string) => {
  writeAll(loadTakeManifests().filter((m) => m.id !== id));
};

// Best guess for the take id / timing of a take that was never stopped.
export const resolveRecoveredTiming = (manifest: TakeManifest) => {
  const endedAt = manifest.endedAt ?? manifest.lastAliveAt;
  const durationMs =
    manifest.durationMs ?? Math.round(elapsedMediaMs(manifest.clock, endedAt));
  const takeId = manifest.takeId ?? String(endedAt);
  return { endedAt, durationMs, takeId };
};
