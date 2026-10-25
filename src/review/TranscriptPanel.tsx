import type { Caption } from "@remotion/captions";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "./Panel";
import { formatTimecode } from "./timecode";
import { applyLineText, groupIntoLines } from "./transcript-lines";

// Text-only transcript editor; timings stay as transcribed.
export const TranscriptPanel: React.FC<{
  readonly captions: Caption[] | null;
  readonly disabled: boolean;
  readonly onSeek: (originalMs: number) => void;
  readonly onSave: (captions: Caption[]) => Promise<void>;
}> = ({ captions, disabled, onSeek, onSave }) => {
  // Edited line text, keyed by the index of the line's first word.
  const [edits, setEdits] = useState<Record<number, string>>({});
  useEffect(() => {
    setEdits({});
  }, [captions]);

  const lines = useMemo(() => groupIntoLines(captions ?? []), [captions]);
  const dirty = Object.keys(edits).length > 0;

  if (!captions) {
    return (
      <Panel title="Transcript" testId="transcript-panel">
        <p className="text-sm text-muted-foreground">
          No transcript for this take. Enable transcription and re-process.
        </p>
      </Panel>
    );
  }

  const save = () => {
    let next = captions;
    for (const line of lines) {
      const text = edits[line.start];
      if (text !== undefined && text.trim() !== line.text) {
        next = applyLineText(next, line, text);
      }
    }

    return onSave(next);
  };

  return (
    <Panel
      title={`Transcript (${lines.length} lines)`}
      testId="transcript-panel"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={!dirty}
            onClick={() => setEdits({})}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7"
            disabled={disabled || !dirty}
            onClick={save}
          >
            Save transcript
          </Button>
        </>
      }
    >
      <ul className="grid max-h-96 gap-1 overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <li key={line.start} className="flex items-center gap-2">
            <button
              type="button"
              className="w-14 shrink-0 text-left text-xs tabular-nums text-sky-400 hover:underline"
              title="Show in preview"
              onClick={() => onSeek(line.startMs)}
            >
              {formatTimecode(line.startMs)}
            </button>
            <Input
              className="h-8"
              aria-label={`Transcript line ${i + 1}`}
              value={edits[line.start] ?? line.text}
              onChange={(e) =>
                setEdits((all) => ({ ...all, [line.start]: e.target.value }))
              }
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
};
