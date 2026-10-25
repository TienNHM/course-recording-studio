import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../helpers/utils";

const indicatorVariants = cva("h-full rounded-full transition-[width]", {
  variants: {
    tone: {
      primary: "bg-primary",
      brand: "bg-brand-gradient",
      success: "bg-success",
      warning: "bg-warning",
      info: "bg-info",
      destructive: "bg-destructive",
      recording: "bg-recording",
    },
  },
  defaultVariants: { tone: "primary" },
});

type ProgressProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> &
  VariantProps<typeof indicatorVariants> & {
    /** 0..1. `null` / undefined → indeterminate (animated). */
    readonly value?: number | null;
    /** Accessible name, e.g. t("…exporting"). */
    readonly label?: string;
  };

/** Determinate or indeterminate progress bar (no Radix dependency). */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, tone, label, ...props }, ref) => {
    const indeterminate = value === null || value === undefined;
    const clamped = indeterminate ? 0 : Math.min(1, Math.max(0, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(clamped * 100)}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            indicatorVariants({ tone }),
            indeterminate && "absolute w-2/5 animate-progress-indeterminate",
          )}
          style={indeterminate ? undefined : { width: `${clamped * 100}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
export type { ProgressProps };
