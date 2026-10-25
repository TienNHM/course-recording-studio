import { Clapperboard } from "lucide-react";
import React from "react";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { SettingsButton } from "./settings/SettingsDialog";

/** App logo: gradient tile + wordmark, readable in every palette and mode. */
export const BrandMark: React.FC<{
  readonly compact?: boolean;
  readonly className?: string;
}> = ({ compact, className }) => {
  const t = useT("common");
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-brand-foreground shadow-sm">
        <Clapperboard className="h-4 w-4" aria-hidden />
      </span>
      {compact ? (
        <span className="sr-only">{t("appName")}</span>
      ) : (
        <span className="whitespace-nowrap text-heading">{t("appName")}</span>
      )}
    </span>
  );
};

/**
 * Shared top bar for every view. Area pages render it at the top instead of
 * their own header:
 *
 *   <AppHeader
 *     title={t("title")}                       // view name, next to the logo
 *     subtitle={<Breadcrumb … />}              // optional second line / context
 *     leading={<Button variant="ghost" …>Back</Button>}  // optional, before logo
 *     actions={<Button>…</Button>}             // right side, before the gear
 *   />
 *
 * The settings gear (language, mode, palette, design system) is always last.
 * Height is `h-header` (3.5rem); the header never wraps.
 */
export const AppHeader: React.FC<{
  readonly title?: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  readonly leading?: React.ReactNode;
  readonly actions?: React.ReactNode;
  /** Hide the wordmark text (narrow layouts, recorder). */
  readonly compactBrand?: boolean;
  readonly className?: string;
}> = ({ title, subtitle, leading, actions, compactBrand, className }) => (
  <header
    className={cn(
      "flex h-header shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      className,
    )}
  >
    {leading}
    <BrandMark compact={compactBrand} />
    {title || subtitle ? (
      <div className="flex min-w-0 items-baseline gap-2">
        {title ? (
          <>
            <span aria-hidden className="text-muted-foreground">
              /
            </span>
            <h1 className="truncate text-label">{title}</h1>
          </>
        ) : null}
        {subtitle ? (
          <div className="min-w-0 truncate text-caption text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
    ) : null}
    <div className="flex-1" />
    {actions ? (
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    ) : null}
    <SettingsButton />
  </header>
);
