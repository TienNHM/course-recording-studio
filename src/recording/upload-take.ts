import type { Marker, RecordingSession } from "../../config/course";
import { TAKE_FILES } from "../../config/course";
import { DISPLAY_PREFIX, WEBCAM_PREFIX } from "../../config/cameras";
import type { ProcessStatus } from "../components/ProcessingStatus";
import { convertInBrowser } from "../helpers/convert-in-browser";
import { getExtension } from "../helpers/find-good-supported-codec";
import {
  selectTakeOnServer,
  uploadFileToServer,
  uploadTakeFile,
} from "../helpers/upload-file";

export type TakeSource = {
  prefix: string;
  mimeType: string;
  getData: () => Promise<Blob>;
};

type LessonSource = RecordingSession["sources"][number];

const isLessonSource = (prefix: string): prefix is LessonSource =>
  prefix === WEBCAM_PREFIX || prefix === DISPLAY_PREFIX;

export class TakeUploadAbortedError extends Error {
  constructor() {
    super("Upload aborted by user");
    this.name = "TakeUploadAbortedError";
  }
}

// Converts and uploads every source of a take into the lesson, writes
// markers.json and session.json and selects the take (lesson -> RECORDED).
// Transcription is not started here: post-production does it later.
export const uploadTakeToLesson = async ({
  lessonPath,
  takeId,
  sources,
  expectedFrames,
  markers,
  startedAt,
  endedAt,
  durationMs,
  recovering,
  setStatus,
}: {
  lessonPath: string;
  takeId: string;
  sources: TakeSource[];
  expectedFrames: number;
  markers: Marker[];
  startedAt: number;
  endedAt: number;
  durationMs: number;
  recovering: boolean;
  setStatus: (status: ProcessStatus | null) => void;
}) => {
  const lessonSources = sources.filter((s) => {
    if (isLessonSource(s.prefix)) {
      return true;
    }

    console.warn(`Skipping ${s.prefix}: lessons only store webcam and display`);
    return false;
  });

  if (lessonSources.length === 0) {
    throw new Error("This take has no webcam or display recording");
  }

  const sessionBase: Omit<RecordingSession, "status"> = {
    takeId,
    startedAt,
    endedAt,
    durationMs,
    sources: lessonSources.map((s) => s.prefix as LessonSource),
  };

  if (recovering) {
    // Tell the server a partial take exists, in case the upload fails midway.
    await uploadTakeFile({
      lessonPath,
      takeId,
      name: TAKE_FILES.session,
      data: { ...sessionBase, status: "RECOVERABLE" },
    });
  }

  for (const source of lessonSources) {
    const label = `${source.prefix}.${getExtension(source.mimeType)}`;
    let aborted = false;
    setStatus({
      title: `Converting ${label}`,
      description: "Starting...",
      abort: null,
    });

    const original = await source.getData();
    let toUpload: Blob;
    try {
      toUpload = await convertInBrowser({
        src: original,
        mimeType: source.mimeType,
        onProgress: (progress, abortFn) => {
          setStatus({
            title: `Converting ${label}`,
            description: `${Math.round(progress * 100)}% progress`,
            abort: () => {
              aborted = true;
              abortFn();
            },
          });
        },
      });
    } catch (err) {
      if (aborted || (err as Error).message.includes("aborted by user")) {
        throw new TakeUploadAbortedError();
      }

      // The raw MediaRecorder file is still usable by ffmpeg later on.
      console.warn(`Converting ${label} failed, uploading original`, err);
      toUpload = original;
    }

    setStatus({
      title: `Copying ${label} to public/${lessonPath}`,
      description: "Copying in progress",
      abort: null,
    });
    await uploadFileToServer({
      blob: toUpload,
      takeId,
      prefix: source.prefix,
      lessonPath,
      expectedFrames,
      mimeType: source.mimeType,
    });
  }

  setStatus({
    title: "Saving take",
    description: "Markers and session",
    abort: null,
  });
  await uploadTakeFile({
    lessonPath,
    takeId,
    name: TAKE_FILES.markers,
    data: markers,
  });
  await uploadTakeFile({
    lessonPath,
    takeId,
    name: TAKE_FILES.session,
    data: { ...sessionBase, status: "COMPLETED" },
  });
  await selectTakeOnServer({ lessonPath, takeId });
  setStatus(null);
};
