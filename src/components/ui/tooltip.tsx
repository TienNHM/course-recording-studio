import * as React from "react";
import { cn } from "../../helpers/utils";

/**
 * Lightweight CSS tooltip (no @radix-ui/react-tooltip installed). Shows on
 * hover and keyboard focus of the wrapped element.
 *
 *   <Tooltip content={t("actions.settings")}><Button size="icon">…</Button></Tooltip>
 *
 * Icon-only buttons still need their own `aria-label`; the tooltip is visual.
 * It does not escape `overflow: hidden` ancestors — use `side` to adjust.
 */
export const Tooltip: React.FC<{
  readonly content: React.ReactNode;
  readonly children: React.ReactNode;
  readonly side?: "top" | "bottom" | "left" | "right";
  /** For top/bottom: which edge to align to. Use "end" near the right edge. */
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
}> = ({ content, children, side = "top", align = "center", className }) => (
  <span className={cn("group/tooltip relative inline-flex", className)}>
    {children}
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-50 w-max max-w-xs rounded-md border bg-popover px-2 py-1 text-caption text-popover-foreground opacity-0 shadow-md transition-opacity delay-150 group-focus-within/tooltip:opacity-100 group-hover/tooltip:opacity-100",
        side === "top" && "bottom-full mb-1.5",
        side === "bottom" && "top-full mt-1.5",
        (side === "top" || side === "bottom") &&
          (align === "start"
            ? "left-0"
            : align === "end"
              ? "right-0"
              : "left-1/2 -translate-x-1/2"),
        side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
        side === "right" && "left-full top-1/2 ml-1.5 -translate-y-1/2",
      )}
    >
      {content}
    </span>
  </span>
);
