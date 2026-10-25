// Automation routes for AI agents and scripts (MCP server, CLI):
//   GET  HEALTH            → {ok, app, version, port, publicDir}
//   POST IMPORT_RECORDING  {lessonPath, displayPath, webcamPath?, markers?, takeId?}
//        → {lesson, take, pipeline} — copies existing video files (OBS, phone, …)
//          from the local disk into recordings/<takeId>/ and selects the take.
//          With the lesson's autoProcess on (or autoProcess:true in the body),
//          post-production is queued right away (pipeline.productionJob).
//   GET  PUBLISHED_FILES   ?lessonPath= → {lessonPath, dir, files[]}
import type { Server } from "connect";
import fs from "fs";
import type { IncomingMessage } from "http";
import path from "path";
import { z } from "zod";
import { SERVER_PORT } from "../../config/server";
import type { Lesson, Marker, RecordingSession } from "../../config/course";
import {
  TAKE_FILES,
  marker,
  publishedPath,
  recordingSession,
  takePath,
} from "../../config/course";
import { HEALTH, IMPORT_RECORDING, PUBLISHED_FILES } from "./constants";
import { lessonPathParam, takeIdParam } from "./course-api";
import {
  PUBLIC_DIR,
  readLesson,
  resolvePublicPath,
  updateLesson,
  writeJsonAtomic,
} from "./course-store";
import { HttpError, getQuery, jsonHandler, readJsonBody } from "./http-json";
import {
  decodeDurationMs,
  probeMedia,
  runRemotionBinary,
} from "./production/ffmpeg";
import type { AutoProcessResult } from "./automation/pipeline";
import { maybeAutoProcess } from "./automation/pipeline";
import type { PipelineTrigger } from "./automation/decisions";
import { getActiveJob } from "./production/job-queue";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

export const IMPORTABLE_EXTENSIONS = ["mp4", "webm", "mov", "mkv"] as const;
export type ImportableExtension = (typeof IMPORTABLE_EXTENSIONS)[number];

// Extensions that the recorder / Remotion play directly; others are converted.
const NATIVE_EXTENSIONS: ImportableExtension[] = ["mp4", "webm"];

export const importRecordingRequest = z.object({
  lessonPath: lessonPathParam,
  displayPath: z.string().min(1),
  webcamPath: z.string().min(1).optional(),
  markers: z.array(marker).optional(),
  takeId: takeIdParam.optional(),
  // Overrides lesson.postProduction.autoProcess for this import.
  autoProcess: z.boolean().optional(),
});
export type ImportRecordingRequest = z.infer<typeof importRecordingRequest>;

export type SourcePlan = {
  source: string;
  extension: ImportableExtension;
  // Extension of the file inside the take folder.
  targetExtension: "mp4" | "webm";
  needsConversion: boolean;
};

// Checks the shape of a source path (absolute, supported extension) without
// touching the disk, and decides whether it has to be converted to mp4.
export const planSource = (
  source: string,
  label: string,
  isAbsolute: (p: string) => boolean = path.isAbsolute,
): SourcePlan => {
  if (!isAbsolute(source)) {
    throw new HttpError(
      400,
      `${label} must be an absolute path on this computer, got "${source}"`,
    );
  }
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!(IMPORTABLE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new HttpError(
      400,
      `${label} must be a ${IMPORTABLE_EXTENSIONS.join("/")} file, got "${
        ext ? `.${ext}` : "no extension"
      }"`,
    );
  }
  const extension = ext as ImportableExtension;
  const needsConversion = !NATIVE_EXTENSIONS.includes(extension);
  return {
    source,
    extension,
    targetExtension: needsConversion ? "mp4" : (extension as "mp4" | "webm"),
    needsConversion,
  };
};

// Codecs that can go into an mp4 container unchanged and still play in Chrome.
const COPYABLE_VIDEO = ["h264"];
const COPYABLE_AUDIO = ["aac", "mp3"];

export const canRemuxToMp4 = (codecs: {
  video: string | null;
  audio: string | null;
}) =>
  codecs.video !== null &&
  COPYABLE_VIDEO.includes(codecs.video) &&
  (codecs.audio === null || COPYABLE_AUDIO.includes(codecs.audio));

export const ffmpegConvertArgs = (
  input: string,
  output: string,
  mode: "remux" | "transcode",
): string[] => [
  "-hide_banner",
  "-nostdin",
  "-y",
  "-i",
  input,
  "-map",
  "0:v:0",
  "-map",
  "0:a:0?",
  ...(mode === "remux"
    ? ["-c", "copy"]
    : [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
      ]),
  "-movflags",
  "+faststart",
  output,
];

// Markers must lie within the take (1 s of slack for rounding).
export const checkMarkers = (
  markers: Marker[],
  durationMs: number | null,
): string | null => {
  if (durationMs === null) {
    return null;
  }
  const outside = markers.find((m) => m.timeMs > durationMs + 1000);
  return outside
    ? `Marker at ${outside.timeMs} ms is after the end of the recording (${durationMs} ms)`
    : null;
};

export const buildImportedSession = ({
  takeId,
  durationMs,
  hasWebcam,
}: {
  takeId: string;
  durationMs: number | null;
  hasWebcam: boolean;
}): RecordingSession =>
  recordingSession.parse({
    takeId,
    status: "COMPLETED",
    // The recorder's take id is the end timestamp of the take.
    startedAt: Number(takeId) - (durationMs ?? 0),
    endedAt: Number(takeId),
    durationMs,
    sources: hasWebcam ? ["display", "webcam"] : ["display"],
  });

// ---------------------------------------------------------------------------
// File system / ffmpeg

const assertIsFile = (source: string, label: string) => {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(source);
  } catch {
    throw new HttpError(400, `${label} does not exist: ${source}`);
  }
  if (!stat.isFile()) {
    throw new HttpError(400, `${label} is not a file: ${source}`);
  }
};

const probeCodecs = async (file: string) => {
  const { stdout } = await runRemotionBinary({
    tool: "ffprobe",
    args: [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name",
      "-of",
      "json",
      file,
    ],
  });
  const streams =
    (
      JSON.parse(stdout) as {
        streams?: { codec_type?: string; codec_name?: string }[];
      }
    ).streams ?? [];
  const first = (type: string) =>
    streams.find((s) => s.codec_type === type)?.codec_name ?? null;
  return { video: first("video"), audio: first("audio") };
};

// Copies or converts one source into <takeDir>/<prefix>.<ext>. Writes to a
// temporary name first so a half-written file is never picked up as media.
const importOne = async (
  plan: SourcePlan,
  takeDir: string,
  prefix: string,
): Promise<{ file: string; converted: "copy" | "remux" | "transcode" }> => {
  const file = path.join(takeDir, `${prefix}.${plan.targetExtension}`);
  const tmp = path.join(takeDir, `${prefix}.importing.${plan.targetExtension}`);
  let converted: "copy" | "remux" | "transcode" = "copy";
  try {
    if (!plan.needsConversion) {
      await fs.promises.copyFile(plan.source, tmp);
    } else {
      converted = canRemuxToMp4(await probeCodecs(plan.source))
        ? "remux"
        : "transcode";
      await runRemotionBinary({
        tool: "ffmpeg",
        args: ffmpegConvertArgs(plan.source, tmp, converted),
      });
    }
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return { file, converted };
};

const probeDurationMs = async (file: string): Promise<number | null> => {
  const { durationMs } = await probeMedia(file);
  if (durationMs !== null) {
    return durationMs;
  }
  // MediaRecorder WebM files often have no duration in their header.
  return decodeDurationMs(file);
};

export type ImportRecordingResponse = {
  lesson: Lesson;
  take: {
    takeId: string;
    dir: string;
    display: string;
    webcam: string | null;
    durationMs: number | null;
    conversions: Record<string, "copy" | "remux" | "transcode">;
    markers: number;
  };
  // Automatic post-production started after the import (autoProcess).
  pipeline: AutoProcessResult;
};

export const importRecording = async (
  req: ImportRecordingRequest,
  { trigger = "import" }: { trigger?: PipelineTrigger } = {},
): Promise<ImportRecordingResponse> => {
  readLesson(req.lessonPath);
  if (getActiveJob(req.lessonPath)) {
    throw new HttpError(
      409,
      "A job is queued or running for this lesson; wait for it or cancel it first",
    );
  }

  const display = planSource(req.displayPath, "displayPath");
  const webcam = req.webcamPath
    ? planSource(req.webcamPath, "webcamPath")
    : null;
  assertIsFile(display.source, "displayPath");
  if (webcam) {
    assertIsFile(webcam.source, "webcamPath");
  }

  const takeId = req.takeId ?? String(Date.now());
  const takeDir = resolvePublicPath(takePath(req.lessonPath, takeId));
  if (fs.existsSync(takeDir)) {
    throw new HttpError(
      409,
      `Take ${takeId} already exists; recordings are never overwritten`,
    );
  }
  fs.mkdirSync(takeDir, { recursive: true });

  try {
    const displayResult = await importOne(
      display,
      takeDir,
      TAKE_FILES.displayPrefix,
    );
    const webcamResult = webcam
      ? await importOne(webcam, takeDir, TAKE_FILES.webcamPrefix)
      : null;

    const durationMs = await probeDurationMs(displayResult.file);
    const markers = req.markers ?? [];
    const problem = checkMarkers(markers, durationMs);
    if (problem) {
      throw new HttpError(400, problem);
    }

    writeJsonAtomic(path.join(takeDir, TAKE_FILES.markers), markers);
    writeJsonAtomic(
      path.join(takeDir, TAKE_FILES.session),
      buildImportedSession({ takeId, durationMs, hasWebcam: webcam !== null }),
    );

    const lesson = updateLesson(req.lessonPath, (l) => ({
      ...l,
      selectedTake: takeId,
      status: "RECORDED",
      recordingProfile: { ...l.recordingProfile, webcam: webcam !== null },
    }));

    const pipeline = maybeAutoProcess({
      lessonPath: req.lessonPath,
      trigger,
      override: req.autoProcess,
    });

    return {
      lesson: pipeline.productionJob
        ? { ...lesson, status: "PROCESSING" }
        : lesson,
      pipeline,
      take: {
        takeId,
        dir: takeDir,
        display: displayResult.file,
        webcam: webcamResult?.file ?? null,
        durationMs,
        conversions: {
          display: displayResult.converted,
          ...(webcamResult ? { webcam: webcamResult.converted } : {}),
        },
        markers: markers.length,
      },
    };
  } catch (e) {
    // Only the folder this request created is removed; the source files are
    // never touched.
    fs.rmSync(takeDir, { recursive: true, force: true });
    throw e;
  }
};

// ---------------------------------------------------------------------------
// Published files

export type PublishedFile = {
  name: string;
  path: string;
  // URL path on the app server (prefix with the server's base URL).
  urlPath: string;
  sizeBytes: number;
  modifiedAt: string;
};

export const publishedUrlPath = (relative: string) =>
  `/${relative.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;

const listPublished = (lessonPath: string) => {
  readLesson(lessonPath);
  const relativeDir = publishedPath(lessonPath);
  const dir = resolvePublicPath(relativeDir);
  const files: PublishedFile[] = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const file = path.join(dir, e.name);
          const stat = fs.statSync(file);
          return {
            name: e.name,
            path: file,
            urlPath: publishedUrlPath(`${relativeDir}/${e.name}`),
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        })
    : [];
  return { lessonPath, dir, files };
};

// ---------------------------------------------------------------------------
// Routes

const readVersion = () => {
  try {
    return (
      JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"),
      ) as { version?: string }
    ).version;
  } catch {
    return undefined;
  }
};

const handleHealth = jsonHandler({
  GET: () => ({
    ok: true,
    app: "course-recording-studio",
    version: readVersion() ?? "unknown",
    port: Number(process.env.PORT || SERVER_PORT),
    publicDir: PUBLIC_DIR,
  }),
});

const handleImportRecording = jsonHandler({
  POST: async (req: IncomingMessage) => {
    // Converting a long .mov/.mkv can take minutes; keep the socket open.
    req.socket.setTimeout(0);
    return importRecording(
      importRecordingRequest.parse(await readJsonBody(req)),
    );
  },
});

const handlePublishedFiles = jsonHandler({
  GET: (req: IncomingMessage) =>
    listPublished(lessonPathParam.parse(getQuery(req).get("lessonPath"))),
});

// Must be registered before the LESSON_API prefix route.
export const registerAutomationRoutes = (app: Server) => {
  app.use(HEALTH, handleHealth);
  app.use(IMPORT_RECORDING, handleImportRecording);
  app.use(PUBLISHED_FILES, handlePublishedFiles);
};
