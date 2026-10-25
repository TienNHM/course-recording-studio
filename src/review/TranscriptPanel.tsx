import type { Caption } from "@remotion/captions";
import { Check, Loader2, Pencil, Search, Sparkles, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { Panel } from "./Panel";
import type { PlayheadStore } from "./playhead";
import {
  buildLineTokens,
  fixAliases,
  matchesQuery,
  type GlossaryTerm,
  type TranscriptToken,
} from "./review-helpers";
import { applyLineText, groupIntoLines, type TranscriptLine } from "./transcript-lines";
import { useReviewFormat } from "./use-review-format";

type LineState = "saving" | "saved" | "error";

const hasAlias = (line: TranscriptLine, glossary: GlossaryTerm[]) =>
  glossary.length > 0 && fixAliases(line.text, glossary) !== line.text;

const Token: React.FC<{
  readonly token: TranscriptToken;
  readonly onFixAlias: () => void;
}> = ({ token, onFixAlias }) => {
  const t = useT("review");
  const className = cn(
    token.search && "rounded-sm bg-primary/20 text-foreground",
    token.term && "font-medium text-primary",
    token.lowConfidence &&
      "underline decoration-warning decoration-dotted decoration-2 underline-offset-4",
  );
  if (token.aliasOf) {
    return (
      <button
        type="button"
        className={cn(
          className,
          "rounded-sm bg-warning/10 underline decoration-warning decoration-wavy underline-offset-4 hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        title={t("transcript.aliasOf", { term: token.aliasOf })}
        onClick={(e) => {
          e.stopPropagation();
          onFixAlias();
        }}
      >
        {token.text}
      </button>
    );
  }
  const title = token.term
    ? t("transcript.glossaryTerm", { term: token.term })
    : token.lowConfidence
      ? t("transcript.lowConfidence")
      : undefined;
  return className || title ? (
    <span className={className} title={title}>
      {token.text}
    </span>
  ) : (
    <>{token.text}</>
  );
};

/** Searchable transcript; click a line to seek, edit a line in place. */
export const TranscriptPanel: React.FC<{
  readonly captions: Caption[] | null;
  readonly glossary: GlossaryTerm[];
  readonly disabled: boolean;
  readonly resetToken: number;
  readonly playhead: PlayheadStore;
  /** Player ms → original take ms. */
  readonly toOriginalMs: (playerMs: number) => number | null;
  readonly onSeek: (originalMs: number) => void;
  readonly onSave: (captions: Caption[]) => Promise<boolean>;
  readonly onDirtyChange: (dirty: boolean) => void;
}> = ({
  captions,
  glossary,
  disabled,
  resetToken,
  playhead,
  toOriginalMs,
  onSeek,
  onSave,
  onDirtyChange,
}) => {
  const t = useT("review");
  const f = useReviewFormat();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ start: number; text: string } | null>(
    null,
  );
  const [lineState, setLineState] = useState<Record<number, LineState>>({});
  const editInput = useRef<HTMLInputElement>(null);

  const lines = useMemo(() => groupIntoLines(captions ?? []), [captions]);

  useEffect(() => {
    setEditing(null);
  }, [resetToken]);

  const editingLine = editing
    ? lines.find((l) => l.start === editing.start) ?? null
    : null;
  const dirty =
    editing !== null &&
    editingLine !== null &&
    editing.text.trim() !== editingLine.text;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (editing) {
      editInput.current?.focus();
    }
    // Focus only when a line starts being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.start]);

  // Re-render only when the active line changes, not on every frame.
  const activeStart = useSyncExternalStore(
    playhead.subscribe,
    useCallback(() => {
      const ms = toOriginalMs(playhead.get());
      if (ms === null) {
        return -1;
      }
      const line = lines.find((l) => ms >= l.startMs && ms < l.endMs);
      return line ? line.start : -1;
    }, [lines, playhead, toOriginalMs]),
  );

  const visible = useMemo(
    () => (query.trim() ? lines.filter((l) => matchesQuery(l.text, query)) : lines),
    [lines, query],
  );

  const aliasLines = useMemo(
    () => lines.filter((l) => hasAlias(l, glossary)),
    [glossary, lines],
  );

  const saveLines = async (changes: { line: TranscriptLine; text: string }[]) => {
    if (!captions || changes.length === 0) {
      return;
    }
    let next = captions;
    for (const { line, text } of changes) {
      next = applyLineText(next, line, text);
    }
    const starts = changes.map((c) => c.line.start);
    const mark = (state: LineState | null) =>
      setLineState((all) => {
        const copy = { ...all };
        for (const s of starts) {
          if (state) {
            copy[s] = state;
          } else {
            delete copy[s];
          }
        }
        return copy;
      });
    mark("saving");
    const ok = await onSave(next);
    mark(ok ? "saved" : "error");
    setTimeout(() => mark(null), 2000);
  };

  const commit = () => {
    if (!editing || !editingLine) {
      setEditing(null);
      return;
    }
    const text = editing.text.trim();
    setEditing(null);
    if (text !== editingLine.text) {
      saveLines([{ line: editingLine, text }]);
    }
  };

  if (!captions) {
    return (
      <Panel title={t("transcript.title")} testId="transcript-panel">
        <p className="text-body text-muted-foreground">{t("transcript.empty")}</p>
      </Panel>
    );
  }

  return (
    <Panel
      title={t("transcript.title")}
      description={
        query.trim()
          ? t("transcript.results", { count: visible.length })
          : t("transcript.lines", { count: lines.length })
      }
      testId="transcript-panel"
      actions={
        aliasLines.length > 0 ? (
          <Button
            type="button"
            size="xs"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              saveLines(
                aliasLines.map((line) => ({
                  line,
                  text: fixAliases(line.text, glossary),
                })),
              )
            }
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("transcript.fixAll", { count: aliasLines.length })}
          </Button>
        ) : null
      }
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          className="h-9 pl-8"
          aria-label={t("transcript.search")}
          placeholder={t("transcript.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {glossary.length > 0 ? (
          <>
            <span className="font-medium text-primary">
              {t("transcript.legend.glossary")}
            </span>
            <span className="underline decoration-warning decoration-wavy underline-offset-4">
              {t("transcript.legend.alias")}
            </span>
          </>
        ) : null}
        <span className="underline decoration-warning decoration-dotted decoration-2 underline-offset-4">
          {t("transcript.legend.lowConfidence")}
        </span>
      </div>

      <ul className="grid gap-0.5" data-testid="transcript-lines">
        {visible.map((line) => {
          const index = lines.indexOf(line);
          const isEditing = editing?.start === line.start;
          const state = lineState[line.start];
          const active = activeStart === line.start;
          return (
            <li
              key={line.start}
              className={cn(
                "group flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/60",
                active && "bg-primary/10",
              )}
            >
              <button
                type="button"
                className={cn(
                  "timecode mt-0.5 w-11 shrink-0 rounded-sm text-left text-caption hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-label={t("transcript.seekLine", {
                  time: f.formatDuration(line.startMs),
                })}
                onClick={() => onSeek(line.startMs)}
              >
                {f.formatDuration(line.startMs)}
              </button>
              {isEditing && editing ? (
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-center gap-1">
                    <Input
                      ref={editInput}
                      className="h-8 min-w-0"
                      aria-label={t("transcript.editLine", { index: index + 1 })}
                      value={editing.text}
                      onChange={(e) =>
                        setEditing({ start: line.start, text: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commit();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      aria-label={t("transcript.saveLine")}
                      onClick={commit}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("transcript.cancelEdit")}
                      onClick={() => setEditing(null)}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <span className="text-caption text-muted-foreground">
                    {t("transcript.editHint")}
                  </span>
                </div>
              ) : (
                <>
                  <div
                    className="min-w-0 flex-1 cursor-pointer text-body"
                    onClick={() => onSeek(line.startMs)}
                    onDoubleClick={() =>
                      !disabled && setEditing({ start: line.start, text: line.text })
                    }
                  >
                    {buildLineTokens(captions.slice(line.start, line.end), {
                      glossary,
                      query,
                    }).map((token, k) => (
                      <Token
                        key={k}
                        token={token}
                        onFixAlias={() =>
                          saveLines([
                            { line, text: fixAliases(line.text, glossary) },
                          ])
                        }
                      />
                    ))}
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {state === "saving" ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-muted-foreground"
                        aria-label={t("transcript.saving")}
                      />
                    ) : state === "saved" ? (
                      <Check
                        className="h-4 w-4 text-success"
                        aria-label={t("transcript.saved")}
                      />
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={t("transcript.editLine", { index: index + 1 })}
                        title={t("transcript.edit")}
                        disabled={disabled}
                        onClick={() =>
                          setEditing({ start: line.start, text: line.text })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};
