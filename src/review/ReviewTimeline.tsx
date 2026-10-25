import { Flag } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import type { TimelineSegment } from "../../remotion/lesson/timeline";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import {
  buildTimelineGeometry,
  fractionToMs,
  msToPct,
  type Chapter,
  type Cut,
} from "./review-helpers";
import { useReviewFormat } from "./use-review-format";

// Hatched fill for cut suggestions (token colors only).
export const SUGGESTED_PATTERN: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, hsl(var(--warning) / 0.55) 0 4px, hsl(var(--warning) / 0.12) 4px 8px)",
};

export const LegendSwatch: React.FC<{
  readonly kind: "kept" | "cut" | "suggested" | "chapter" | "playhead";
}> = ({ kind }) => (
  <span
    aria-hidden
    className={cn(
      "relative inline-block h-3 w-4 shrink-0 rounded-sm",
      kind === "kept" && "bg-primary/35",
      kind === "cut" && "bg-muted",
      kind === "suggested" && "border border-warning/70",
      kind === "chapter" && "w-1 bg-info",
      kind === "playhead" && "w-0.5 bg-foreground",
    )}
    style={kind === "suggested" ? SUGGESTED_PATTERN : undefined}
  >
    {kind === "cut" ? (
      <span className="absolute inset-x-0 top-1/2 h-px bg-muted-foreground" />
    ) : null}
  </span>
);

/**
 * The original take as a bar: kept parts, accepted cuts (struck through),
 * cut suggestions (hatched, click to toggle), chapter flags and the playhead.
 * Clicking the bar seeks the preview.
 */
export const ReviewTimeline: React.FC<{
  readonly durationMs: number;
  readonly segments: TimelineSegment[];
  readonly cuts: Cut[];
  readonly chapters: Chapter[];
  /** Playhead on the original take, null while unknown. */
  readonly playheadMs: number | null;
  readonly focusedCut: number | null;
  readonly disabled: boolean;
  readonly onSeek: (originalMs: number) => void;
  readonly onToggleCut: (index: number) => void;
}> = ({
  durationMs,
  segments,
  cuts,
  chapters,
  playheadMs,
  focusedCut,
  disabled,
  onSeek,
  onToggleCut,
}) => {
  const t = useT("review");
  const f = useReviewFormat();
  const bar = useRef<HTMLDivElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const geometry = useMemo(
    () => buildTimelineGeometry({ durationMs, segments, cuts, chapters }),
    [chapters, cuts, durationMs, segments],
  );

  const msAt = (clientX: number) => {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return null;
    }
    return fractionToMs((clientX - rect.left) / rect.width, durationMs);
  };

  return (
    <section
      aria-label={t("timeline.label")}
      className="grid gap-1.5"
      data-testid="review-timeline"
    >
      {/* Chapter flags */}
      <div className="relative h-5">
        {geometry.chapters.map(({ chapter, index, leftPct }) => (
          <button
            key={`${index}-${chapter.timeMs}`}
            type="button"
            className="group absolute top-0 flex h-5 -translate-x-1/2 items-center rounded-sm px-0.5 text-info hover:bg-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: `clamp(9px, ${leftPct}%, calc(100% - 9px))` }}
            title={t("timeline.chapter", {
              title: chapter.title,
              time: f.formatDuration(chapter.timeMs),
            })}
            aria-label={t("timeline.chapter", {
              title: chapter.title,
              time: f.formatDuration(chapter.timeMs),
            })}
            onClick={() => onSeek(chapter.timeMs)}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
          </button>
        ))}
      </div>

      {/* Bar */}
      <div
        ref={bar}
        className="relative h-11 cursor-pointer overflow-hidden rounded-md border bg-muted"
        role="presentation"
        onClick={(e) => {
          const ms = msAt(e.clientX);
          if (ms !== null) {
            onSeek(ms);
          }
        }}
        onMouseMove={(e) => setHoverMs(msAt(e.clientX))}
        onMouseLeave={() => setHoverMs(null)}
      >
        {geometry.segments.map((s) => (
          <div
            key={`${s.startMs}-${s.endMs}`}
            aria-hidden
            className="absolute inset-y-0 border-x border-primary/40 bg-primary/30"
            style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%` }}
          />
        ))}
        {geometry.chapters.map(({ chapter, index, leftPct }) => (
          <div
            key={`line-${index}-${chapter.timeMs}`}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-info"
            style={{ left: `${leftPct}%` }}
          />
        ))}
        {geometry.cuts.map(({ cut, index, kind, leftPct, widthPct }) => {
          const label = t(
            kind === "accepted" ? "timeline.cutAccepted" : "timeline.cutSuggested",
            {
              reason: t(`reason.${cut.reason}`),
              start: f.formatDuration(cut.startMs),
              end: f.formatDuration(cut.endMs),
            },
          );
          return (
            <button
              key={`${index}-${cut.startMs}-${cut.endMs}`}
              type="button"
              disabled={disabled}
              aria-pressed={cut.accepted}
              aria-label={label}
              title={label}
              data-cut-index={index}
              className={cn(
                "absolute inset-y-0 min-w-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed",
                kind === "accepted"
                  ? "bg-muted hover:bg-accent"
                  : "border-x border-warning/70 hover:brightness-110",
                focusedCut === index &&
                  "z-10 ring-2 ring-inset ring-primary",
              )}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                ...(kind === "suggested" ? SUGGESTED_PATTERN : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCut(index);
              }}
            >
              {kind === "accepted" ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1/2 h-px bg-muted-foreground"
                />
              ) : null}
            </button>
          );
        })}
        {hoverMs !== null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/30"
            style={{ left: `${msToPct(hoverMs, durationMs)}%` }}
          />
        ) : null}
        {playheadMs !== null ? (
          <div
            aria-hidden
            data-testid="timeline-playhead"
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_hsl(var(--background))]"
            style={{ left: `${msToPct(playheadMs, durationMs)}%` }}
          />
        ) : null}
      </div>

      {/* Ruler */}
      <div className="relative h-4 text-2xs text-muted-foreground">
        {geometry.ticks.map((tick, i) => (
          <span
            key={tick.ms}
            className={cn(
              "timecode absolute top-0",
              i === 0
                ? "left-0"
                : i === geometry.ticks.length - 1
                  ? "right-0"
                  : "-translate-x-1/2",
            )}
            style={
              i === 0 || i === geometry.ticks.length - 1
                ? undefined
                : { left: `${tick.leftPct}%` }
            }
          >
            {f.formatDuration(tick.ms)}
          </span>
        ))}
        {hoverMs !== null ? (
          <span
            className="timecode absolute top-0 z-10 -translate-x-1/2 rounded bg-popover px-1 text-popover-foreground shadow-sm"
            style={{
              left: `${Math.min(96, Math.max(4, msToPct(hoverMs, durationMs)))}%`,
            }}
          >
            {f.formatDuration(hoverMs)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {(["kept", "cut", "suggested", "chapter", "playhead"] as const).map(
          (kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <LegendSwatch kind={kind} />
              {t(`timeline.legend.${kind}`)}
            </span>
          ),
        )}
        <span className="basis-full text-caption sm:basis-auto sm:ml-auto">
          {t("timeline.hint")}
        </span>
      </div>
    </section>
  );
};
