import { Check, Monitor, Moon, Palette, Settings, Sun } from "lucide-react";
import React, { useId, useState } from "react";
import { cn } from "../../helpers/utils";
import { LOCALES, LOCALE_NAMES, isLocale, useT } from "../../i18n";
import { useView } from "../../state/view";
import { usePreferences } from "../../theme/PreferencesProvider";
import { ThemeScope } from "../../theme/ThemeScope";
import type { ColorMode } from "../../theme/preferences";
import { PALETTE_IDS, type PaletteId } from "../../theme/tokens";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { SegmentedControl } from "../ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tooltip } from "../ui/tooltip";

/** Mini preview of a palette in the current mode (used by the picker). */
export const PaletteSwatch: React.FC<{
  readonly palette: PaletteId;
  readonly selected: boolean;
  readonly onSelect: () => void;
}> = ({ palette, selected, onSelect }) => {
  const t = useT("settings");
  const { resolvedMode } = usePreferences();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        selected
          ? "border-primary ring-2 ring-primary"
          : "hover:border-primary/50",
      )}
    >
      <ThemeScope
        palette={palette}
        mode={resolvedMode}
        className="flex items-center gap-1.5 p-2.5"
      >
        <span className="h-6 flex-1 rounded-md bg-brand-gradient" />
        <span className="h-6 w-6 rounded-md bg-primary" />
        <span className="h-6 w-6 rounded-md border bg-accent" />
        <span className="h-6 w-6 rounded-md border bg-card" />
      </ThemeScope>
      <span className="flex items-start gap-2 border-t bg-card px-2.5 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label">
            {t(`palette.${palette}.name`)}
          </span>
          <span className="block truncate text-caption text-muted-foreground">
            {t(`palette.${palette}.description`)}
          </span>
        </span>
        {selected ? (
          <Check
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-label={t("palette.selected")}
          />
        ) : null}
      </span>
    </button>
  );
};

export const SettingsDialog: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const t = useT("settings");
  const {
    mode,
    resolvedMode,
    palette,
    locale,
    setMode,
    setPalette,
    setLocale,
  } = usePreferences();
  const [, setView] = useView();
  const languageId = useId();
  const modeId = useId();
  const paletteId = useId();

  const modeOptions: {
    value: ColorMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "light",
      label: t("mode.light"),
      icon: <Sun className="h-4 w-4" />,
    },
    {
      value: "dark",
      label: t("mode.dark"),
      icon: <Moon className="h-4 w-4" />,
    },
    {
      value: "system",
      label: t("mode.system"),
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-2">
            <Label htmlFor={languageId}>{t("language.label")}</Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                if (isLocale(value)) {
                  setLocale(value);
                }
              }}
            >
              <SelectTrigger id={languageId} className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCALE_NAMES[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground">
              {t("language.hint")}
            </p>
          </section>

          <section className="grid gap-2">
            <Label id={modeId}>{t("mode.label")}</Label>
            <SegmentedControl
              aria-labelledby={modeId}
              value={mode}
              onValueChange={setMode}
              options={modeOptions}
              className="sm:w-fit"
            />
            {mode === "system" ? (
              <p className="text-caption text-muted-foreground">
                {t("mode.systemHint", {
                  mode: t(`mode.${resolvedMode}`).toLocaleLowerCase(locale),
                })}
              </p>
            ) : null}
          </section>

          <section className="grid gap-2">
            <Label id={paletteId}>{t("palette.label")}</Label>
            <div
              role="radiogroup"
              aria-labelledby={paletteId}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {PALETTE_IDS.map((id) => (
                <PaletteSwatch
                  key={id}
                  palette={id}
                  selected={id === palette}
                  onSelect={() => setPalette(id)}
                />
              ))}
            </div>
            <p className="text-caption text-muted-foreground">
              {t("palette.hint")}
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between sm:space-x-0">
          <p className="text-caption text-muted-foreground">
            {t("savedLocally")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setView("styleguide");
            }}
          >
            <Palette className="h-4 w-4" />
            {t("viewDesignSystem")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Gear icon button that opens the Settings dialog. Already in <AppHeader>. */
export const SettingsButton: React.FC<{ readonly className?: string }> = ({
  className,
}) => {
  const t = useT("settings");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip
        content={t("openSettings")}
        side="bottom"
        align="end"
        className={className}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("openSettings")}
          onClick={() => setOpen(true)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </Tooltip>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
