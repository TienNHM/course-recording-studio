/**
 * i18n entry point. See docs/design-system.md → "i18n".
 *
 *   const t = useT("library");
 *   t("title");
 *   t("example.withVariable", { lesson: "Bài 1" });
 *   t("count.lessons", { count: 3 }); // via useT("common")
 *
 *   const f = useFormat();
 *   f.formatDate(createdAt); f.formatBytes(size); f.formatDuration(ms);
 */
import { useCallback, useMemo } from "react";
import { usePreferences } from "../theme/PreferencesProvider";
import type { Locale } from "./config";
import type { Namespace, NamespaceMessages } from "./dictionaries";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  type DateInput,
} from "./format";
import { translate } from "./translate";
import type { MessageKey, MessageVars } from "./types";

export { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, isLocale } from "./config";
export type { Locale } from "./config";
export type { Namespace } from "./dictionaries";
export * from "./format";
export { translate } from "./translate";
export { plural } from "./types";
export type { MessageKey, MessageVars } from "./types";

export type TFunction<N extends Namespace> = (
  key: MessageKey<NamespaceMessages<N>>,
  vars?: MessageVars,
) => string;

/** Current UI locale ("vi" | "en"). */
export const useLocale = (): Locale => usePreferences().locale;

/** Typed translator for one namespace; keys are checked at compile time. */
export const useT = <N extends Namespace>(namespace: N): TFunction<N> => {
  const locale = useLocale();
  return useCallback<TFunction<N>>(
    (key, vars) => translate(locale, namespace, key, vars),
    [locale, namespace],
  );
};

/** Intl formatters bound to the current locale. */
export const useFormat = () => {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      formatPercent: (ratio: number, options?: Intl.NumberFormatOptions) =>
        formatPercent(ratio, locale, options),
      formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, options),
      formatDateTime: (value: DateInput) => formatDateTime(value, locale),
      formatRelativeTime: (value: DateInput, now?: DateInput) =>
        formatRelativeTime(value, locale, now),
      formatBytes: (bytes: number) => formatBytes(bytes, locale),
      formatDuration,
    }),
    [locale],
  );
};
