import React from "react";
import type { EditPlan } from "../../config/course";
import { Button } from "../components/ui/button";
import { cn } from "../helpers/utils";
import { Panel } from "./Panel";
import { formatDuration, formatTimecode } from "./timecode";

type Cut = EditPlan["cuts"][number];

const REASON_LABEL: Record<Cut["reason"], string> = {
  silence: "Silence",
  marker: "Cut marker",
  trim: "Trim",
};

export const CutsPanel: React.FC<{
  readonly cuts: Cut[];
  readonly disabled: boolean;
  readonly onToggle: (changes: { index: number; accepted: boolean }[]) => void;
  readonly onSeek: (originalMs: number) => void;
}> = ({ cuts, disabled, onToggle, onSeek }) => {
  const silence = cuts
    .map((cut, index) => ({ cut, index }))
    .filter(({ cut }) => cut.reason === "silence");

  const setAllSilence = (accepted: boolean) =>
    onToggle(
      silence
        .filter(({ cut }) => cut.accepted !== accepted)
        .map(({ index }) => ({ index, accepted })),
    );

  const removedMs = cuts
    .filter((c) => c.accepted)
    .reduce((acc, c) => acc + (c.endMs - c.startMs), 0);

  return (
    <Panel
      title={`Cuts (${cuts.length})`}
      testId="cuts-panel"
      actions={
        silence.length > 0 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={disabled}
              onClick={() => setAllSilence(true)}
            >
              Accept all silence
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={disabled}
              onClick={() => setAllSilence(false)}
            >
              Reject all
            </Button>
          </>
        ) : null
      }
    >
      {cuts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cuts suggested.</p>
      ) : (
        <ul className="grid gap-1">
          {cuts.map((cut, index) => (
            <li
              key={`${cut.startMs}-${cut.endMs}`}
              className={cn(
                "flex items-center gap-3 rounded px-2 py-1 text-sm hover:bg-accent",
                !cut.accepted && "text-muted-foreground",
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-sky-500"
                aria-label={`Accept cut ${index + 1}`}
                checked={cut.accepted}
                disabled={disabled}
                onChange={(e) =>
                  onToggle([{ index, accepted: e.target.checked }])
                }
              />
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left"
                title="Show in preview"
                onClick={() => onSeek(cut.startMs)}
              >
                <span className="w-20">{REASON_LABEL[cut.reason]}</span>
                <span className="tabular-nums">
                  {formatTimecode(cut.startMs)} - {formatTimecode(cut.endMs)}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {formatDuration(cut.endMs - cut.startMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Checked cuts are removed ({formatDuration(removedMs)} in total).
      </p>
    </Panel>
  );
};
