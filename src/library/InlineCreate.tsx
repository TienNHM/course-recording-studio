import { Loader2, Plus } from "lucide-react";
import React, { useCallback, useId, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { TITLE_MAX_LENGTH, validateTitle } from "./lesson-flow";

// One-line "add item" form: Enter creates, Escape clears. Errors are shown
// inline (validation only after a submit attempt).
export const InlineCreate: React.FC<{
  readonly placeholder: string;
  readonly buttonLabel: string;
  readonly onCreate: (title: string) => Promise<unknown>;
  readonly autoFocus?: boolean;
  readonly className?: string;
}> = ({ placeholder, buttonLabel, onCreate, autoFocus, className }) => {
  const t = useT("library");
  const id = useId();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const invalid = validateTitle(title);
      if (invalid) {
        setError(
          invalid === "required"
            ? t("inlineCreate.required")
            : t("inlineCreate.tooLong", { max: TITLE_MAX_LENGTH }),
        );
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await onCreate(title.trim());
        setTitle("");
      } catch (err) {
        setError(t("inlineCreate.failed", { message: (err as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [onCreate, t, title],
  );

  return (
    <form className={cn("grid gap-1", className)} onSubmit={onSubmit}>
      <div className="flex gap-2">
        <Input
          id={id}
          className="h-9"
          placeholder={placeholder}
          aria-label={placeholder}
          value={title}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && title) {
              e.preventDefault();
              e.stopPropagation();
              setTitle("");
              setError(null);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          <span className="hidden sm:inline">{buttonLabel}</span>
          <span className="sr-only sm:hidden">{buttonLabel}</span>
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
};
