// Decides when a file in the inbox is finished (OBS, a copy, a download may
// still be writing it): its size and modification time must stay unchanged
// for `stableMs`. The clock is injected so this is unit-testable.
export const DEFAULT_STABLE_MS = 5000;

export type FileSnapshot = { size: number; mtimeMs: number };

export type Observation = { stable: boolean; stableForMs: number };

export class StableFileTracker {
  private seen = new Map<string, FileSnapshot & { since: number }>();

  constructor(
    private readonly stableMs = DEFAULT_STABLE_MS,
    private readonly now: () => number = Date.now,
  ) {}

  observe(file: string, snapshot: FileSnapshot): Observation {
    const t = this.now();
    const prev = this.seen.get(file);
    if (
      !prev ||
      prev.size !== snapshot.size ||
      prev.mtimeMs !== snapshot.mtimeMs
    ) {
      this.seen.set(file, { ...snapshot, since: t });
      return { stable: false, stableForMs: 0 };
    }
    const stableForMs = t - prev.since;
    return {
      // An empty file is a file that has not been written yet.
      stable: snapshot.size > 0 && stableForMs >= this.stableMs,
      stableForMs,
    };
  }

  forget(file: string) {
    this.seen.delete(file);
  }

  // Drops files that disappeared (moved away, deleted by the user).
  retain(existing: Set<string>) {
    for (const file of this.seen.keys()) {
      if (!existing.has(file)) {
        this.seen.delete(file);
      }
    }
  }

  pending(): { file: string; size: number; stableForMs: number }[] {
    const t = this.now();
    return [...this.seen.entries()].map(([file, s]) => ({
      file,
      size: s.size,
      stableForMs: t - s.since,
    }));
  }
}
