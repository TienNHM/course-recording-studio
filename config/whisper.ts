import type { Language, WhisperModel } from "@remotion/install-whisper-cpp";
import path from "path";
import type { CourseLanguage } from "./course";

export const WHISPER_PATH = path.join(process.cwd(), "whisper.cpp");

// Model used by the legacy (template) transcribe endpoint.
export const WHISPER_MODEL: WhisperModel = "medium.en";

// English-only models are more accurate for English;
// any other language needs a multilingual model.
export const getWhisperModel = (
  language: CourseLanguage | null,
): WhisperModel => {
  return language === "en" ? "medium.en" : "medium";
};

// The git reference, can be a commit, branch or tag
// On Windows, using the latest version which has a binary
// on all other platforms we compile
export const WHISPER_REF = process.platform === "win32" ? "1.6.0" : "1.7.2";

// Language for the legacy (template) transcribe endpoint. null = auto-detect.
// Course lessons use the language from course.json instead.
export const TRANSCRIPTION_LANGUAGE: Language | null = null;
