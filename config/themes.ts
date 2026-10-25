import { z } from "zod";
import type { VideoPalette } from "./course";

export const theme = z.enum(["light", "dark"]);
export type Theme = z.infer<typeof theme>;

type ColorTheme = {
  BACKGROUND: string;
  CAPTIONS_BACKGROUND: string;
  BORDER_COLOR: string;
  WORD_COLOR_ON_BG_APPEARED: string;
  WORD_COLOR_ON_BG_GREYED: string;
  WORD_HIGHLIGHT_COLOR: string;
  ACCENT_COLOR: string;
  CTA_BUTTON_COLOR: string;
  CTA_BUTTON_BACKGROUND_COLOR: string;
  ENDCARD_TEXT_COLOR: string;
};

export const COLORS: { [key in Theme]: ColorTheme } = {
  light: {
    BACKGROUND: "#FAFAFA",
    CAPTIONS_BACKGROUND: "#fff",
    BORDER_COLOR: "#EBEBEB",
    WORD_COLOR_ON_BG_APPEARED: "black",
    WORD_COLOR_ON_BG_GREYED: "rgba(0, 0, 0, 0.3)",
    WORD_HIGHLIGHT_COLOR: "#3B82EB",
    ACCENT_COLOR: "#3B82EB",
    CTA_BUTTON_COLOR: "white",
    CTA_BUTTON_BACKGROUND_COLOR: "black",
    ENDCARD_TEXT_COLOR: "black",
  },
  dark: {
    BACKGROUND: "#000000",
    CAPTIONS_BACKGROUND: "#0A0A0A",
    BORDER_COLOR: "#1F1F1F",
    WORD_COLOR_ON_BG_APPEARED: "white",
    WORD_COLOR_ON_BG_GREYED: "rgba(255, 255, 255, 0.3)",
    WORD_HIGHLIGHT_COLOR: "#3B82EB",
    ACCENT_COLOR: "#3B82EB",
    CTA_BUTTON_COLOR: "black",
    CTA_BUTTON_BACKGROUND_COLOR: "white",
    ENDCARD_TEXT_COLOR: "white",
  },
};

// Theme used by the "lesson" composition (Course Recording Studio).
export const LESSON_THEME: Theme = "dark";

// --- Video palettes (course.videoStyle.palette) ---
// Mirrors the app's UI palettes (src/theme/tokens.ts): brandFrom → brandTo is
// the brand gradient, `accent` is the bright variant used on dark surfaces.
// The rendered lesson always uses a dark look, so only dark values are needed.
export type VideoPaletteColors = {
  // Brand gradient
  brandFrom: string;
  brandTo: string;
  // Bright accent for text, bars and highlights on dark backgrounds
  accent: string;
  // Deep, palette-tinted background of title cards
  background: string;
  // Translucent panel behind overlays (chapter card, lower third)
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  // Hue rotation for the light-leak overlay. The default leak is
  // yellow/orange (~40°) and the shift rotates backwards: hue ≈ 40° − shift.
  lightLeakHueShift: number;
};

const hsl = (h: number, s: number, l: number, a: number) =>
  `hsl(${h} ${s}% ${l}% / ${a})`;

export const VIDEO_PALETTES: Record<VideoPalette, VideoPaletteColors> = {
  // dotnet-course.tiennhm.io.vn: purple #7C5CE0 → blue
  dotnet: {
    brandFrom: "#7C5CE0",
    brandTo: "#1659E9",
    accent: "#A48BF9",
    background: "#0E0C18",
    surface: hsl(250, 30, 9, 0.78),
    border: hsl(254, 70, 75, 0.28),
    text: "#FFFFFF",
    mutedText: "#BFBCD2",
    lightLeakHueShift: 145,
  },
  // Remotion Recorder red
  recorder: {
    brandFrom: "#CE1C1C",
    brandTo: "#C2410A",
    accent: "#F76464",
    background: "#0E0E10",
    surface: hsl(240, 8, 8, 0.8),
    border: hsl(0, 80, 70, 0.3),
    text: "#FFFFFF",
    mutedText: "#BCBCC2",
    lightLeakHueShift: 35,
  },
  ocean: {
    brandFrom: "#0D65C9",
    brandTo: "#067398",
    accent: "#6CB7F9",
    background: "#0B1119",
    surface: hsl(214, 35, 9, 0.8),
    border: hsl(208, 90, 70, 0.3),
    text: "#FFFFFF",
    mutedText: "#BCC5D2",
    lightLeakHueShift: 190,
  },
  emerald: {
    brandFrom: "#0A7555",
    brandTo: "#0E757C",
    accent: "#2FDAA1",
    background: "#09110F",
    surface: hsl(165, 25, 8, 0.8),
    border: hsl(160, 70, 55, 0.3),
    text: "#FFFFFF",
    mutedText: "#BAC9C5",
    lightLeakHueShift: 235,
  },
  slate: {
    brandFrom: "#344256",
    brandTo: "#546783",
    accent: "#CDDBEA",
    background: "#0C1017",
    surface: hsl(222, 25, 10, 0.8),
    border: hsl(210, 30, 80, 0.25),
    text: "#FFFFFF",
    mutedText: "#ACB6C3",
    lightLeakHueShift: 185,
  },
};

// "#RRGGBB" + alpha → "rgba(r, g, b, a)" (for gradients and shadows).
export const withAlpha = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) {
    return hex;
  }
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x as string, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
