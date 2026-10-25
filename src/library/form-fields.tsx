import React from "react";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/misc";
import { cn } from "../helpers/utils";

/**
 * Label + control + optional hint / error. Pass `htmlFor` = the control's id;
 * the hint/error get `${htmlFor}-hint` / `${htmlFor}-error` ids so the control
 * can reference them with aria-describedby (see `describedBy`).
 */
export const Field: React.FC<{
  readonly label: React.ReactNode;
  readonly htmlFor?: string;
  readonly hint?: React.ReactNode;
  readonly error?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}> = ({ label, htmlFor, hint, error, className, children }) => {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-label">
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-caption text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={htmlFor ? `${htmlFor}-hint` : undefined}
          className="text-caption text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export const describedBy = (
  id: string,
  { hint, error }: { hint?: unknown; error?: unknown },
) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

/** @deprecated use Textarea from components/ui/misc. Kept for other areas. */
export const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = (props) => <Textarea {...props} />;

/** Labelled native checkbox (kept for src/review/SettingsPanel.tsx). */
export const Checkbox: React.FC<{
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-body">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
};

/** Native <select> styled like <Input>. */
export const NativeSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className, ...props }) => {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
};
