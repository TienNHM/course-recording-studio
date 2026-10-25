import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Locale } from "../i18n/config";
import {
  DEFAULT_PREFERENCES,
  applyThemeToDocument,
  getSystemMode,
  readPreferences,
  subscribeToSystemMode,
  writePreferences,
  type AppliedTheme,
  type ColorMode,
  type Preferences,
} from "./preferences";
import type { PaletteId, ResolvedMode } from "./tokens";

export type PreferencesContextValue = Preferences & {
  /** `mode` with "system" resolved to what the OS currently prefers. */
  readonly resolvedMode: ResolvedMode;
  readonly setMode: (mode: ColorMode) => void;
  readonly setPalette: (palette: PaletteId) => void;
  readonly setLocale: (locale: Locale) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const useSystemMode = () =>
  useSyncExternalStore<ResolvedMode>(
    subscribeToSystemMode,
    getSystemMode,
    () => "dark",
  );

/**
 * Owns mode / palette / locale, persists them to localStorage and applies them
 * to <html> (class, data-palette, lang). Mounted once in main.tsx.
 */
export const PreferencesProvider: React.FC<{
  readonly children: React.ReactNode;
}> = ({ children }) => {
  const [prefs, setPrefs] = useState<Preferences>(readPreferences);
  const systemMode = useSystemMode();
  const resolvedMode: ResolvedMode =
    prefs.mode === "system" ? systemMode : prefs.mode;

  useEffect(() => {
    applyThemeToDocument(document, {
      resolvedMode,
      palette: prefs.palette,
      locale: prefs.locale,
    });
  }, [resolvedMode, prefs.palette, prefs.locale]);

  // Keep several tabs in sync
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("crs:")) {
        setPrefs(readPreferences());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePreferences(next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...prefs,
      resolvedMode,
      setMode: (mode) => update({ mode }),
      setPalette: (palette) => update({ palette }),
      setLocale: (locale) => update({ locale }),
    }),
    [prefs, resolvedMode, update],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

const noop = () => undefined;
const FALLBACK: PreferencesContextValue = {
  ...DEFAULT_PREFERENCES,
  resolvedMode: "dark",
  setMode: noop,
  setPalette: noop,
  setLocale: noop,
};

/**
 * `{ mode, resolvedMode, palette, locale, setMode, setPalette, setLocale }`.
 * Outside <PreferencesProvider> (isolated renders, tests) it returns read-only
 * defaults instead of throwing, so primitives stay usable anywhere.
 */
export const usePreferences = (): PreferencesContextValue =>
  useContext(PreferencesContext) ?? FALLBACK;

/** The theme currently applied, for passing to `applyThemeToDocument`. */
export const useAppliedTheme = (): AppliedTheme => {
  const { resolvedMode, palette, locale } = usePreferences();
  return useMemo(
    () => ({ resolvedMode, palette, locale }),
    [resolvedMode, palette, locale],
  );
};

/**
 * Keeps another document (e.g. the Document Picture-in-Picture window) in the
 * same mode / palette / language as the app. Pass `null` when there is none.
 *
 *   const { pipWindow } = useDocumentPip();
 *   useThemeMirror(pipWindow?.document ?? null);
 */
export const useThemeMirror = (doc: Document | null | undefined) => {
  const theme = useAppliedTheme();
  useEffect(() => {
    if (doc) {
      applyThemeToDocument(doc, theme);
    }
  }, [doc, theme]);
};
