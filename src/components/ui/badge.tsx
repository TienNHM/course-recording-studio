import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../helpers/utils";

/**
 * Small label for statuses and counts.
 *
 * - `tone`: meaning → neutral | primary | success | warning | info |
 *   destructive | recording (live/REC only)
 * - `variant`: emphasis → soft (default, tinted) | solid | outline
 * - `dot`: leading status dot; `pulse` animates it (in-progress / live)
 *
 * For lesson statuses use <LessonStatusBadge status="..."/> instead.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "",
        primary: "",
        success: "",
        warning: "",
        info: "",
        destructive: "",
        recording: "",
      },
      variant: {
        soft: "border-transparent",
        solid: "border-transparent",
        outline: "bg-transparent",
      },
      size: {
        default: "",
        sm: "px-1.5 py-0 text-2xs",
      },
    },
    compoundVariants: [
      // soft: tinted background + colored text (AA on page/card backgrounds)
      {
        variant: "soft",
        tone: "neutral",
        className: "bg-muted text-muted-foreground",
      },
      {
        variant: "soft",
        tone: "primary",
        className: "bg-primary/10 text-primary",
      },
      {
        variant: "soft",
        tone: "success",
        className: "bg-success/10 text-success",
      },
      {
        variant: "soft",
        tone: "warning",
        className: "bg-warning/10 text-warning",
      },
      { variant: "soft", tone: "info", className: "bg-info/10 text-info" },
      {
        variant: "soft",
        tone: "destructive",
        className: "bg-destructive/10 text-destructive",
      },
      {
        variant: "soft",
        tone: "recording",
        className: "bg-recording/10 text-recording",
      },
      // solid
      {
        variant: "solid",
        tone: "neutral",
        className: "bg-secondary text-secondary-foreground",
      },
      {
        variant: "solid",
        tone: "primary",
        className: "bg-primary text-primary-foreground",
      },
      {
        variant: "solid",
        tone: "success",
        className: "bg-success text-success-foreground",
      },
      {
        variant: "solid",
        tone: "warning",
        className: "bg-warning text-warning-foreground",
      },
      {
        variant: "solid",
        tone: "info",
        className: "bg-info text-info-foreground",
      },
      {
        variant: "solid",
        tone: "destructive",
        className: "bg-destructive text-destructive-foreground",
      },
      {
        variant: "solid",
        tone: "recording",
        className: "bg-recording text-recording-foreground",
      },
      // outline
      {
        variant: "outline",
        tone: "neutral",
        className: "border-border text-muted-foreground",
      },
      {
        variant: "outline",
        tone: "primary",
        className: "border-primary/40 text-primary",
      },
      {
        variant: "outline",
        tone: "success",
        className: "border-success/40 text-success",
      },
      {
        variant: "outline",
        tone: "warning",
        className: "border-warning/40 text-warning",
      },
      {
        variant: "outline",
        tone: "info",
        className: "border-info/40 text-info",
      },
      {
        variant: "outline",
        tone: "destructive",
        className: "border-destructive/40 text-destructive",
      },
      {
        variant: "outline",
        tone: "recording",
        className: "border-recording/40 text-recording",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      variant: "soft",
      size: "default",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Show a leading status dot. */
    readonly dot?: boolean;
    /** Animate the dot (processing, live recording). */
    readonly pulse?: boolean;
  };

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, variant, size, dot, pulse, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ tone, variant, size }), className)}
      {...props}
    >
      {dot || pulse ? (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
            pulse && "animate-pulse",
          )}
        />
      ) : null}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";

export type BadgeTone = NonNullable<BadgeProps["tone"]>;
export { Badge, badgeVariants };
export type { BadgeProps };
