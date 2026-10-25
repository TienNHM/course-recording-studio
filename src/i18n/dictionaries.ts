import type { Locale } from "./config";
import enCommon from "./locales/en/common";
import enLibrary from "./locales/en/library";
import enRecording from "./locales/en/recording";
import enReview from "./locales/en/review";
import enSettings from "./locales/en/settings";
import viCommon from "./locales/vi/common";
import viLibrary from "./locales/vi/library";
import viRecording from "./locales/vi/recording";
import viReview from "./locales/vi/review";
import viSettings from "./locales/vi/settings";
import type { MessageTree } from "./types";

const vi = {
  common: viCommon,
  library: viLibrary,
  recording: viRecording,
  review: viReview,
  settings: viSettings,
};

export type Namespace = keyof typeof vi;
export type NamespaceMessages<N extends Namespace> = (typeof vi)[N];

const en: { [N in Namespace]: unknown } = {
  common: enCommon,
  library: enLibrary,
  recording: enRecording,
  review: enReview,
  settings: enSettings,
};

export const DICTIONARIES = { vi, en } as unknown as Record<
  Locale,
  Record<Namespace, MessageTree>
>;
