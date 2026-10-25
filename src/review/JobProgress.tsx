import React from "react";
import type { JobState } from "../../config/course";
import { Button } from "../components/ui/button";
import { isJobActive } from "./use-job";

const KIND_LABEL: Record<JobState["kind"], string> = {
  production: "Post-production",
  render: "Export",
};

// Progress of the lesson's current (or last failed) job.
export const JobProgress: React.FC<{
  readonly job: JobState | null;
  readonly onCancel: () => void;
  readonly busy?: boolean;
}> = ({ job, onCancel, busy }) => {
  if (!job) {
    return null;
  }

  if (isJobActive(job)) {
    const percent = Math.round(job.progress * 100);
    return (
      <div
        className="grid gap-2 rounded-md border p-3"
        data-testid="job-progress"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{KIND_LABEL[job.kind]}</span>
          <span className="text-xs text-muted-foreground">{job.status}</span>
          <span className="flex-1 truncate text-muted-foreground">
            {job.step}
          </span>
          <span className="tabular-nums">{percent}%</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            disabled={busy || job.step === "Cancelling"}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-secondary">
          <div
            className="h-full bg-sky-500 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (job.status === "FAILED") {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
        {KIND_LABEL[job.kind]} failed: {job.error ?? "Unknown error"}
      </div>
    );
  }

  if (job.status === "CANCELLED") {
    return (
      <div className="text-sm text-muted-foreground">
        {KIND_LABEL[job.kind]} was cancelled.
      </div>
    );
  }

  return null;
};
