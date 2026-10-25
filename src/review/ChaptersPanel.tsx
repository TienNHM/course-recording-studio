import { Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { EditPlan } from "../../config/course";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "./Panel";
import { formatTimecode, parseTimecode } from "./timecode";

type Chapter = EditPlan["chapters"][number];
type Draft = { time: string; title: string };

const toDraft = (chapters: Chapter[]): Draft[] =>
  chapters.map((c) => ({ time: formatTimecode(c.timeMs), title: c.title }));

export const ChaptersPanel: React.FC<{
  readonly chapters: Chapter[];
  readonly disabled: boolean;
  // Original-take time at the preview playhead
  readonly getPlayheadMs: () => number | null;
  readonly onSeek: (originalMs: number) => void;
  readonly onSave: (chapters: Chapter[]) => Promise<void>;
}> = ({ chapters, disabled, getPlayheadMs, onSeek, onSave }) => {
  const [drafts, setDrafts] = useState<Draft[]>(() => toDraft(chapters));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(toDraft(chapters));
  }, [chapters]);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const addAtPlayhead = () => {
    const ms = getPlayheadMs();
    if (ms === null) {
      return;
    }

    setDrafts((d) => [
      ...d,
      { time: formatTimecode(ms), title: `Chapter ${d.length + 1}` },
    ]);
  };

  const save = async () => {
    const parsed: Chapter[] = [];
    for (const [i, d] of drafts.entries()) {
      const timeMs = parseTimecode(d.time);
      if (timeMs === null) {
        setError(`Chapter ${i + 1}: invalid time "${d.time}" (use m:ss)`);
        return;
      }

      if (!d.title.trim()) {
        setError(`Chapter ${i + 1}: the title is empty`);
        return;
      }

      parsed.push({ timeMs, title: d.title.trim() });
    }

    setError(null);
    await onSave(parsed.sort((a, b) => a.timeMs - b.timeMs));
  };

  const dirty = JSON.stringify(drafts) !== JSON.stringify(toDraft(chapters));

  return (
    <Panel
      title="Chapters"
      testId="chapters-panel"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={disabled}
            onClick={addAtPlayhead}
          >
            Add at playhead
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7"
            disabled={disabled || !dirty}
            onClick={save}
          >
            Save chapters
          </Button>
        </>
      }
    >
      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chapters.</p>
      ) : null}
      <ul className="grid gap-2">
        {drafts.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              className="h-8 w-20 tabular-nums"
              aria-label={`Chapter ${i + 1} time`}
              value={d.time}
              onChange={(e) => update(i, { time: e.target.value })}
              onFocus={() => {
                const ms = parseTimecode(d.time);
                if (ms !== null) {
                  onSeek(ms);
                }
              }}
            />
            <Input
              className="h-8"
              aria-label={`Chapter ${i + 1} title`}
              value={d.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              title="Delete chapter"
              onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Times are on the original recording. Chapters inside a cut move to the
        next kept part.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </Panel>
  );
};
