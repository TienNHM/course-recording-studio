import type { CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import type { EditPlan } from "../../config/course";
import { OUTPUT_PROFILES } from "../../config/course";
import type {
  Cameras,
  SceneAndMetadata,
  SceneVideos,
  SelectableVideoScene,
  VideoSceneOptions,
  WebcamPosition,
} from "../../config/scenes";
import type { Theme } from "../../config/themes";
import { LESSON_THEME } from "../../config/themes";
import { addChaptersToScenesAndMetadata } from "../calculate-metadata/add-chapters-to-scenes";
import { addDurationsToScenes } from "../calculate-metadata/add-durations-to-scenes";
import { calculateSrt } from "../captions/srt/helpers/calculate-srt";
import { makeChapters } from "../chapters/make-chapters";
import { getVideoMetadata } from "../helpers/get-video-metadata";
import { getDimensionsForLayout } from "../layout/dimensions";
import { getVideoSceneLayout } from "../layout/get-layout";
import { loadLesson } from "./load-lesson";
import type { FramePiece, TimelineChapter, TimelineSegment } from "./timeline";
import {
  getSegmentRangeIfFirstPiece,
  normalizeSegments,
  remapCaptions,
  segmentsToFramePieces,
} from "./timeline";

export const DEFAULT_LESSON_FPS = 30;
const INTRO_DURATION_IN_SECONDS = 3;
const OUTRO_DURATION_IN_SECONDS = 4;
const PLACEHOLDER_DURATION_IN_FRAMES = 90;

export const lessonCompositionSchema = z.object({
  // Path of the lesson folder relative to public/, e.g. "courses/c/m/l"
  lessonPath: z.string(),
});

export type LessonLayout = EditPlan["layout"];

// Everything the render step may want to know about the rendered video.
export type LessonRenderInfo = {
  courseId: string;
  moduleId: string;
  lessonId: string;
  takeId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseName: string;
  fps: number;
  durationInFrames: number;
  layout: LessonLayout;
  hasEditPlan: boolean;
  hasCaptions: boolean;
  // Length of the intro, i.e. offset of the take content in the output
  introDurationInMs: number;
  outroDurationInMs: number;
};

export type LessonProps = {
  lessonPath: string;
  // --- Calculated in calculateMetadata() ---
  theme: Theme;
  scenesAndMetadata: SceneAndMetadata[];
  // Chapters on the output timeline (same content as the chapters.json artifact)
  chapters: TimelineChapter[];
  info: LessonRenderInfo | null;
};

export const defaultLessonProps: LessonProps = {
  lessonPath: "",
  theme: LESSON_THEME,
  scenesAndMetadata: [],
  chapters: [],
  info: null,
};

const framesToMs = (frames: number, fps: number) =>
  Math.round((frames / fps) * 1000);

const makeVideoScene = (chapter: string | null): SelectableVideoScene => ({
  type: "videoscene",
  webcamPosition: "bottom-right",
  startOffset: 0,
  endOffset: 0,
  // Hard cuts between segments
  transitionToNextScene: false,
  newChapter: chapter ?? undefined,
  stopChapteringAfterThis: false,
  music: "none",
  bRolls: [],
});

export const calcLessonMetadata: CalculateMetadataFunction<
  LessonProps
> = async ({ props }) => {
  const { width, height } = getDimensionsForLayout("landscape");

  if (props.lessonPath.trim() === "") {
    return {
      durationInFrames: PLACEHOLDER_DURATION_IN_FRAMES,
      fps: DEFAULT_LESSON_FPS,
      width,
      height,
      props: { ...defaultLessonProps, lessonPath: props.lessonPath },
    };
  }

  const loaded = await loadLesson(props.lessonPath);
  const { lesson, course, module, editPlan, media, captions, takeId } = loaded;

  const fps = course
    ? OUTPUT_PROFILES[course.outputProfile].fps
    : DEFAULT_LESSON_FPS;

  const [displayMetadata, webcamMetadata] = await Promise.all([
    getVideoMetadata({ src: media.display.src, includeDuration: true }),
    media.webcam
      ? getVideoMetadata({ src: media.webcam.src, includeDuration: false })
      : null,
  ]);

  if (!displayMetadata.dimensions) {
    throw new Error(`No video track in ${media.display.name}`);
  }

  if (!displayMetadata.durationInSeconds) {
    throw new Error(
      `Could not determine the duration of ${media.display.name}`,
    );
  }

  const takeDurationMs = displayMetadata.durationInSeconds * 1000;

  // --- Layout & audio ---
  const useWebcam =
    media.webcam !== null &&
    webcamMetadata?.dimensions !== null &&
    webcamMetadata !== null &&
    (editPlan ? editPlan.layout === "screen-webcam" : true);
  const layout: LessonLayout = useWebcam ? "screen-webcam" : "screen-only";

  const webcamHasAudio = webcamMetadata?.hasAudio ?? false;
  const displayHasAudio = displayMetadata.hasAudio;

  let cameras: Cameras;
  let videos: SceneVideos;
  let webcamPosition: WebcamPosition;
  let options: VideoSceneOptions;

  if (useWebcam && media.webcam && webcamMetadata?.dimensions) {
    cameras = {
      webcam: media.webcam,
      display: media.display,
      captions: media.captions,
      alternative1: null,
      alternative2: null,
      timestamp: Number(takeId),
    };
    videos = {
      webcam: webcamMetadata.dimensions,
      display: displayMetadata.dimensions,
    };
    webcamPosition = "bottom-right";
    options = {
      // If both files carry audio, the mic is in the webcam file.
      muteDisplay: webcamHasAudio,
      muteWebcam: false,
      separateAudio: null,
      readOnly: true,
    };
  } else {
    // Screen only: the display recording is shown fullscreen in the main slot.
    cameras = {
      webcam: media.display,
      display: null,
      captions: media.captions,
      alternative1: null,
      alternative2: null,
      timestamp: Number(takeId),
    };
    videos = { webcam: displayMetadata.dimensions, display: null };
    webcamPosition = "center";
    options = {
      muteDisplay: false,
      muteWebcam: false,
      // The webcam is hidden, but it may be the only file with mic audio.
      separateAudio:
        !displayHasAudio && webcamHasAudio && media.webcam
          ? media.webcam.src
          : null,
      readOnly: true,
    };
  }

  const sceneLayout = getVideoSceneLayout({
    canvasLayout: "landscape",
    videos,
    webcamPosition,
  });

  // --- Segments & chapters ---
  const segments: TimelineSegment[] = normalizeSegments(
    editPlan ? editPlan.segments : [{ startMs: 0, endMs: takeDurationMs }],
    takeDurationMs,
  );
  if (segments.length === 0) {
    throw new Error("The edit plan does not keep any part of the take.");
  }

  const pieces = segmentsToFramePieces({
    segments,
    chapters: editPlan ? editPlan.chapters : [],
    fps,
  });

  const courseName = course?.name ?? lesson.courseId;
  const moduleTitle = module?.title ?? lesson.moduleId;

  // --- Scenes ---
  const intro = editPlan
    ? editPlan.intro
    : { title: lesson.title, subtitle: `${moduleTitle} · ${courseName}` };
  const hasOutro = editPlan ? editPlan.outro : true;

  const introDurationInFrames = intro
    ? Math.round(INTRO_DURATION_IN_SECONDS * fps)
    : 0;
  const outroDurationInFrames = hasOutro
    ? Math.round(OUTRO_DURATION_IN_SECONDS * fps)
    : 0;

  const scenes: SceneAndMetadata[] = [];

  if (intro) {
    scenes.push({
      type: "other-scene",
      scene: {
        type: "title",
        title: intro.title,
        subtitle: intro.subtitle,
        durationInFrames: introDurationInFrames,
        music: "none",
        transitionToNextScene: false,
      },
      durationInFrames: introDurationInFrames,
      from: 0,
    });
  }

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i] as FramePiece;
    // Captions are attached to the first piece of each segment so that
    // subtitle lines are not broken up at chapter boundaries.
    const segmentRange = getSegmentRangeIfFirstPiece(pieces, i, fps);
    const srt =
      captions && segmentRange
        ? calculateSrt({
            captions: remapCaptions(captions, [segmentRange]),
            startFrame: 0,
            fps,
          })
        : [];

    scenes.push({
      type: "video-scene",
      scene: makeVideoScene(piece.chapter),
      videos,
      layout: sceneLayout,
      cameras,
      webcamPosition,
      durationInFrames: piece.durationInFrames,
      from: 0,
      chapter: piece.chapter,
      startFrame: piece.trimBefore,
      endFrame: piece.trimAfter,
      bRolls: [],
      srt,
      options,
    });
  }

  if (hasOutro) {
    scenes.push({
      type: "other-scene",
      scene: {
        type: "lessonoutro",
        title: courseName,
        subtitle: "Thanks for watching",
        durationInFrames: outroDurationInFrames,
        music: "none",
        transitionToNextScene: false,
      },
      durationInFrames: outroDurationInFrames,
      from: 0,
    });
  }

  // No scene transitions in lessons, so this only assigns `from` values.
  const { totalDurationInFrames, scenesAndMetadataWithDuration } =
    addDurationsToScenes(scenes, "landscape");
  const withChapters = addChaptersToScenesAndMetadata(
    scenesAndMetadataWithDuration,
  );

  const chapters: TimelineChapter[] = makeChapters({
    scenes: withChapters,
  }).map((c) => ({ timeMs: framesToMs(c.start, fps), title: c.title }));

  const info: LessonRenderInfo = {
    courseId: lesson.courseId,
    moduleId: lesson.moduleId,
    lessonId: lesson.id,
    takeId,
    lessonTitle: lesson.title,
    moduleTitle,
    courseName,
    fps,
    durationInFrames: totalDurationInFrames,
    layout,
    hasEditPlan: editPlan !== null,
    hasCaptions: captions !== null,
    introDurationInMs: framesToMs(introDurationInFrames, fps),
    outroDurationInMs: framesToMs(outroDurationInFrames, fps),
  };

  return {
    durationInFrames: totalDurationInFrames,
    fps,
    width,
    height,
    props: {
      lessonPath: props.lessonPath,
      theme: LESSON_THEME,
      scenesAndMetadata: withChapters,
      chapters,
      info,
    },
  };
};
