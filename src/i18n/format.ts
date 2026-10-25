/**
 * Locale-aware formatters (pure functions). In components use `useFormat()`,
 * which binds them to the current locale.
 */
import { INTL_LOCALE, type Locale } from "./config";

export type DateInput = Date | string | number;

const toDate = (value: DateInput) =>
  value instanceof Date ? value : new Date(value);

export const formatNumber = (
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) => new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);

/** 0.42 → "42%" */
export const formatPercent = (
  ratio: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) =>
  formatNumber(ratio, locale, {
    style: "percent",
    maximumFractionDigits: 0,
    ...options,
  });

/** Defaults to a medium date: "25 thg 10, 2026" / "Oct 25, 2026". */
export const formatDate = (
  value: DateInput,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(toDate(value));

export const formatDateTime = (value: DateInput, locale: Locale) =>
  formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** "3 ngày trước" / "3 days ago", "trong 5 phút" / "in 5 minutes". */
export const formatRelativeTime = (
  value: DateInput,
  locale: Locale,
  now: DateInput = Date.now(),
) => {
  const seconds = (toDate(value).getTime() - toDate(now).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], {
    numeric: "auto",
  });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return rtf.format(0, "second");
};

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Binary multiples (1 KB = 1024 B): 1536 → "1,5 KB" (vi) / "1.5 KB" (en). */
export const formatBytes = (bytes: number, locale: Locale) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return `${formatNumber(0, locale)} B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : value < 10 ? 1 : 0;
  return `${formatNumber(value, locale, { maximumFractionDigits: digits })} ${
    BYTE_UNITS[exponent]
  }`;
};

/**
 * Timecode-style duration: "mm:ss" below one hour, "h:mm:ss" above.
 * 65_000 → "01:05", 3_725_000 → "1:02:05". Not localized (digits only);
 * render it with the `timecode` class.
 */
export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};
