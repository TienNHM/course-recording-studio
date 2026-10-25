import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { injectThemeCss } from "../scripts/generate-theme-css";
import {
  TEXT_PAIRS,
  UI_PAIRS,
  contrastRatio,
  hslToRgb,
} from "../src/theme/contrast";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  parsePreferences,
} from "../src/theme/preferences";
import {
  PALETTE_IDS,
  RESOLVED_MODES,
  THEMES,
  type Hsl,
} from "../src/theme/tokens";

const root = path.join(import.meta.dir, "..");
const normalize = (s: string) => s.replace(/\r\n/g, "\n");

/** Color `fg` at `alpha` over `bg`, back to HSL-free RGB contrast via Hsl. */
const blend = (fg: Hsl, bg: Hsl, alpha: number): Hsl => {
  const a = hslToRgb(fg);
  const b = hslToRgb(bg);
  const mix = a.map((c, i) => c * alpha + (b[i] ?? 0) * (1 - alpha)) as [
    number,
    number,
    number,
  ];
  // RGB → HSL
  const max = Math.max(...mix);
  const min = Math.min(...mix);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return [0, 0, l * 100];
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  const [r, g, bl] = mix;
  const h =
    max === r
      ? 60 * (((g - bl) / d) % 6)
      : max === g
        ? 60 * ((bl - r) / d + 2)
        : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s * 100, l * 100];
};

describe("contrast helpers", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio([0, 0, 0], [0, 0, 100])).toBeCloseTo(21, 5);
  });
  test("#7C5CE0 converts correctly", () => {
    const [r, g, b] = hslToRgb([254, 68, 62]);
    expect(Math.round(r * 255)).toBeCloseTo(124, -1);
    expect(Math.round(g * 255)).toBeCloseTo(92, -1);
    expect(Math.round(b * 255)).toBeCloseTo(224, -1);
  });
});

describe("WCAG AA contrast for every palette × mode", () => {
  for (const palette of PALETTE_IDS) {
    for (const mode of RESOLVED_MODES) {
      const tokens = THEMES[palette][mode];
      test(`${palette} / ${mode}: text pairs ≥ 4.5:1`, () => {
        const failures = TEXT_PAIRS.map(([fg, bg]) => ({
          pair: `${fg} on ${bg}`,
          ratio: contrastRatio(tokens[fg], tokens[bg]),
        })).filter((r) => r.ratio < 4.5);
        expect(failures).toEqual([]);
      });
      test(`${palette} / ${mode}: UI pairs ≥ 3:1`, () => {
        const failures = UI_PAIRS.map(([fg, bg]) => ({
          pair: `${fg} on ${bg}`,
          ratio: contrastRatio(tokens[fg], tokens[bg]),
        })).filter((r) => r.ratio < 3);
        expect(failures).toEqual([]);
      });
      test(`${palette} / ${mode}: soft badges (text-X on bg-X/10) ≥ 4.5:1`, () => {
        const tones = [
          "primary",
          "success",
          "warning",
          "info",
          "destructive",
          "recording",
        ] as const;
        const failures = tones
          .map((tone) => ({
            tone,
            ratio: contrastRatio(
              tokens[tone],
              blend(tokens[tone], tokens.background, 0.1),
            ),
          }))
          .filter((r) => r.ratio < 4.5);
        expect(failures).toEqual([]);
      });
    }
  }
});

describe("generated CSS", () => {
  test("src/index.css is in sync with src/theme/tokens.ts", () => {
    const css = readFileSync(path.join(root, "src", "index.css"), "utf8");
    expect(normalize(injectThemeCss(css))).toBe(normalize(css));
  });
});

describe("pre-paint script in index.html", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  test("uses the same storage key", () => {
    expect(html).toContain(`"${PREFERENCES_STORAGE_KEY}"`);
  });
  test("knows every palette id", () => {
    for (const id of PALETTE_IDS) {
      expect(html).toContain(`"${id}"`);
    }
  });
  test("uses the default palette", () => {
    expect(html).toContain(`: "${DEFAULT_PREFERENCES.palette}"`);
  });
});

describe("parsePreferences", () => {
  test("falls back to defaults for garbage", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("x")).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePreferences({ mode: "neon", palette: "pink", locale: "fr" }),
    ).toEqual(DEFAULT_PREFERENCES);
  });
  test("keeps valid fields", () => {
    expect(
      parsePreferences({ mode: "dark", palette: "ocean", locale: "en" }),
    ).toEqual({ mode: "dark", palette: "ocean", locale: "en" });
  });
  test("defaults: Vietnamese, dotnet palette, system mode", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      mode: "system",
      palette: "dotnet",
      locale: "vi",
    });
  });
});
