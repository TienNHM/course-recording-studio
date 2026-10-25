/**
 * Framework-free helpers for UI preferences (color mode, palette, locale).
 * React code should use `usePreferences()` from `./PreferencesProvider`.
 *
 * NOTE: index.html contains an inline copy of `readPreferences` +
 * `applyThemeToDocument` that runs before first paint. Keep the storage key,
 * defaults and palette ids in sync with it (tests/theme-tokens.test.ts checks).
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n/config";
import {
  DEFAULT_PALETTE,
  PALETTE_IDS,
  type PaletteId,
  type ResolvedMode,
} from "./tokens";

export const COLOR_MODES = ["light", "dark", "system"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export type Preferences = {
  readonly mode: ColorMode;
  readonly palette: PaletteId;
  readonly locale: Locale;
};

export const PREFERENCES_STORAGE_KEY = "crs:preferences";

export const DEFAULT_PREFERENCES: Preferences = {
  mode: "system",
  palette: DEFAULT_PALETTE,
  locale: DEFAULT_LOCALE,
};

export const isColorMode = (value: unknown): value is ColorMode =>
  COLOR_MODES.includes(value as ColorMode);

export const isPaletteId = (value: unknown): value is PaletteId =>
  PALETTE_IDS.includes(value as PaletteId);

/** Validates untrusted (stored) data field by field, falling back to defaults. */
export const parsePreferences = (raw: unknown): Preferences => {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    mode: isColorMode(value.mode) ? value.mode : DEFAULT_PREFERENCES.mode,
    palette: isPaletteId(value.palette)
      ? value.palette
      : DEFAULT_PREFERENCES.palette,
    locale: isLocale(value.locale) ? value.locale : DEFAULT_PREFERENCES.locale,
  };
};

export const readPreferences = (): Preferences => {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return parsePreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export const writePreferences = (prefs: Preferences) => {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked (private mode, quota): preferences last for this session
  }
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

export const getSystemMode = (): ResolvedMode => {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "dark";
  }
};

export const resolveMode = (mode: ColorMode): ResolvedMode =>
  mode === "system" ? getSystemMode() : mode;

export const subscribeToSystemMode = (onChange: () => void) => {
  try {
    const query = window.matchMedia(DARK_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  } catch {
    return () => undefined;
  }
};

export type AppliedTheme = {
  readonly resolvedMode: ResolvedMode;
  readonly palette: PaletteId;
  readonly locale: Locale;
};

/**
 * Applies the theme to a document's <html>: `light`/`dark` class,
 * `data-palette`, `lang` and `color-scheme`.
 *
 * Call it for secondary documents that should look like the app, e.g. the
 * Document Picture-in-Picture window: `applyThemeToDocument(pipWindow.document)`.
 * Without `theme`, it copies what is currently applied to the main document.
 * To keep a secondary document in sync, use `useThemeMirror(doc)`.
 */
export const applyThemeToDocument = (
  doc: Document,
  theme: AppliedTheme = readAppliedTheme(document),
) => {
  const root = doc.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme.resolvedMode);
  root.setAttribute("data-palette", theme.palette);
  root.lang = theme.locale;
  root.style.colorScheme = theme.resolvedMode;
};

/** Reads the theme currently applied to a document's <html>. */
export const readAppliedTheme = (doc: Document): AppliedTheme => {
  const root = doc.documentElement;
  const palette = root.getAttribute("data-palette");
  return {
    resolvedMode: root.classList.contains("dark") ? "dark" : "light",
    palette: isPaletteId(palette) ? palette : DEFAULT_PALETTE,
    locale: isLocale(root.lang) ? root.lang : DEFAULT_LOCALE,
  };
};
