import { AlertTriangle, Check, Copy, Flag, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineSegment } from "../../remotion/lesson/timeline";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tooltip } from "../components/ui/tooltip";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { Panel } from "./Panel";
import {
  formatYouTubeChapters,
  sortChapterDrafts,
  validateChapters,
  type Chapter,
  type ChapterDraft,
} from "./review-helpers";
import { parseTimecode } from "./timecode";
import { useClipboard } from "./use-clipboard";
import { useReviewFormat } from "./use-review-format";

let nextKey = 0;
const newKey = () => `chapter-${nextKey++}`;

export const ChaptersPanel: React.FC<{
  readonly chapters: Chapter[];
  readonly segments: TimelineSegment[];
  readonly durationMs: number;
  /** Chapters of the rendered video (preview), for "copy for YouTube". */
  readonly outputChapters: Chapter[] | null;
  /** Title for 00:00 when the first chapter starts later (the intro). */
  readonly firstTitle: string;
  readonly disabled: boolean;
  /** Changing it discards the drafts. */
  readonly resetToken: number;
  /** Original-take time at the preview playhead. */
  readonly getPlayheadMs: () => number | null;
  readonly onSeek: (originalMs: number) => void;
  readonly onSave: (chapters: Chapter[]) => Promise<boolean>;
  readonly onDirtyChange: (dirty: boolean) => void;
}> = ({
  chapters,
  segments,
  durationMs,
  outputChapters,
  firstTitle,
  disabled,
  resetToken,
  getPlayheadMs,
  onSeek,
  onSave,
  onDirtyChange,
}) => {
  const t = useT("review");
  const f = useReviewFormat();
  const clipboard = useClipboard();
  const [saving, setSaving] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const toDrafts = (list: Chapter[]): ChapterDraft[] =>
    sortChapterDrafts(
      list.map((c) => ({
        key: newKey(),
        timeMs: c.timeMs,
        timeText: f.formatDuration(c.timeMs),
        title: c.title,
      })),
    );

  const [drafts, setDrafts] = useState<ChapterDraft[]>(() =>
    toDrafts(chapters),
  );

  // Server state or "discard" → fresh drafts.
  useEffect(() => {
    setDrafts(toDrafts(chapters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, resetToken]);

  const dirty = useMemo(() => {
    if (drafts.length !== chapters.length) {
      return true;
    }
    const saved = [...chapters].sort((a, b) => a.timeMs - b.timeMs);
    return drafts.some(
      (d, i) => d.timeMs !== saved[i]?.timeMs || d.title !== saved[i]?.title,
    );
  }, [chapters, drafts]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!focusKey) {
      return;
    }
    const input = list.current?.querySelector<HTMLInputElement>(
      `[data-chapter-title="${focusKey}"]`,
    );
    input?.focus();
    input?.select();
    setFocusKey(null);
  }, [focusKey]);

  const checks = useMemo(
    () => validateChapters(drafts, { durationMs, segments }),
    [drafts, durationMs, segments],
  );
  const hasErrors = checks.some((c) => c.errors.length > 0);

  const update = (key: string, patch: Partial<ChapterDraft>) =>
    setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const addAtPlayhead = () => {
    const ms = getPlayheadMs();
    if (ms === null) {
      return;
    }
    const key = newKey();
    setDrafts((all) =>
      sortChapterDrafts([
        ...all,
        {
          key,
          timeMs: Math.round(ms),
          timeText: f.formatDuration(ms),
          title: t("chapters.defaultTitle", { index: all.length + 1 }),
        },
      ]),
    );
    setFocusKey(key);
  };

  const save = async () => {
    if (hasErrors) {
      return;
    }
    setSaving(true);
    try {
      await onSave(
        sortChapterDrafts(drafts).map((d) => ({
          timeMs: d.timeMs as number,
          title: d.title.trim(),
        })),
      );
    } finally {
      setSaving(false);
    }
  };

  const youtube = outputChapters
    ? formatYouTubeChapters(outputChapters, { firstTitle })
    : "";

  return (
    <Panel
      title={t("chapters.title")}
      description={t("chapters.hint")}
      testId="chapters-panel"
      actions={
        <Button
          type="button"
          size="xs"
          variant="secondary"
          disabled={disabled}
          onClick={addAtPlayhead}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("chapters.addAtPlayhead")}
        </Button>
      }
    >
      {drafts.length === 0 ? (
        <p className="text-body text-muted-foreground">{t("chapters.empty")}</p>
      ) : (
        <ul ref={list} className="grid gap-2">
          {drafts.map((d, i) => {
            const check = checks[i];
            const timeError = check?.errors.find(
              (e) =>
                e === "invalidTime" ||
                e === "duplicateTime" ||
                e === "outOfRange",
            );
            const titleError = check?.errors.includes("emptyTitle");
            return (
              <li key={d.key} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <Tooltip content={t("chapters.seek")} side="top" align="start">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-info"
                      aria-label={t("chapters.seek")}
                      disabled={d.timeMs === null}
                      onClick={() => d.timeMs !== null && onSeek(d.timeMs)}
                    >
                      <Flag className="h-4 w-4" aria-hidden />
                    </Button>
                  </Tooltip>
                  <Input
                    className="timecode h-8 w-[4.75rem] shrink-0 px-2"
                    aria-label={t("chapters.time", { index: i + 1 })}
                    aria-invalid={timeError ? true : undefined}
                    inputMode="numeric"
                    value={d.timeText}
                    disabled={disabled}
                    onChange={(e) =>
                      update(d.key, {
                        timeText: e.target.value,
                        timeMs: parseTimecode(e.target.value),
                      })
                    }
                    onBlur={() => setDrafts((all) => sortChapterDrafts(all))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setDrafts((all) => sortChapterDrafts(all));
                      }
                    }}
                  />
                  <Input
                    className="h-8 min-w-0"
                    data-chapter-title={d.key}
                    aria-label={t("chapters.titleLabel", { index: i + 1 })}
                    aria-invalid={titleError ? true : undefined}
                    value={d.title}
                    disabled={disabled}
                    onChange={(e) => update(d.key, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && dirty && !hasErrors) {
                        save();
                      }
                    }}
                  />
                  <Tooltip content={t("chapters.delete")} side="top" align="end">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("chapters.delete")}
                      disabled={disabled}
                      onClick={() =>
                        setDrafts((all) => all.filter((x) => x.key !== d.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </Tooltip>
                </div>
                {check && (check.errors.length > 0 || check.insideCut) ? (
                  <div className="grid gap-0.5 pl-10 text-caption">
                    {check.errors.map((e) => (
                      <span key={e} className="text-destructive">
                        {t(`chapters.errors.${e}`)}
                      </span>
                    ))}
                    {check.insideCut ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        {check.insideCut.movedToMs === null
                          ? t("chapters.insideCutDropped")
                          : t("chapters.insideCut", {
                              time: f.formatDuration(check.insideCut.movedToMs),
                            })}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {dirty ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <span className="flex-1 text-caption">
            {hasErrors ? t("chapters.fixErrors") : t("tabs.unsaved")}
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={saving}
            onClick={() => setDrafts(toDrafts(chapters))}
          >
            {t("chapters.discard")}
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={disabled || saving || hasErrors}
            onClick={save}
          >
            {t("chapters.save")}
          </Button>
        </div>
      ) : null}

      {youtube ? (
        <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-caption text-muted-foreground">
              {t("chapters.copyYouTubeHint")}
            </span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => clipboard.copy("youtube", youtube)}
            >
              {clipboard.copied === "youtube" ? (
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {clipboard.copied === "youtube"
                ? t("chapters.copied", { count: youtube.split("\n").length })
                : t("chapters.copyYouTube")}
            </Button>
          </div>
          <pre
            className={cn(
              "timecode max-h-28 overflow-auto whitespace-pre-wrap break-words text-caption text-muted-foreground",
            )}
          >
            {youtube}
          </pre>
        </div>
      ) : null}
      {clipboard.error ? (
        <p className="text-caption text-destructive">{t("published.copyFailed")}</p>
      ) : null}
    </Panel>
  );
};
