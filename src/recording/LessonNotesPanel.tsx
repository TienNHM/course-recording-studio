import { AArrowDown, AArrowUp, ChevronDown, NotebookText } from "lucide-react";
import React, { useCallback, useId, useState } from "react";
import { Button } from "../components/ui/button";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { useCurrentLesson } from "../state/current-lesson";

const SIZES = ["text-body", "text-heading", "text-title"] as const;
const SIZE_KEY = "crs:recorder.notesSize";

const readSize = (): number => {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    return Number.isInteger(n) && n >= 0 && n < SIZES.length ? n : 1;
  } catch {
    return 1;
  }
};

/**
 * Read-only "teleprompter": the lesson's objectives and speaker notes, so
 * the presenter can follow them while recording. Collapsible; larger text
 * while recording.
 */
export const LessonNotesPanel: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly className?: string;
}> = ({ open, onOpenChange, className }) => {
  const t = useT("recording");
  const { lesson } = useCurrentLesson();
  const [size, setSize] = useState(readSize);
  const bodyId = useId();

  const changeSize = useCallback((delta: number) => {
    setSize((s) => {
      const next = Math.max(0, Math.min(SIZES.length - 1, s + delta));
      try {
        localStorage.setItem(SIZE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const objectives = lesson?.objectives.filter((o) => o.trim()) ?? [];
  const notes = lesson?.notes.trim() ?? "";
  const description = lesson?.description.trim() ?? "";
  const empty = !objectives.length && !notes && !description;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-lg border bg-card text-card-foreground",
        className,
      )}
      aria-label={t("notes.title")}
    >
      <div className="flex items-center gap-1 border-b py-1 pl-3 pr-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 text-left text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
        >
          <NotebookText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{t("notes.title")}</span>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="sr-only">
            {open ? t("notes.collapse") : t("notes.expand")}
          </span>
        </button>
        {open && !empty ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("notes.smaller")}
              onClick={() => changeSize(-1)}
              disabled={size === 0}
            >
              <AArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("notes.larger")}
              onClick={() => changeSize(1)}
              disabled={size === SIZES.length - 1}
            >
              <AArrowUp className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
      {open ? (
        <div id={bodyId} className="min-h-0 flex-1 overflow-y-auto p-3">
          {!lesson ? (
            <p className="text-caption text-muted-foreground">
              {t("notes.noLesson")}
            </p>
          ) : empty ? (
            <p className="text-caption text-muted-foreground">
              {t("notes.empty")}
            </p>
          ) : (
            <div className={cn("flex flex-col gap-4", SIZES[size])}>
              {objectives.length ? (
                <div>
                  <h3 className="text-overline uppercase text-muted-foreground">
                    {t("notes.objectives")}
                  </h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">
                    {objectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {notes ? (
                <div>
                  <h3 className="text-overline uppercase text-muted-foreground">
                    {t("notes.notes")}
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap">{notes}</p>
                </div>
              ) : null}
              {description && !notes ? (
                <div>
                  <h3 className="text-overline uppercase text-muted-foreground">
                    {t("notes.description")}
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">
                    {description}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
