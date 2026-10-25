export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

/** BCP 47 tags passed to Intl formatters. */
export const INTL_LOCALE: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
};

/** Native names, shown as-is in the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);
