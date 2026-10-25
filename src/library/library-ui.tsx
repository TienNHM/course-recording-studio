// Small building blocks used across the library. They only use tokens and
// the primitives in components/ui; candidates for promotion to ui/ later.
import { Check, Copy } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, type ButtonProps } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";

/** In-app confirmation (never window.confirm). Focus starts on Cancel. */
export const ConfirmDialog: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly confirmLabel: React.ReactNode;
  readonly cancelLabel?: React.ReactNode;
  readonly variant?: ButtonProps["variant"];
  readonly onConfirm: () => void;
  readonly children?: React.ReactNode;
}> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  children,
}) => {
  const tc = useT("common");
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[440px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** On/off switch with label and helper text (role="switch"). */
export const SwitchField: React.FC<{
  readonly label: React.ReactNode;
  readonly hint?: React.ReactNode;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly emphasis?: boolean;
  readonly className?: string;
}> = ({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  emphasis,
  className,
}) => {
  const id = useId();
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        emphasis && "rounded-lg border bg-card p-3",
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      <div className="grid min-w-0 gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-label">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-caption text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
};

/** Copies text with navigator.clipboard; shows "copied" for 2 s. */
export const CopyButton: React.FC<{
  readonly text: string;
  readonly label: string;
  readonly copiedLabel: string;
  readonly failedLabel: string;
}> = ({ text, label, copiedLabel, failedLabel }) => {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") {
      return;
    }
    const timeout = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timeout);
  }, [state]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }, [text]);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={state === "copied" ? copiedLabel : label}
        title={label}
        onClick={onCopy}
      >
        {state === "copied" ? (
          <Check className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}
      </span>
      {state === "failed" ? (
        <span className="text-caption text-destructive">{failedLabel}</span>
      ) : null}
    </span>
  );
};

/** A command line with a copy button. */
export const CommandBlock: React.FC<{
  readonly command: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly failedLabel: string;
}> = ({ command, copyLabel, copiedLabel, failedLabel }) => (
  <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-2 pl-3">
    <code className="min-w-0 flex-1 whitespace-pre-wrap break-all py-1 font-mono text-caption text-foreground">
      {command}
    </code>
    <CopyButton
      text={command}
      label={copyLabel}
      copiedLabel={copiedLabel}
      failedLabel={failedLabel}
    />
  </div>
);

/** Centered empty state with icon, text and the next step. */
export const EmptyState: React.FC<{
  readonly icon: React.ReactNode;
  readonly title: React.ReactNode;
  readonly body?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly className?: string;
}> = ({ icon, title, body, action, className }) => (
  <div
    className={cn(
      "flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center",
      className,
    )}
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:h-6 [&_svg]:w-6">
      {icon}
    </span>
    <div className="grid gap-1">
      <h2 className="text-heading">{title}</h2>
      {body ? (
        <p className="max-w-sm text-body text-muted-foreground">{body}</p>
      ) : null}
    </div>
    {action}
  </div>
);

/** Small uppercase group label. */
export const SectionLabel: React.FC<{
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly id?: string;
}> = ({ children, className, id }) => (
  <h3
    id={id}
    className={cn(
      "text-overline uppercase text-muted-foreground",
      className,
    )}
  >
    {children}
  </h3>
);
