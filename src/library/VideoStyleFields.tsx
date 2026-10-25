import { Check } from "lucide-react";
import React, { useRef } from "react";
import type { VideoPalette, VideoStyle } from "../../config/course";
import { videoPalette } from "../../config/course";
import { SegmentedControl } from "../components/ui/segmented-control";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { ThemeScope } from "../theme/ThemeScope";
import { SwitchField } from "./library-ui";

const PALETTES = videoPalette.options;
const INTROS = ["minimal", "gradient", "starburst"] as const;
const TRANSITIONS = ["none", "fade", "slide", "light-leak"] as const;
const TOGGLES = [
  "chapterCards",
  "lowerThird",
  "progressBar",
  "backgroundMusic",
] as const;

/** Radio group of palette swatches (arrow keys move the selection). */
const PaletteSwatches: React.FC<{
  readonly value: VideoPalette;
  readonly onChange: (value: VideoPalette) => void;
  readonly labelledBy: string;
}> = ({ value, onChange, labelledBy }) => {
  const ts = useT("settings");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + PALETTES.length) % PALETTES.length;
    const palette = PALETTES[next];
    if (palette) {
      onChange(palette);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
    >
      {PALETTES.map((id, index) => {
        const selected = id === value;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "grid gap-1.5 rounded-lg border p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "border-primary ring-1 ring-primary",
            )}
          >
            <ThemeScope
              palette={id}
              mode="dark"
              className="relative flex h-10 items-end overflow-hidden rounded-md"
            >
              <span aria-hidden className="absolute inset-0 bg-brand-gradient" />
              <span
                aria-hidden
                className="relative m-1 h-1.5 w-1/2 rounded-full bg-brand-foreground/80"
              />
              {selected ? (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              ) : null}
            </ThemeScope>
            <span className="truncate px-0.5 text-caption">
              {ts(`palette.${id}.name`)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const VideoStyleFields: React.FC<{
  readonly value: VideoStyle;
  readonly onChange: (patch: Partial<VideoStyle>) => void;
}> = ({ value, onChange }) => {
  const t = useT("library");
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <span id="video-palette-label" className="text-label">
          {t("videoStyle.palette")}
        </span>
        <PaletteSwatches
          labelledBy="video-palette-label"
          value={value.palette}
          onChange={(palette) => onChange({ palette })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span id="video-intro-label" className="text-label">
            {t("videoStyle.intro")}
          </span>
          <SegmentedControl
            aria-labelledby="video-intro-label"
            className="w-full"
            value={value.intro}
            onValueChange={(intro) => onChange({ intro })}
            options={INTROS.map((id) => ({
              value: id,
              label: t(`videoStyle.intros.${id}`),
            }))}
          />
        </div>
        <div className="grid gap-2">
          <span id="video-transition-label" className="text-label">
            {t("videoStyle.transition")}
          </span>
          <SegmentedControl
            aria-labelledby="video-transition-label"
            className="w-full"
            value={value.transition}
            onValueChange={(transition) => onChange({ transition })}
            options={TRANSITIONS.map((id) => ({
              value: id,
              label: t(`videoStyle.transitions.${id}`),
            }))}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLES.map((key) => (
          <SwitchField
            key={key}
            label={t(`videoStyle.${key}`)}
            hint={t(`videoStyle.${key}Hint`)}
            checked={value[key]}
            onCheckedChange={(checked) => onChange({ [key]: checked })}
          />
        ))}
      </div>
    </div>
  );
};

/** Lightweight mock-up of the intro when no lesson has a take yet. */
export const VideoStyleMock: React.FC<{
  readonly value: VideoStyle;
  readonly courseName: string;
}> = ({ value, courseName }) => {
  const t = useT("library");
  return (
    <ThemeScope
      palette={value.palette}
      mode="dark"
      aria-hidden
      className={cn(
        "relative flex aspect-video w-full flex-col justify-center overflow-hidden rounded-lg border p-[6%]",
        value.intro === "gradient" && "bg-brand-gradient text-brand-foreground",
      )}
    >
      {value.intro === "starburst" ? (
        <span
          className="absolute inset-0"
          style={{
            background:
              "repeating-conic-gradient(from 0deg at 50% 50%, hsl(var(--brand-from) / 0.35) 0deg 8deg, transparent 8deg 16deg)",
          }}
        />
      ) : null}
      <div
        className={cn(
          "relative grid gap-1",
          value.intro === "minimal" ? "text-left" : "text-center",
        )}
      >
        {value.intro === "minimal" ? (
          <span className="mb-1 h-1 w-10 rounded-full bg-primary" />
        ) : null}
        <span className="text-overline uppercase opacity-80">
          {t("videoStyle.mockLesson")}
        </span>
        <span className="text-title">{t("videoStyle.mockTitle")}</span>
        <span className="text-caption opacity-80">{courseName}</span>
      </div>
      {value.chapterCards ? (
        <span className="absolute right-3 top-3 rounded-md bg-card/90 px-2 py-1 text-2xs text-card-foreground shadow">
          {t("videoStyle.chapterCards")}
        </span>
      ) : null}
      {value.lowerThird ? (
        <span className="absolute bottom-4 left-3 rounded-md bg-card/90 px-2 py-1 text-2xs text-card-foreground shadow">
          {courseName}
        </span>
      ) : null}
      {value.progressBar ? (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
          <span className="block h-full w-1/3 bg-brand-gradient" />
        </span>
      ) : null}
    </ThemeScope>
  );
};
