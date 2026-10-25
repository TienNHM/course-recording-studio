// "Drop to publish": watches the inbox folder and imports finished recordings
//   <inbox>/<Course>/<Module>/<Lesson>.mp4  → ensure course/module/lesson by
//   title → import as a new take (import-recording code path) → the automatic
//   pipeline (autoProcess / autoPublish) takes over.
// Sources are never deleted: after a successful import they move to
// <inbox>/_imported/<timestamp>-<name>, failures to <inbox>/_failed/ with a
// <name>.error.txt next to them.
// fs.watch (recursive on Windows/macOS) triggers scans; a periodic scan is the
// fallback and also drives the "size stable for 5 s" check.
import fs from "fs";
import path from "path";
import type { Marker } from "../../../config/course";
import { marker } from "../../../config/course";
import { importRecording } from "../import-recording";
import { getActiveJob } from "../production/job-queue";
import { logActivity } from "./activity-log";
import { ensureLessonByTitles } from "./ensure-lesson";
import type { InboxEntry } from "./inbox-path";
import {
  FAILED_DIR,
  IMPORTED_DIR,
  parseInboxPath,
  processedName,
} from "./inbox-path";
import { getSettings } from "./settings";
import { DEFAULT_STABLE_MS, StableFileTracker } from "./stable-file";

const SCAN_INTERVAL_MS = 2000;
const WATCH_DEBOUNCE_MS = 300;
// Max folder depth walked below the inbox (layout needs 3; deeper files are
// reported as misplaced).
const MAX_DEPTH = 5;
const LOCKED_CODES = ["EBUSY", "EPERM", "EACCES"];

const listFiles = (dir: string, depth = 0): string[] => {
  if (depth > MAX_DEPTH) {
    return [];
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name.startsWith(".")) {
      return [];
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth === 0 && (e.name === IMPORTED_DIR || e.name === FAILED_DIR)) {
        return [];
      }
      return listFiles(full, depth + 1);
    }
    return e.isFile() ? [full] : [];
  });
};

// Moves without overwriting; returns the new path.
const moveInto = (file: string, dir: string, now: Date): string => {
  fs.mkdirSync(dir, { recursive: true });
  const name = processedName(path.basename(file), now);
  let target = path.join(dir, name);
  for (let i = 2; fs.existsSync(target); i++) {
    target = path.join(dir, `${i}-${name}`);
  }
  try {
    fs.renameSync(file, target);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") {
      throw e;
    }
    fs.copyFileSync(file, target);
    fs.rmSync(file);
  }
  return target;
};

const readSidecarMarkers = (file: string): Marker[] | undefined => {
  if (!fs.existsSync(file)) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(
      `${path.basename(file)} is not valid JSON: ${(e as Error).message}`,
    );
  }
  const parsed = marker.array().safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `${path.basename(file)} must be an array of {type: "cut"|"important"|"chapter", timeMs, title?}`,
    );
  }
  return parsed.data;
};

export type InboxStatus = {
  watching: boolean;
  inboxDir: string | null;
  pending: { file: string; sizeBytes: number; stableForMs: number }[];
  processing: string | null;
};

export class InboxWatcher {
  private tracker: StableFileTracker;
  private watcher: fs.FSWatcher | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private scanning = false;
  private processing: string | null = null;
  // Imported but could not be moved yet (locked): never import twice.
  private importedNotMoved = new Map<string, string>();
  // Files waiting for a lesson job to finish (logged once).
  private deferred = new Set<string>();

  constructor(
    readonly inboxDir: string,
    private readonly options: {
      stableMs?: number;
      scanIntervalMs?: number;
      now?: () => number;
    } = {},
  ) {
    this.tracker = new StableFileTracker(
      options.stableMs ?? DEFAULT_STABLE_MS,
      options.now ?? Date.now,
    );
  }

  start() {
    fs.mkdirSync(this.inboxDir, { recursive: true });
    try {
      this.watcher = fs.watch(this.inboxDir, { recursive: true }, () =>
        this.scheduleScan(),
      );
      this.watcher.on("error", (e) => {
        logActivity({
          type: "watcher",
          level: "warn",
          message: `File watching stopped (${e.message}); falling back to periodic scans`,
        });
        this.watcher?.close();
        this.watcher = null;
      });
    } catch (e) {
      logActivity({
        type: "watcher",
        level: "warn",
        message: `Could not watch ${this.inboxDir} (${(e as Error).message}); using periodic scans`,
      });
    }
    this.interval = setInterval(
      () => void this.scan(),
      this.options.scanIntervalMs ?? SCAN_INTERVAL_MS,
    );
    this.interval.unref?.();
    void this.scan();
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    if (this.interval) clearInterval(this.interval);
    if (this.debounce) clearTimeout(this.debounce);
    this.interval = null;
    this.debounce = null;
  }

  status(): InboxStatus {
    return {
      watching: this.interval !== null,
      inboxDir: this.inboxDir,
      pending: this.tracker
        .pending()
        .map((p) => ({
          file: p.file,
          sizeBytes: p.size,
          stableForMs: p.stableForMs,
        })),
      processing: this.processing,
    };
  }

  private scheduleScan() {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.scan(), WATCH_DEBOUNCE_MS);
  }

  async scan() {
    if (this.scanning) {
      return;
    }
    this.scanning = true;
    try {
      const files = listFiles(this.inboxDir);
      const existing = new Set(files);
      this.tracker.retain(existing);
      for (const key of [...this.importedNotMoved.keys()]) {
        if (!existing.has(key)) this.importedNotMoved.delete(key);
      }
      for (const file of files) {
        if (this.importedNotMoved.has(file)) {
          this.retryMove(file);
          continue;
        }
        const parsed = parseInboxPath(this.inboxDir, file);
        if (parsed.kind === "ignore") {
          continue;
        }
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        const seenBefore = this.tracker.pending().some((p) => p.file === file);
        const { stable } = this.tracker.observe(file, {
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
        if (!seenBefore) {
          logActivity({
            type: "detected",
            file,
            message: `New file ${path.relative(this.inboxDir, file)}; waiting until it is completely written`,
          });
        }
        if (!stable) {
          continue;
        }
        if (parsed.kind === "invalid") {
          this.fail(file, parsed.error);
          continue;
        }
        await this.importOne(file, parsed.entry);
      }
    } catch (e) {
      console.error("Inbox scan failed", e);
    } finally {
      this.scanning = false;
    }
  }

  private retryMove(file: string) {
    try {
      moveInto(file, path.join(this.inboxDir, IMPORTED_DIR), new Date());
      this.importedNotMoved.delete(file);
      this.tracker.forget(file);
    } catch {
      // Still locked; try again on the next scan.
    }
  }

  private fail(file: string, error: string) {
    this.tracker.forget(file);
    const failedDir = path.join(this.inboxDir, FAILED_DIR);
    try {
      const moved = moveInto(file, failedDir, new Date());
      fs.writeFileSync(
        `${moved}.error.txt`,
        `${error}\r\n\r\nOriginal path: ${file}\r\nFailed at: ${new Date().toISOString()}\r\n`,
      );
      logActivity({
        type: "failed",
        level: "error",
        file: moved,
        message: `${path.relative(this.inboxDir, file)}: ${error} (moved to ${FAILED_DIR}/)`,
      });
    } catch (e) {
      logActivity({
        type: "failed",
        level: "error",
        file,
        message: `${error}; could not move it to ${FAILED_DIR}/ either: ${(e as Error).message}`,
      });
    }
  }

  private async importOne(file: string, entry: InboxEntry) {
    const rel = path.relative(this.inboxDir, file);
    this.processing = file;
    try {
      const markers = readSidecarMarkers(entry.markersFile);
      const ref = ensureLessonByTitles({
        course: entry.course,
        module: entry.module,
        lesson: entry.lesson,
      });
      if (getActiveJob(ref.lessonPath)) {
        if (!this.deferred.has(file)) {
          this.deferred.add(file);
          logActivity({
            type: "deferred",
            file,
            lessonPath: ref.lessonPath,
            message: `${rel}: the lesson has a job queued or running; importing when it finishes`,
          });
        }
        return;
      }
      this.deferred.delete(file);
      const result = await importRecording(
        { lessonPath: ref.lessonPath, displayPath: file, markers },
        { trigger: "inbox" },
      );
      const now = new Date();
      const importedDir = path.join(this.inboxDir, IMPORTED_DIR);
      try {
        moveInto(file, importedDir, now);
        this.tracker.forget(file);
      } catch {
        this.importedNotMoved.set(file, ref.lessonPath);
      }
      if (markers) {
        try {
          moveInto(entry.markersFile, importedDir, now);
        } catch {
          // The video is what matters; a leftover sidecar is harmless.
        }
      }
      const created = ref.created.length
        ? ` (created ${ref.created.join(", ")})`
        : "";
      logActivity({
        type: "imported",
        file,
        lessonPath: ref.lessonPath,
        jobId: result.pipeline.productionJob?.id,
        message: `${rel} → ${ref.lessonPath}${created}, take ${result.take.takeId}. ${
          result.pipeline.productionJob
            ? "Post-production queued."
            : `Not processed automatically: ${result.pipeline.reason}.`
        }`,
      });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "";
      if (LOCKED_CODES.includes(code)) {
        // Still open in another program: wait for it to be stable again.
        this.tracker.forget(file);
        return;
      }
      this.fail(file, (e as Error).message);
    } finally {
      this.processing = null;
    }
  }
}

// ---- Server singleton --------------------------------------------------------

let current: InboxWatcher | null = null;

// (Re)starts or stops the watcher according to the saved settings.
export const applyInboxSettings = () => {
  const settings = getSettings();
  if (
    current &&
    (!settings.enabled || current.inboxDir !== settings.inboxDir)
  ) {
    current.stop();
    logActivity({
      type: "watcher",
      message: `Stopped watching ${current.inboxDir}`,
    });
    current = null;
  }
  if (settings.enabled && !current) {
    try {
      current = new InboxWatcher(settings.inboxDir);
      current.start();
      logActivity({
        type: "watcher",
        message: `Watching ${settings.inboxDir} for <Course>/<Module>/<Lesson>.mp4`,
      });
    } catch (e) {
      current = null;
      logActivity({
        type: "watcher",
        level: "error",
        message: `Could not watch ${settings.inboxDir}: ${(e as Error).message}`,
      });
    }
  }
  return settings;
};

export const getInboxStatus = (): InboxStatus =>
  current?.status() ?? {
    watching: false,
    inboxDir: null,
    pending: [],
    processing: null,
  };
