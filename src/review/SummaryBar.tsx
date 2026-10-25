import { ArrowRight, Clock, Flag, Scissors, Subtitles, Zap } from "lucide-react";
import React from "react";
import type { LessonStatus } from "../../config/course";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import type { PipelineStatus } from "../actions/automation";
import type { ReviewSummary } from "./review-helpers";
import { useReviewFormat } from "./use-review-format";

const Stat: React.FC<{
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}> = ({ icon, label, children, className }) => (
  <div
    className={cn(
      "flex min-w-0 items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-card-foreground",
      className,
    )}
  >
    <span className="mt-0.5 text-muted-foreground" aria-hidden>
      {icon}
    </span>
    <div className="grid min-w-0 gap-0.5">
      <span className="text-overline uppercase text-muted-foreground">{label}</span>
      {children}
    </div>
  </div>
);

export const SummaryBar: React.FC<{
  readonly summary: ReviewSummary;
  /** Whole rendered video (intro/outro included), when the preview knows it. */
  readonly totalMs: number | null;
  readonly status: LessonStatus | null;
  readonly pipeline: PipelineStatus | null;
  readonly rendering: boolean;
}> = ({ summary, totalMs, status, pipeline, rendering }) => {
  const t = useT("review");
  const f = useReviewFormat();

  const next = rendering
    ? t("summary.next.rendering")
    : pipeline
      ? pipeline.next === null
        ? t("summary.next.none")
        : t(`summary.next.${pipeline.next}`)
      : null;

  return (
    <section
      aria-label={t("summary.label")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="review-summary"
    >
      <Stat icon={<Clock className="h-4 w-4" />} label={t("summary.final")}>
        <span className="timecode text-heading">
          {f.formatDuration(summary.finalMs)}
        </span>
        <span className="truncate text-caption text-muted-foreground">
          {t("summary.raw", { raw: f.formatDuration(summary.rawMs) })}
          {summary.removedMs > 0
            ? ` · ${t("summary.removed", {
                removed: f.formatShortDuration(summary.removedMs),
                percent: f.formatPercent(summary.removedRatio),
              })}`
            : null}
        </span>
        {totalMs !== null ? (
          <span className="truncate text-caption text-muted-foreground" title={t("summary.total", { total: f.formatDuration(totalMs) })}>
            {t("summary.total", { total: f.formatDuration(totalMs) })}
          </span>
        ) : null}
      </Stat>
      <Stat icon={<Scissors className="h-4 w-4" />} label={t("summary.cuts")}>
        <span className="text-label">
          {t("summary.acceptedCuts", { count: summary.acceptedCuts })}
        </span>
        <span
          className={cn(
            "text-caption",
            summary.pendingSuggestions > 0 ? "text-warning" : "text-muted-foreground",
          )}
        >
          {t("summary.pending", { count: summary.pendingSuggestions })}
        </span>
      </Stat>
      <Stat icon={<Flag className="h-4 w-4" />} label={t("summary.chapters")}>
        <span className="text-label">
          {t("summary.chapterCount", { count: summary.chapters })}
        </span>
      </Stat>
      <Stat icon={<Subtitles className="h-4 w-4" />} label={t("summary.transcript")}>
        <span className="text-label">
          {summary.words === null
            ? t("summary.noTranscript")
            : t("summary.words", { count: summary.words })}
        </span>
      </Stat>
      <Stat
        icon={<Zap className="h-4 w-4" />}
        label={t("summary.status")}
        className="col-span-2 sm:col-span-2 lg:col-span-1"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          {status ? <LessonStatusBadge status={status} /> : null}
        </span>
        {next ? (
          <span
            className="inline-flex items-center gap-1 truncate text-caption text-muted-foreground"
            title={pipeline?.message}
          >
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {next}
              {pipeline?.nextIsAutomatic && !rendering
                ? ` (${t("summary.next.automatic")})`
                : null}
            </span>
          </span>
        ) : null}
      </Stat>
    </section>
  );
};
