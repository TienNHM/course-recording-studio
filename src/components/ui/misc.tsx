import * as React from "react";
import { cn } from "../../helpers/utils";

/** Horizontal or vertical divider line. */
export const Separator: React.FC<{
  readonly orientation?: "horizontal" | "vertical";
  readonly className?: string;
}> = ({ orientation = "horizontal", className }) => (
  <div
    role="separator"
    aria-orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
  />
);

/** Keyboard key, e.g. <Kbd>R</Kbd> for shortcuts. */
export const Kbd: React.FC<React.HTMLAttributes<HTMLElement>> = ({
  className,
  ...props
}) => (
  <kbd
    className={cn(
      "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-b-2 bg-muted px-1 font-mono text-2xs font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
);

/** Multi-line text input, styled like <Input>. */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Native checkbox tinted with the palette's primary color. */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

/** Live "REC" indicator. Red is reserved for this and destructive actions. */
export const RecordingIndicator: React.FC<{
  readonly label: string;
  readonly paused?: boolean;
  readonly className?: string;
}> = ({ label, paused, className }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-semibold",
      paused
        ? "bg-warning/10 text-warning"
        : "bg-recording text-recording-foreground",
      className,
    )}
  >
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 rounded-full bg-current",
        !paused && "animate-pulse",
      )}
    />
    {label}
  </span>
);
