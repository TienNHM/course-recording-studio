/**
 * Web UI fonts: Be Vietnam Pro (UI text) and JetBrains Mono (code, timecodes).
 *
 * We take the font URLs from @remotion/google-fonts but register them as plain
 * `@font-face` rules in a <style> element instead of calling `loadFont()`:
 * - `loadFont()` wraps loading in Remotion's delayRender(), meant for renders;
 * - a stylesheet is copied into the Document Picture-in-Picture window along
 *   with the other styles, so fonts work there too;
 * - `font-display: swap` shows text immediately with the fallback font.
 *
 * Only the latin, latin-ext and vietnamese subsets are declared; the browser
 * downloads a file only when a character in its unicode-range is used.
 */
import { getInfo as getBeVietnamPro } from "@remotion/google-fonts/BeVietnamPro";
import { getInfo as getJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

const SUBSETS = ["latin", "latin-ext", "vietnamese"] as const;

type FontInfo = {
  readonly fontFamily: string;
  readonly unicodeRanges: Record<string, string | undefined>;
  readonly fonts: {
    readonly normal: Record<string, Record<string, string> | undefined>;
  };
};

const fontFaces = (info: FontInfo, weights: readonly string[]) => {
  const rules: string[] = [];
  const normal = info.fonts.normal;
  const ranges = info.unicodeRanges;
  for (const weight of weights) {
    for (const subset of SUBSETS) {
      const url = normal[weight]?.[subset];
      if (!url) {
        continue;
      }
      rules.push(
        `@font-face{font-family:"${info.fontFamily}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format("woff2");${
          ranges[subset] ? `unicode-range:${ranges[subset]};` : ""
        }}`,
      );
    }
  }
  return rules;
};

export const FONT_STYLE_ELEMENT_ID = "app-fonts";

export const fontFaceCss = () =>
  [
    ...fontFaces(getBeVietnamPro(), ["400", "500", "600", "700"]),
    ...fontFaces(getJetBrainsMono(), ["400", "500", "700"]),
  ].join("\n");

/** Idempotent: injects the @font-face rules into `doc` once. */
export const installFonts = (doc: Document = document) => {
  if (doc.getElementById(FONT_STYLE_ELEMENT_ID)) {
    return;
  }
  const style = doc.createElement("style");
  style.id = FONT_STYLE_ELEMENT_ID;
  style.textContent = fontFaceCss();
  doc.head.appendChild(style);
};
