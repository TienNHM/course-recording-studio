import { RotateCcw, Scissors, Undo2 } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { Badge, type BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/misc";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { Panel } from "./Panel";
import {
  resetCutChanges,
  setSilenceChanges,
  type Cut,
  type CutChange,
} from "./review-helpers";
import { SUGGESTED_PATTERN } from "./ReviewTimeline";
import { useReviewFormat } from "./use-review-format";

const REASON_TONE: Record<Cut["reason"], BadgeTone> = {
  silence: "warning",
  marker: "primary",
  trim: "neutral",
};

export const CutsPanel: React.FC<{
  readonly cuts: Cut[];
  readonly focusedCut: number | null;
  readonly disabled: boolean;
  /** Lesson's postProduction.autoRemoveSilence; null hides "reset". */
  readonly autoRemoveSilence: boolean | null;
  readonly onChange: (changes: CutChange[]) => void;
  readonly onFocusCut: (index: number) => void;
}> = ({
  cuts,
  focusedCut,
  disabled,
  autoRemoveSilence,
  onChange,
  onFocusCut,
}) => {
  const t = useT("review");
  const f = useReviewFormat();
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusedCut === null) {
      return;
    }
    list.current
      ?.querySelector(`[data-cut-row="${focusedCut}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focusedCut]);

  const acceptSilence = setSilenceChanges(cuts, true);
  const rejectSilence = setSilenceChanges(cuts, false);
  const reset =
    autoRemoveSilence === null ? [] : resetCutChanges(cuts, autoRemoveSilence);

  const removedMs = cuts
    .filter((c) => c.accepted)
    .reduce((acc, c) => acc + (c.endMs - c.startMs), 0);

  return (
    <Panel
      title={t("cuts.title")}
      testId="cuts-panel"
      actions={
        <>
          {acceptSilence.length > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={disabled}
              onClick={() => onChange(acceptSilence)}
            >
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              {t("cuts.acceptAllSilence")}
            </Button>
          ) : null}
          {rejectSilence.length > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(rejectSilence)}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              {t("cuts.rejectAllSilence")}
            </Button>
          ) : null}
          {reset.length > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={disabled}
              title={t("cuts.resetHint")}
              onClick={() => onChange(reset)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t("cuts.reset")}
            </Button>
          ) : null}
        </>
      }
    >
      {cuts.length === 0 ? (
        <p className="text-body text-muted-foreground">{t("cuts.empty")}</p>
      ) : (
        <ul ref={list} className="grid gap-1">
          {cuts.map((cut, index) => {
            const focused = focusedCut === index;
            return (
              <li
                key={`${index}-${cut.startMs}-${cut.endMs}`}
                data-cut-row={index}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:bg-accent/60",
                  focused && "border-primary/50 bg-accent",
                )}
              >
                <Checkbox
                  aria-label={t("cuts.accept", { index: index + 1 })}
                  checked={cut.accepted}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange([{ index, accepted: e.target.checked }])
                  }
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={t("cuts.seek")}
                  onClick={() => onFocusCut(index)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-4 w-1.5 shrink-0 rounded-sm",
                      cut.accepted ? "bg-muted-foreground/50" : "",
                    )}
                    style={cut.accepted ? undefined : SUGGESTED_PATTERN}
                  />
                  <Badge tone={REASON_TONE[cut.reason]} size="sm">
                    {t(`reason.${cut.reason}`)}
                  </Badge>
                  <span
                    className={cn(
                      "timecode text-label",
                      cut.accepted && "text-muted-foreground line-through",
                    )}
                  >
                    {f.formatDuration(cut.startMs)}–{f.formatDuration(cut.endMs)}
                  </span>
                  <span className="timecode ml-auto text-caption text-muted-foreground">
                    {f.formatShortDuration(cut.endMs - cut.startMs)}
                  </span>
                  <span
                    className={cn(
                      "w-10 text-right text-caption font-medium",
                      cut.accepted ? "text-muted-foreground" : "text-warning",
                    )}
                  >
                    {cut.accepted ? t("cuts.stateCut") : t("cuts.stateKeep")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        {t("cuts.removedTotal", { duration: f.formatShortDuration(removedMs) })}
        {focusedCut !== null ? ` · ${t("cuts.focusedHint")}` : null}
      </p>
    </Panel>
  );
};
