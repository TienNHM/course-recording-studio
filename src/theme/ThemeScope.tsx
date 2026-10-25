import React from "react";
import { cn } from "../helpers/utils";
import type { PaletteId, ResolvedMode } from "./tokens";

/**
 * Renders its children in a fixed palette + mode regardless of the app theme
 * (previews, palette pickers, the styleguide). The mode class and
 * `data-palette` must sit on the same element for the token selectors to match.
 */
export const ThemeScope: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    readonly palette: PaletteId;
    readonly mode: ResolvedMode;
  }
> = ({ palette, mode, className, ...props }) => (
  <div
    data-palette={palette}
    className={cn(mode, "bg-background text-foreground", className)}
    {...props}
  />
);
