// The automatic post-production pipeline for one lesson:
//   ANALYZING    → production/silence.json (+ analysis.json)
//   TRANSCRIBING → recordings/<take>/captions.json (whisper + glossary)
//   EDITING      → production/edit-plan.json
import type { Caption } from "@remotion/captions";
import fs from "fs";
import { EOL, tmpdir } from "os";
import path from "path";
import { autocorrectWords, applyGlossary } from "../../../config/autocorrect";
import type { SilenceRange } from "../../../config/course";
import { editPlan } from "../../../config/course";
import { getWhisperModel } from "../../../config/whisper";
import { transcribeWav } from "../../captions/caption-file";
import { ensureWhisper } from "../../captions/install-whisper";
import { readLesson, writeJsonAtomic } from "../course-store";
import { buildEditPlan } from "./edit-plan";
import {
  decodeDurationMs,
  detectSilence,
  extractAudio,
  probeMedia,
} from "./ffmpeg";
import type { JobContext } from "./job-queue";
import {
  SILENCE_NOISE_DB,
  getDetectionMinMs,
  parseSilenceDetect,
} from "./silence";
import type { Analysis, TakeFiles } from "./take-files";
import {
  getTakeFiles,
  productionFiles,
  readCaptions,
  readCourseSafe,
  readMarkers,
  readModuleSafe,
  readSession,
} from "./take-files";

const PROGRESS = {
  analyzing: [0, 0.15],
  transcribing: [0.15, 0.9],
  editing: [0.9, 1],
} as const;

const within = (range: readonly [number, number], p: number) =>
  range[0] + (range[1] - range[0]) * p;

const getDurationMs = async (
  take: TakeFiles,
  signal: AbortSignal,
): Promise<number> => {
  const media = take.display ?? take.webcam;
  if (media) {
    const probe = await probeMedia(media, signal);
    if (probe.durationMs) {
      return probe.durationMs;
    }
    // MediaRecorder WebM files usually lack a duration header.
    const decoded = await decodeDurationMs(media, signal);
    if (decoded) {
      return decoded;
    }
  }
  const session = readSession(take);
  if (session?.durationMs) {
    return session.durationMs;
  }
  throw new Error("Could not determine the duration of the recording");
};

// Display audio (mic recorded together with the screen) is preferred;
// otherwise the webcam file's audio.
const pickAudioSource = async (
  take: TakeFiles,
  signal: AbortSignal,
): Promise<"display" | "webcam" | null> => {
  if (take.display && (await probeMedia(take.display, signal)).hasAudio) {
    return "display";
  }
  if (take.webcam && (await probeMedia(take.webcam, signal)).hasAudio) {
    return "webcam";
  }
  return null;
};

export const runProduction = async ({
  lessonPath,
  retranscribe,
  ctx,
}: {
  lessonPath: string;
  retranscribe: boolean;
  ctx: JobContext;
}) => {
  const { signal } = ctx;
  const lesson = readLesson(lessonPath);
  if (!lesson.selectedTake) {
    throw new Error("The lesson has no selected take");
  }
  const take = getTakeFiles(lessonPath, lesson.selectedTake);
  if (!take.display && !take.webcam) {
    throw new Error(`No recording found in ${take.dir}`);
  }
  const course = readCourseSafe(lesson);
  const courseModule = readModuleSafe(lesson);
  const files = productionFiles(lessonPath);
  const settings = lesson.postProduction;

  const tmp = fs.mkdtempSync(path.join(tmpdir(), "course-studio-"));
  try {
    // --- ANALYZING -------------------------------------------------------
    ctx.update({
      status: "ANALYZING",
      step: "Reading the recording",
      progress: within(PROGRESS.analyzing, 0),
    });
    const durationMs = await getDurationMs(take, signal);
    const audioSource = await pickAudioSource(take, signal);
    const audioFile =
      audioSource === "display"
        ? take.display
        : audioSource === "webcam"
          ? take.webcam
          : null;

    let wavFile: string | null = null;
    if (audioFile) {
      ctx.update({
        step: "Extracting audio",
        progress: within(PROGRESS.analyzing, 0.2),
      });
      wavFile = path.join(tmp, "audio.wav");
      await extractAudio({ input: audioFile, output: wavFile, signal });
    }

    let silences: SilenceRange[] = [];
    if (wavFile && settings.autoDetectSilence) {
      ctx.update({
        step: "Detecting silence",
        progress: within(PROGRESS.analyzing, 0.5),
      });
      const stderr = await detectSilence({
        input: wavFile,
        noiseDb: SILENCE_NOISE_DB,
        minDurationMs: getDetectionMinMs(settings.silencePreset),
        signal,
      });
      silences = parseSilenceDetect(stderr, durationMs);
    }
    writeJsonAtomic(files.silence, silences);
    const analysis: Analysis = {
      takeId: take.takeId,
      durationMs,
      audioSource,
      display: take.display ? path.basename(take.display) : null,
      webcam: take.webcam ? path.basename(take.webcam) : null,
      analyzedAt: new Date().toISOString(),
    };
    writeJsonAtomic(files.analysis, analysis);

    // --- TRANSCRIBING ----------------------------------------------------
    let captions: Caption[] | null = readCaptions(take);
    if (wavFile && settings.autoTranscribe && (!captions || retranscribe)) {
      const language = course?.language ?? "vi";
      const model = getWhisperModel(language);
      ctx.update({
        status: "TRANSCRIBING",
        step: "Preparing Whisper",
        progress: within(PROGRESS.transcribing, 0),
      });
      await ensureWhisper({
        model,
        signal,
        onInstall: () => ctx.update({ step: "Installing Whisper" }),
        onModelProgressInPercent: (p) =>
          ctx.update({
            step: `Downloading Whisper model ${model} (${Math.round(p)}%)`,
          }),
      });
      ctx.update({ step: `Transcribing (${language}, ${model})` });
      let lastReported = -1;
      captions = await transcribeWav({
        wavFile,
        language,
        model,
        signal,
        onProgress: (p) => {
          // Avoid rewriting job.json for every whisper progress tick.
          if (p - lastReported < 0.01 && p < 1) {
            return;
          }
          lastReported = p;
          ctx.update({ progress: within(PROGRESS.transcribing, p) });
        },
      });
    }
    if (captions) {
      // Glossary fixes are idempotent, so they are applied again on re-runs
      // (picks up glossary changes without re-transcribing).
      captions = autocorrectWords(
        applyGlossary(captions, course?.glossary ?? []),
      );
      writeJsonAtomic(take.captions, captions);
      // writeJsonAtomic omits the trailing newline the template uses.
      fs.appendFileSync(take.captions, EOL);
    }

    // --- EDITING ---------------------------------------------------------
    ctx.update({
      status: "EDITING",
      step: "Building the edit plan",
      progress: within(PROGRESS.editing, 0),
    });
    const plan = buildEditPlan({
      takeId: take.takeId,
      durationMs,
      silences,
      markers: readMarkers(take),
      captions,
      preset: settings.silencePreset,
      autoRemoveSilence: settings.autoRemoveSilence,
      lessonTitle: lesson.title,
      moduleTitle: courseModule?.title ?? null,
      courseName: course?.name ?? null,
      hasWebcam: take.webcam !== null,
      generateChapters: settings.generateChapters,
      intro: settings.intro,
      outro: settings.outro,
    });
    writeJsonAtomic(files.editPlan, editPlan.parse(plan));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};
