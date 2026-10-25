import type { WhisperModel } from "@remotion/install-whisper-cpp";
import {
  downloadWhisperModel,
  installWhisperCpp,
} from "@remotion/install-whisper-cpp";
import fs from "fs";
import path from "path";
import { WHISPER_MODEL, WHISPER_PATH, WHISPER_REF } from "../../config/whisper";

// Installs whisper.cpp (if needed) and downloads `model` (if needed).
// Both steps are no-ops when already done.
export const ensureWhisper = async ({
  onInstall,
  onModelProgressInPercent,
  signal,
  model = WHISPER_MODEL,
}: {
  onInstall: () => void;
  onModelProgressInPercent: (progress: number) => void;
  signal: AbortSignal;
  model?: WhisperModel;
}) => {
  const installPromise = installWhisperCpp({
    to: WHISPER_PATH,
    version: WHISPER_REF,
    printOutput: true,
    signal,
  });

  const timeout = setTimeout(() => {
    onInstall();
  }, 1000);

  try {
    await installPromise;
  } finally {
    clearTimeout(timeout);
  }

  // A download interrupted by a crash leaves a truncated model behind, which
  // downloadWhisperModel() rejects. The marker file tells us to discard it.
  const modelPath = path.join(WHISPER_PATH, `ggml-${model}.bin`);
  const marker = `${modelPath}.downloading`;
  if (fs.existsSync(marker)) {
    fs.rmSync(modelPath, { force: true });
  }
  fs.writeFileSync(marker, "");
  await downloadWhisperModel({
    model,
    folder: WHISPER_PATH,
    printOutput: true,
    onProgress: (downloadedBytes: number, totalBytes: number) => {
      onModelProgressInPercent((downloadedBytes / totalBytes) * 100);
    },
    signal,
  });
  fs.rmSync(marker, { force: true });
};
