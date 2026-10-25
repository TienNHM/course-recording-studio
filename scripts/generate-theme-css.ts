// Regenerates the theme variables in src/index.css from src/theme/tokens.ts.
// Usage: bun scripts/generate-theme-css.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  THEME_CSS_END,
  THEME_CSS_START,
  renderThemeCss,
} from "../src/theme/tokens";

const file = path.join(import.meta.dir, "..", "src", "index.css");

export const injectThemeCss = (css: string): string => {
  const start = css.indexOf(THEME_CSS_START);
  const end = css.indexOf(THEME_CSS_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Theme markers not found in ${file}`);
  }
  // Keep the file's line endings (Windows checkouts use CRLF)
  const eol = css.includes("\r\n") ? "\r\n" : "\n";
  const generated = renderThemeCss().replace(/\n/g, eol);
  return (
    css.slice(0, start + THEME_CSS_START.length) +
    eol +
    generated +
    eol +
    css.slice(end)
  );
};

if (import.meta.main) {
  const before = readFileSync(file, "utf8");
  const after = injectThemeCss(before);
  if (after === before) {
    console.log("src/index.css is up to date");
  } else {
    writeFileSync(file, after);
    console.log("Updated theme variables in src/index.css");
  }
}
