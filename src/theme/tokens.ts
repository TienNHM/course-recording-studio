/**
 * Design tokens: the single source of truth for every color in the web UI.
 *
 * The CSS variables in `src/index.css` (between the `@generated theme` markers)
 * are generated from this file. After editing it, run:
 *
 *   bun scripts/generate-theme-css.ts
 *
 * `tests/theme-tokens.test.ts` fails if the CSS is out of date or if a text
 * token does not reach WCAG AA contrast on its background.
 *
 * Values are HSL triplets (shadcn convention): `[hue, saturation%, lightness%]`,
 * rendered as `--token: h s% l%` and consumed as `hsl(var(--token))`.
 */

export const PALETTE_IDS = [
  "dotnet",
  "recorder",
  "ocean",
  "emerald",
  "slate",
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = "dotnet";

export const RESOLVED_MODES = ["light", "dark"] as const;
export type ResolvedMode = (typeof RESOLVED_MODES)[number];

export const TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "recording",
  "recording-foreground",
  "border",
  "input",
  "ring",
  "brand-from",
  "brand-to",
  "brand-foreground",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

export type Hsl = readonly [number, number, number];
export type ThemeTokens = Record<TokenName, Hsl>;

type ModeSpec = {
  readonly primary: Hsl;
  readonly primaryForeground: Hsl;
  readonly brandFrom: Hsl;
  readonly brandTo: Hsl;
  /** Text on the brand gradient (must pass AA on both ends). Default white. */
  readonly brandForeground?: Hsl;
};

type PaletteSpec = {
  /** Hue + saturation used to tint neutral surfaces (background, card, border...). */
  readonly neutral: { readonly h: number; readonly s: number };
  readonly light: ModeSpec;
  readonly dark: ModeSpec;
};

const WHITE: Hsl = [0, 0, 100];

const PALETTE_SPECS: Record<PaletteId, PaletteSpec> = {
  // .NET course site (dotnet-course.tiennhm.io.vn): purple #7C5CE0 + blue gradient
  dotnet: {
    neutral: { h: 250, s: 14 },
    light: {
      // #7C5CE0 (brand-from) is 4.49:1 on the page background; a slightly
      // deeper purple keeps text-primary and soft badges at AA
      primary: [254, 62, 57],
      primaryForeground: WHITE,
      brandFrom: [254, 68, 62],
      brandTo: [221, 83, 50],
    },
    dark: {
      primary: [254, 90, 76],
      primaryForeground: [254, 50, 10],
      brandFrom: [254, 68, 62],
      brandTo: [221, 83, 50],
    },
  },
  // Remotion Recorder red. Here red is also the brand color.
  recorder: {
    neutral: { h: 240, s: 4 },
    light: {
      primary: [0, 74, 43],
      primaryForeground: WHITE,
      brandFrom: [0, 76, 46],
      brandTo: [18, 90, 40],
    },
    dark: {
      primary: [0, 90, 68],
      primaryForeground: [0, 60, 8],
      brandFrom: [0, 76, 46],
      brandTo: [18, 90, 40],
    },
  },
  ocean: {
    neutral: { h: 214, s: 22 },
    light: {
      primary: [212, 88, 41],
      primaryForeground: WHITE,
      brandFrom: [212, 88, 42],
      brandTo: [195, 92, 31],
    },
    dark: {
      primary: [208, 92, 70],
      primaryForeground: [214, 60, 9],
      brandFrom: [212, 88, 42],
      brandTo: [195, 92, 31],
    },
  },
  emerald: {
    neutral: { h: 165, s: 10 },
    light: {
      primary: [166, 84, 25],
      primaryForeground: WHITE,
      brandFrom: [162, 84, 25],
      brandTo: [184, 80, 27],
    },
    dark: {
      primary: [160, 70, 52],
      primaryForeground: [165, 60, 7],
      brandFrom: [162, 84, 25],
      brandTo: [184, 80, 27],
    },
  },
  slate: {
    neutral: { h: 215, s: 16 },
    light: {
      primary: [222, 47, 14],
      primaryForeground: [210, 40, 98],
      brandFrom: [215, 25, 27],
      brandTo: [215, 22, 42],
    },
    dark: {
      primary: [210, 40, 94],
      primaryForeground: [222, 47, 11],
      brandFrom: [215, 25, 27],
      brandTo: [215, 22, 42],
    },
  },
};

/** Status colors are shared by all palettes so their meaning never changes. */
const STATUS: Record<
  ResolvedMode,
  Pick<
    ThemeTokens,
    | "destructive"
    | "destructive-foreground"
    | "success"
    | "success-foreground"
    | "warning"
    | "warning-foreground"
    | "info"
    | "info-foreground"
    | "recording"
    | "recording-foreground"
  >
> = {
  light: {
    destructive: [0, 72, 44],
    "destructive-foreground": WHITE,
    success: [142, 76, 26],
    "success-foreground": WHITE,
    warning: [28, 92, 34],
    "warning-foreground": WHITE,
    info: [206, 90, 36],
    "info-foreground": WHITE,
    recording: [0, 80, 42],
    "recording-foreground": WHITE,
  },
  dark: {
    destructive: [0, 88, 70],
    "destructive-foreground": [0, 60, 8],
    success: [142, 64, 55],
    "success-foreground": [142, 70, 7],
    warning: [38, 92, 58],
    "warning-foreground": [30, 80, 8],
    info: [204, 92, 68],
    "info-foreground": [210, 70, 8],
    // REC indicator: saturated red that still reads as "live" on dark surfaces
    recording: [0, 90, 64],
    "recording-foreground": [0, 60, 7],
  },
};

const buildTokens = (spec: PaletteSpec, mode: ResolvedMode): ThemeTokens => {
  const { h, s } = spec.neutral;
  const m = spec[mode];
  const [ph, ps] = m.primary;

  if (mode === "light") {
    return {
      background: [h, s, 98],
      foreground: [h, Math.min(s * 2, 40), 9],
      card: [h, s, 100],
      "card-foreground": [h, Math.min(s * 2, 40), 9],
      popover: [h, s, 100],
      "popover-foreground": [h, Math.min(s * 2, 40), 9],
      primary: m.primary,
      "primary-foreground": m.primaryForeground,
      secondary: [h, s, 93],
      "secondary-foreground": [h, Math.min(s * 2, 40), 12],
      muted: [h, s, 94],
      "muted-foreground": [h, s, 38],
      accent: [ph, Math.min(ps, 60), 94],
      "accent-foreground": [ph, Math.min(ps, 55), 24],
      ...STATUS.light,
      border: [h, s, 87],
      input: [h, s, 80],
      ring: m.primary,
      "brand-from": m.brandFrom,
      "brand-to": m.brandTo,
      "brand-foreground": m.brandForeground ?? WHITE,
    };
  }

  return {
    background: [h, s, 6],
    foreground: [h, s, 96],
    card: [h, s, 9],
    "card-foreground": [h, s, 96],
    popover: [h, s, 10],
    "popover-foreground": [h, s, 96],
    primary: m.primary,
    "primary-foreground": m.primaryForeground,
    secondary: [h, s, 16],
    "secondary-foreground": [h, s, 96],
    muted: [h, s, 15],
    "muted-foreground": [h, s, 66],
    accent: [ph, Math.min(ps, 30), 18],
    "accent-foreground": [ph, Math.min(ps, 80), 90],
    ...STATUS.dark,
    border: [h, s, 19],
    input: [h, s, 25],
    ring: m.primary,
    "brand-from": m.brandFrom,
    "brand-to": m.brandTo,
    "brand-foreground": m.brandForeground ?? WHITE,
  };
};

export const THEMES: Record<
  PaletteId,
  Record<ResolvedMode, ThemeTokens>
> = Object.fromEntries(
  PALETTE_IDS.map((id) => [
    id,
    {
      light: buildTokens(PALETTE_SPECS[id], "light"),
      dark: buildTokens(PALETTE_SPECS[id], "dark"),
    },
  ]),
) as Record<PaletteId, Record<ResolvedMode, ThemeTokens>>;

export const hslTriplet = ([h, s, l]: Hsl) => `${h} ${s}% ${l}%`;
export const hslColor = (value: Hsl) => `hsl(${hslTriplet(value)})`;

const renderBlock = (selector: string, tokens: ThemeTokens, mode: string) =>
  [
    `${selector} {`,
    `  color-scheme: ${mode};`,
    ...TOKEN_NAMES.map((name) => `  --${name}: ${hslTriplet(tokens[name])};`),
    "}",
  ].join("\n");

/**
 * CSS for all palettes × modes. Selection rules:
 * - `:root` / `.light`              → default palette, light
 * - `.dark`                         → default palette, dark
 * - `[data-palette=x]`              → palette x, light
 * - `.dark[data-palette=x]`         → palette x, dark (same element!)
 * A scoped preview (see `ThemeScope`) must put the mode class and the
 * `data-palette` attribute on the same element.
 */
export const renderThemeCss = (): string => {
  const blocks = [
    renderBlock(":root,\n.light", THEMES[DEFAULT_PALETTE].light, "light"),
    renderBlock(".dark", THEMES[DEFAULT_PALETTE].dark, "dark"),
  ];
  for (const id of PALETTE_IDS) {
    blocks.push(
      renderBlock(`[data-palette="${id}"]`, THEMES[id].light, "light"),
      renderBlock(`.dark[data-palette="${id}"]`, THEMES[id].dark, "dark"),
    );
  }
  return blocks.join("\n\n");
};

export const THEME_CSS_START =
  "/* @generated theme:start (bun scripts/generate-theme-css.ts) */";
export const THEME_CSS_END = "/* @generated theme:end */";
