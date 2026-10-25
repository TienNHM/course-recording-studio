import type { Hsl } from "./tokens";

/** HSL (deg, %, %) → sRGB channels in 0..1. */
export const hslToRgb = ([h, s, l]: Hsl): [number, number, number] => {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};

const channel = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

export const relativeLuminance = (color: Hsl) => {
  const [r, g, b] = hslToRgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2.x contrast ratio, 1..21. */
export const contrastRatio = (a: Hsl, b: Hsl) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/** Text pairs that must reach WCAG AA (4.5:1) in every palette and mode. */
export const TEXT_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["recording-foreground", "recording"],
  // Colored text directly on the page / cards (links, status text, badges)
  ["primary", "background"],
  ["primary", "card"],
  ["destructive", "background"],
  ["success", "background"],
  ["warning", "background"],
  ["info", "background"],
  ["recording", "background"],
  // Text on the brand gradient (Button variant="brand", hero banners)
  ["brand-foreground", "brand-from"],
  ["brand-foreground", "brand-to"],
] as const;

/** Non-text UI pairs that must reach 3:1 (WCAG 1.4.11). */
export const UI_PAIRS = [["ring", "background"]] as const;
