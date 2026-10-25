import type { CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import type { CourseLanguage, EditPlan, VideoStyle } from "../../config/course";
import {
  DEFAULT_VIDEO_STYLE,
  OUTPUT_PROFILES,
  courseLanguage,
  videoStyle as videoStyleSchema,
} from "../../config/course";
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
import {
  LESSON_INTRO_SECONDS,
  LESSON_OUTRO_SECONDS,
  LESSON_TRANSITION_SECONDS,
} from "../../config/transitions";
import { addDurationsToScenes } from "../calculate-metadata/add-durations-to-scenes";
import { calculateSrt } from "../captions/srt/helpers/calculate-srt";
import { getVideoMetadata } from "../helpers/get-video-metadata";
import { getDimensionsForLayout } from "../layout/dimensions";
import { getVideoSceneLayout } from "../layout/get-layout";
import type { LessonLanguage } from "./i18n";
import {
  DEFAULT_LESSON_LANGUAGE,
  chapterTitleOrFallback,
  parseLessonTitle,
} from "./i18n";
import { loadLesson } from "./load-lesson";
import type {
  BodyChapter,
  FramePiece,
  LessonTimeline,
  TimelineChapter,
  TimelineSegment,
} from "./timeline";
import {
  computeLessonTimeline,
  getBodyChapters,
  getOutputChapters,
  getSegmentRangeIfFirstPiece,
  normalizeSegments,
  remapCaptions,
  segmentsToFramePieces,
} from "./timeline";

export const DEFAULT_LESSON_FPS = 30;
const PLACEHOLDER_DURATION_IN_FRAMES = 90;

// Optional overrides of course.json, used by the Studio style preview.
export type LessonStyleOverride = Partial<VideoStyle>;

export const lessonCompositionSchema = z.object({
  // Path of the lesson folder relative to public/, e.g. "courses/c/m/l"
  lessonPath: z.string(),
});

// "lesson-style-preview" composition: every videoStyle field is editable in
// the Studio props panel without touching course.json.
export const lessonStylePreviewSchema = z.object({
  lessonPath: z.string(),
  language: courseLanguage,
  style: z.object({
    palette: videoStyleSchema.shape.palette.unwrap(),
    intro: videoStyleSchema.shape.intro.unwrap(),
    // eslint-disable-next-line @remotion/non-pure-animation -- not a CSS transition
    transition: videoStyleSchema.shape.transition.unwrap(),
    chapterCards: z.boolean(),
    lowerThird: z.boolean(),
    backgroundMusic: z.boolean(),
    progressBar: z.boolean(),
  }),
});
export type LessonStylePreviewProps = z.infer<typeof lessonStylePreviewSchema>;

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
  language: LessonLanguage;
  videoStyle: VideoStyle;
  fps: number;
  durationInFrames: number;
  layout: LessonLayout;
  hasEditPlan: boolean;
  hasCaptions: boolean;
  // Offset of the take content (its first kept frame) in the output.
  // With a fade/slide transition this is shorter than the intro card.
  introDurationInMs: number;
  // Length of the intro / outro cards themselves
  introCardDurationInMs: number;
  outroDurationInMs: number;
};

export type LessonIntroData = {
  // "Bài 1" parsed from the title, or null
  label: string | null;
  // Title without the label
  title: string;
  // Intro title as written in the edit plan
  fullTitle: string;
  // course → module (the intro subtitle "a · b" split up)
  breadcrumb: string[];
  subtitle: string | null;
};

export type LessonOutroData = {
  courseName: string;
  lessonTitle: string;
};

export type LessonProps = {
  lessonPath: string;
  styleOverride?: LessonStyleOverride | null;
  languageOverride?: CourseLanguage | null;
  // --- Calculated in calculateMetadata() ---
  theme: Theme;
  language: LessonLanguage;
  videoStyle: VideoStyle;
  // Video scenes of the lesson body; `from` is relative to the body start
  scenesAndMetadata: SceneAndMetadata[];
  // Chapters on the output timeline (same content as the chapters.json artifact)
  chapters: TimelineChapter[];
  // Chapters relative to the body start (chapter cards, progress bar ticks)
  bodyChapters: BodyChapter[];
  timeline: LessonTimeline | null;
  transitionDurationInFrames: number;
  intro: LessonIntroData | null;
  outro: LessonOutroData | null;
  info: LessonRenderInfo | null;
};

export const defaultLessonProps: LessonProps = {
  lessonPath: "",
  theme: LESSON_THEME,
  language: DEFAULT_LESSON_LANGUAGE,
  videoStyle: DEFAULT_VIDEO_STYLE,
  scenesAndMetadata: [],
  chapters: [],
  bodyChapters: [],
  timeline: null,
  transitionDurationInFrames: 0,
  intro: null,
  outro: null,
  info: null,
};

export const DEFAULT_PREVIEW_LESSON_PATH =
  "courses/net-backend-zero-senior/module-0-khai-giang/bai-1-gioi-thieu-khoa-hoc";

export const defaultLessonStylePreviewProps: LessonStylePreviewProps = {
  lessonPath: DEFAULT_PREVIEW_LESSON_PATH,
  language: "vi",
  style: DEFAULT_VIDEO_STYLE,
};

const framesToMs = (frames: number, fps: number) =>
  Math.round((frames / fps) * 1000);

const makeVideoScene = (): SelectableVideoScene => ({
  type: "videoscene",
  webcamPosition: "bottom-right",
  startOffset: 0,
  endOffset: 0,
  // Hard cuts between segments
  transitionToNextScene: false,
  // Chapters are drawn by the lesson's own chapter cards, not by the legacy
  // chapter list of the recorder template (which is driven by `newChapter`).
  newChapter: undefined,
  stopChapteringAfterThis: false,
  music: "none",
  bRolls: [],
});

const splitBreadcrumb = (subtitle: string | null) =>
  (subtitle ?? "")
    .split(/\s+[·•|›»]\s+/u)
    .map((s) => s.trim())
    .filter((s) => s !== "");

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
      props: {
        ...defaultLessonProps,
        lessonPath: props.lessonPath,
        language: props.languageOverride ?? DEFAULT_LESSON_LANGUAGE,
      },
    };
  }

  const loaded = await loadLesson(props.lessonPath);
  const { lesson, course, module, editPlan, media, captions, takeId } = loaded;

  const language: LessonLanguage =
    props.languageOverride ?? course?.language ?? DEFAULT_LESSON_LANGUAGE;
  const videoStyle: VideoStyle = videoStyleSchema.parse({
    ...(course?.videoStyle ?? DEFAULT_VIDEO_STYLE),
    ...(props.styleOverride ?? {}),
  });

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

  const planChapters = [...(editPlan ? editPlan.chapters : [])]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((c, i) => ({
      timeMs: c.timeMs,
      title: chapterTitleOrFallback(c.title, i, language),
    }));

  const pieces = segmentsToFramePieces({
    segments,
    chapters: planChapters,
    fps,
  });

  const courseName = course?.name ?? lesson.courseId;
  const moduleTitle = module?.title ?? lesson.moduleId;

  // --- Intro / outro ---
  const introPlan = editPlan
    ? editPlan.intro
    : { title: lesson.title, subtitle: `${courseName} · ${moduleTitle}` };
  const hasOutro = editPlan ? editPlan.outro : true;

  const intro: LessonIntroData | null = introPlan
    ? {
        ...parseLessonTitle(introPlan.title),
        fullTitle: introPlan.title,
        breadcrumb: splitBreadcrumb(introPlan.subtitle),
        subtitle: introPlan.subtitle,
      }
    : null;
  const outro: LessonOutroData | null = hasOutro
    ? { courseName, lessonTitle: lesson.title }
    : null;

  const introDurationInFrames = intro
    ? Math.round(LESSON_INTRO_SECONDS * fps)
    : 0;
  const outroDurationInFrames = outro
    ? Math.round(LESSON_OUTRO_SECONDS * fps)
    : 0;

  // --- Body scenes (`from` relative to the body start) ---
  const scenes: SceneAndMetadata[] = [];
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
      scene: makeVideoScene(),
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

  // No scene transitions inside the body (hard cuts, they are edits), so
  // this only assigns `from` values.
  const {
    totalDurationInFrames: bodyDurationInFrames,
    scenesAndMetadataWithDuration,
  } = addDurationsToScenes(scenes, "landscape");

  const bodyChapters = getBodyChapters(pieces);

  const transitionDurationInFrames = Math.round(
    LESSON_TRANSITION_SECONDS * fps,
  );
  const timeline = computeLessonTimeline({
    introDurationInFrames,
    bodyDurationInFrames,
    outroDurationInFrames,
    // eslint-disable-next-line @remotion/non-pure-animation -- not a CSS transition
    transition: videoStyle.transition,
    transitionDurationInFrames,
  });

  const chapters: TimelineChapter[] = getOutputChapters({
    bodyChapters,
    bodyStartFrame: timeline.bodyStartFrame,
    fps,
  });

  const info: LessonRenderInfo = {
    courseId: lesson.courseId,
    moduleId: lesson.moduleId,
    lessonId: lesson.id,
    takeId,
    lessonTitle: lesson.title,
    moduleTitle,
    courseName,
    language,
    videoStyle,
    fps,
    durationInFrames: timeline.totalDurationInFrames,
    layout,
    hasEditPlan: editPlan !== null,
    hasCaptions: captions !== null,
    introDurationInMs: framesToMs(timeline.bodyStartFrame, fps),
    introCardDurationInMs: framesToMs(introDurationInFrames, fps),
    outroDurationInMs: framesToMs(outroDurationInFrames, fps),
  };

  return {
    durationInFrames: timeline.totalDurationInFrames,
    fps,
    width,
    height,
    props: {
      lessonPath: props.lessonPath,
      styleOverride: props.styleOverride ?? null,
      languageOverride: props.languageOverride ?? null,
      theme: LESSON_THEME,
      language,
      videoStyle,
      scenesAndMetadata: scenesAndMetadataWithDuration,
      chapters,
      bodyChapters,
      timeline,
      transitionDurationInFrames,
      intro,
      outro,
      info,
    },
  };
};

// Studio style preview: maps the flat, editable style props to overrides.
export const calcLessonStylePreviewMetadata: CalculateMetadataFunction<
  LessonProps & LessonStylePreviewProps
> = async (options) => {
  const p = options.props;
  const result = await calcLessonMetadata({
    ...options,
    props: {
      ...defaultLessonProps,
      lessonPath: p.lessonPath,
      languageOverride: p.language,
      styleOverride: p.style,
    },
  });
  return {
    ...result,
    // Keep the flat style props so that the Studio panel stays editable.
    props: {
      ...(result.props as LessonProps),
      lessonPath: p.lessonPath,
      style: p.style,
    },
  };
};
