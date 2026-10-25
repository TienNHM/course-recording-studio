import React from "react";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

/** Keys under `recording.take.step.*`. */
export type ProcessStep =
  | "converting"
  | "copying"
  | "finishing"
  | "downloading"
  | "transcribing"
  | "installingWhisper"
  | "downloadingModel";

/** Progress of a long client-side task (saving / converting a take). */
export type ProcessStatus = {
  readonly step: ProcessStep;
  /** File being processed, e.g. "webcam.webm". */
  readonly file: string | null;
  /** 0..1, or null when unknown (indeterminate bar). */
  readonly progress: number | null;
  readonly abort: null | (() => void);
};

export const ProcessingStatus: React.FC<{
  readonly status: ProcessStatus;
  readonly className?: string;
}> = ({ status, className }) => {
  const t = useT("recording");
  const label = t(`take.step.${status.step}`, { file: status.file ?? "" });
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-caption">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        {status.progress !== null ? (
          <span className="timecode shrink-0 text-foreground">
            {Math.round(status.progress * 100)}%
          </span>
        ) : null}
      </div>
      <Progress
        className="mt-1.5"
        value={status.progress}
        label={label}
        tone="primary"
      />
      {status.abort !== null ? (
        <Button
          variant="link"
          size="xs"
          className="mt-1 h-auto px-0 text-muted-foreground"
          onClick={() => status.abort?.()}
        >
          {t("take.abort")}
        </Button>
      ) : null}
    </div>
  );
};
