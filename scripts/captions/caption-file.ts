import type { Caption } from "@remotion/captions";
import type { Language, WhisperModel } from "@remotion/install-whisper-cpp";
import { toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { EOL, tmpdir } from "os";
import path from "path";
import {
  TRANSCRIPTION_LANGUAGE,
  WHISPER_MODEL,
  WHISPER_PATH,
  WHISPER_REF,
} from "../../config/whisper";
import { extractAudio } from "../server/production/ffmpeg";

// Transcribes an existing 16 kHz WAV file into @remotion/captions Caption[].
export const transcribeWav = async ({
  wavFile,
  language,
  model,
  onProgress,
  signal,
}: {
  wavFile: string;
  language: Language | null;
  model: WhisperModel;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}): Promise<Caption[]> => {
  const whisperCppOutput = await transcribe({
    inputPath: wavFile,
    model,
    tokenLevelTimestamps: true,
    whisperPath: WHISPER_PATH,
    translateToEnglish: false,
    printOutput: true,
    onProgress,
    signal,
    language,
    whisperCppVersion: WHISPER_REF,
  });

  return toCaptions({ whisperCppOutput }).captions;
};

export const captionFile = async ({
  file,
  fileToTranscribe,
  outPath,
  onProgress,
  signal,
  language = TRANSCRIPTION_LANGUAGE,
  model = WHISPER_MODEL,
}: {
  file: string;
  fileToTranscribe: string;
  outPath: string;
  onProgress: (options: {
    filename: string;
    progressInPercent: number;
  }) => void;
  signal: AbortSignal;
  language?: Language | null;
  model?: WhisperModel;
}): Promise<void> => {
  const tmpDir = path.join(tmpdir(), "remotion-recorder");

  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const wavFile = path.join(tmpDir, `${path.parse(file).name}.wav`);

  onProgress({ filename: file, progressInPercent: 0 });

  try {
    // extracting audio and save it as 16khz wav file
    await extractAudio({ input: fileToTranscribe, output: wavFile, signal });

    const captions = await transcribeWav({
      wavFile,
      language,
      model,
      onProgress: (progress) => {
        onProgress({
          filename: file,
          progressInPercent: Math.round(progress * 100),
        });
      },
      signal,
    });

    writeFileSync(outPath, JSON.stringify(captions, null, 2) + EOL);
  } finally {
    rmSync(wavFile, { force: true });
  }
};
