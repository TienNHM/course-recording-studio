import React, { useEffect, useState } from "react";
import type { JobState } from "../../config/course";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useFormat, useT } from "../i18n";
import { estimateRemainingMs } from "./review-helpers";
import { isJobActive } from "./use-job";

const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
};

/**
 * Progress of the lesson's current (or last failed / cancelled) job, with an
 * ETA and a cancel button. Used by the Review page and the Library.
 */
export const JobProgress: React.FC<{
  readonly job: JobState | null;
  readonly onCancel: () => void;
  readonly busy?: boolean;
  /** Shown on a failed job (e.g. "Export again"). */
  readonly onRetry?: () => void;
}> = ({ job, onCancel, busy, onRetry }) => {
  const t = useT("review");
  const f = useFormat();
  const active = isJobActive(job);
  const now = useNow(active);

  if (!job) {
    return null;
  }

  const render = job.kind === "render";

  if (active) {
    const queued = job.status === "QUEUED";
    const cancelling = job.step === "Cancelling";
    const eta = queued ? null : estimateRemainingMs(job, now);
    return (
      <div
        className="grid gap-2 rounded-lg border bg-card p-3"
        data-testid="job-progress"
        title={job.step}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label">
            {queued
              ? t("export.queued")
              : render
                ? t("export.rendering")
                : t("export.production")}
          </span>
          <Badge tone="info" size="sm" pulse>
            {t(`jobStatus.${job.status}`)}
          </Badge>
          <span className="flex-1" />
          {eta !== null ? (
            <span className="text-caption text-muted-foreground">
              {t("export.eta", { time: f.formatDuration(eta) })}
            </span>
          ) : null}
          <span className="timecode text-label">
            {f.formatPercent(job.progress)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy || cancelling}
            onClick={onCancel}
          >
            {cancelling ? t("export.cancelling") : t("export.cancel")}
          </Button>
        </div>
        <Progress
          value={queued ? null : job.progress}
          tone="primary"
          label={render ? t("export.rendering") : t("export.production")}
        />
      </div>
    );
  }

  if (job.status === "FAILED") {
    return (
      <Alert
        tone="destructive"
        title={render ? t("export.failed") : t("export.productionFailed")}
        action={
          onRetry ? (
            <Button type="button" size="xs" variant="outline" onClick={onRetry}>
              {t("export.retry")}
            </Button>
          ) : undefined
        }
      >
        {job.error ?? job.step}
      </Alert>
    );
  }

  if (job.status === "CANCELLED") {
    return (
      <p className="text-caption text-muted-foreground">
        {render ? t("export.cancelled") : t("export.productionCancelled")}
      </p>
    );
  }

  return null;
};
