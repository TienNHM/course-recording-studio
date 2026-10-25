// Inbox layout (pure, unit-tested):
//   <inbox>/<Course title>/<Module title>/<Lesson title>.<mp4|webm|mov|mkv>
//   <inbox>/<Course title>/<Module title>/<Lesson title>.markers.json   (optional)
// Processed files move to <inbox>/_imported/, failures to <inbox>/_failed/.
import path from "path";
import { IMPORTABLE_EXTENSIONS } from "../import-recording";

export const IMPORTED_DIR = "_imported";
export const FAILED_DIR = "_failed";
export const MARKERS_SUFFIX = ".markers.json";

// Files that are still being written by a browser / copy tool.
const TEMP_EXTENSIONS = [
  ".part",
  ".partial",
  ".tmp",
  ".crdownload",
  ".download",
];

export type InboxEntry = {
  course: string;
  module: string;
  lesson: string;
  extension: string;
  // Sidecar markers file (may not exist).
  markersFile: string;
};

export type InboxParse =
  | { kind: "video"; entry: InboxEntry }
  // Not ours to touch (sidecars, temp files, processed folders, notes, …).
  | { kind: "ignore"; reason: string }
  // A video in the wrong place: moved to _failed/ with this message.
  | { kind: "invalid"; error: string };

const LAYOUT_HINT =
  "Put recordings at <inbox>/<Course title>/<Module title>/<Lesson title>.mp4 (or .webm/.mov/.mkv)";

export const parseInboxPath = (
  inboxDir: string,
  file: string,
  p: Pick<
    typeof path,
    "relative" | "isAbsolute" | "extname" | "join" | "dirname"
  > = path,
): InboxParse => {
  const rel = p.relative(inboxDir, file);
  if (!rel || rel.startsWith("..") || p.isAbsolute(rel)) {
    return { kind: "ignore", reason: "Outside the inbox folder" };
  }
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  const name = parts[parts.length - 1] ?? "";
  if (parts[0] === IMPORTED_DIR || parts[0] === FAILED_DIR) {
    return { kind: "ignore", reason: "Already processed" };
  }
  if (parts.some((part) => part.startsWith(".") || part.startsWith("~"))) {
    return { kind: "ignore", reason: "Hidden or temporary file" };
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(MARKERS_SUFFIX)) {
    return { kind: "ignore", reason: "Markers sidecar" };
  }
  const ext = p.extname(name).toLowerCase();
  if (TEMP_EXTENSIONS.includes(ext) || lower.includes(".importing.")) {
    return { kind: "ignore", reason: "File is still being written" };
  }
  if (!(IMPORTABLE_EXTENSIONS as readonly string[]).includes(ext.slice(1))) {
    return { kind: "ignore", reason: "Not a video file" };
  }
  if (parts.length !== 3) {
    return {
      kind: "invalid",
      error: `Wrong place in the inbox (${parts.length === 1 ? "no course/module folders" : `${parts.length - 1} folder levels instead of 2`}). ${LAYOUT_HINT}`,
    };
  }
  const [courseDir, moduleDir] = parts as [string, string, string];
  const base = name.slice(0, name.length - ext.length);
  const clean = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
  const entry: InboxEntry = {
    course: clean(courseDir),
    module: clean(moduleDir),
    lesson: clean(base),
    extension: ext.slice(1),
    markersFile: p.join(p.dirname(file), `${base}${MARKERS_SUFFIX}`),
  };
  const empty = (["course", "module", "lesson"] as const).find(
    (k) => entry[k] === "",
  );
  if (empty) {
    return {
      kind: "invalid",
      error: `The ${empty} title is empty. ${LAYOUT_HINT}`,
    };
  }
  return { kind: "video", entry };
};

// "_imported/2026-10-25T10-11-12-345Z-<name>" — sortable, no ":" for Windows.
export const processedName = (name: string, now: Date) =>
  `${now.toISOString().replace(/[:.]/g, "-")}-${name}`;
