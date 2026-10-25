import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Artifact,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { REGULAR_FONT, TITLE_FONT } from "../../config/fonts";
import type { VideoPaletteColors } from "../../config/themes";
import { VIDEO_PALETTES } from "../../config/themes";
import { LESSON_LIGHT_LEAK_SECONDS } from "../../config/transitions";
import { combineSrt } from "../captions/srt/helpers/combine-srt";
import { serializeSrt } from "../captions/srt/helpers/serialize-srt";
import { Main } from "../Main";
import type { LessonProps } from "./calc-lesson-metadata";
import {
  ChapterCards,
  LessonProgressBar,
  LowerThird,
} from "./components/BodyOverlays";
import { LessonAudio } from "./components/LessonAudio";
import { LessonIntro } from "./components/LessonIntro";
import { LessonOutroCard } from "./components/LessonOutroCard";
import { LightLeakOverlay } from "./components/LightLeakOverlay";
import type { LessonStrings } from "./i18n";
import { getLessonStrings } from "./i18n";
import type { TimelineChapter } from "./timeline";

export const CHAPTERS_ARTIFACT_FILENAME = "chapters.json";
export const SRT_ARTIFACT_FILENAME = "captions.srt";

// Emits an artifact once (on the first frame) while rendering.
const EmitArtifact: React.FC<{ filename: string; content: string }> = ({
  filename,
  content,
}) => {
  const frame = useCurrentFrame();
  if (frame !== 0 || content === "") {
    return null;
  }
  return <Artifact content={content} filename={filename} />;
};

// chapters.json: [{timeMs, title}] on the output timeline.
const EmitChaptersFile: React.FC<{ chapters: TimelineChapter[] }> = ({
  chapters,
}) => {
  const content = useMemo(() => JSON.stringify(chapters, null, 2), [chapters]);
  return (
    <EmitArtifact filename={CHAPTERS_ARTIFACT_FILENAME} content={content} />
  );
};

// captions.srt: the per-scene cues, shifted by the start of the lesson body
// (which already accounts for the intro and its transition overlap).
const EmitLessonSrt: React.FC<{
  scenesAndMetadata: LessonProps["scenesAndMetadata"];
  bodyStartFrame: number;
}> = ({ scenesAndMetadata, bodyStartFrame }) => {
  const { fps } = useVideoConfig();
  const content = useMemo(
    () =>
      serializeSrt(
        combineSrt(
          scenesAndMetadata.map((scene) => ({
            offsetInMs: Math.round(
              ((bodyStartFrame + scene.from) * 1000) / fps,
            ),
            srts: scene.type === "video-scene" ? scene.srt : [],
          })),
        ),
      ),
    [scenesAndMetadata, bodyStartFrame, fps],
  );
  return <EmitArtifact filename={SRT_ARTIFACT_FILENAME} content={content} />;
};

const LessonPlaceholder: React.FC<{ strings: LessonStrings }> = ({
  strings,
}) => {
  const palette = VIDEO_PALETTES.dotnet;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        padding: 100,
        textAlign: "center",
      }}
    >
      <div style={{ ...TITLE_FONT, fontSize: 64, color: palette.text }}>
        {strings.noLessonSelected}
      </div>
      <div style={{ ...REGULAR_FONT, fontSize: 36, color: palette.mutedText }}>
        {strings.setLessonPathHint}
      </div>
    </AbsoluteFill>
  );
};

const LessonBody: React.FC<{
  props: LessonProps;
  palette: VideoPaletteColors;
  strings: LessonStrings;
}> = ({ props, palette, strings }) => {
  const { scenesAndMetadata, theme, bodyChapters, videoStyle, info } = props;
  return (
    <AbsoluteFill>
      <Main
        canvasLayout="landscape"
        scenes={[]}
        scenesAndMetadata={scenesAndMetadata}
        theme={theme}
        platform="youtube"
        emitSrt={false}
      />
      {videoStyle.progressBar ? (
        <LessonProgressBar chapters={bodyChapters} palette={palette} />
      ) : null}
      {videoStyle.lowerThird && info ? (
        <LowerThird
          courseName={info.courseName}
          lessonTitle={info.lessonTitle}
          palette={palette}
        />
      ) : null}
      {videoStyle.chapterCards ? (
        <ChapterCards
          chapters={bodyChapters}
          palette={palette}
          strings={strings}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const TRANSITION_EASING = Easing.bezier(0.65, 0, 0.35, 1);

// The element placed between two parts of the TransitionSeries, or null.
const makeTransition = ({
  key,
  kind,
  overlapInFrames,
  lightLeakFrames,
  palette,
  seed,
}: {
  key: string;
  kind: LessonProps["videoStyle"]["transition"];
  overlapInFrames: number;
  lightLeakFrames: number;
  palette: VideoPaletteColors;
  seed: number;
}) => {
  if ((kind === "fade" || kind === "slide") && overlapInFrames > 0) {
    return (
      <TransitionSeries.Transition
        key={key}
        presentation={
          kind === "fade" ? fade() : slide({ direction: "from-right" })
        }
        timing={linearTiming({
          durationInFrames: overlapInFrames,
          easing: TRANSITION_EASING,
        })}
      />
    );
  }
  if (kind === "light-leak") {
    return (
      <TransitionSeries.Overlay key={key} durationInFrames={lightLeakFrames}>
        <LightLeakOverlay seed={seed} hueShift={palette.lightLeakHueShift} />
      </TransitionSeries.Overlay>
    );
  }
  return null;
};

export const LessonMain: React.FC<LessonProps> = (props) => {
  const { fps } = useVideoConfig();
  const { language, videoStyle, timeline, intro, outro, info } = props;
  const strings = getLessonStrings(language);

  if (info === null || timeline === null) {
    return <LessonPlaceholder strings={strings} />;
  }

  const palette = VIDEO_PALETTES[videoStyle.palette];
  const lightLeakFrames = Math.min(
    Math.round(LESSON_LIGHT_LEAK_SECONDS * fps),
    // An overlay may not be longer than the parts around it.
    timeline.bodyDurationInFrames,
  );

  const parts: React.ReactNode[] = [];
  if (intro && timeline.introDurationInFrames > 0) {
    parts.push(
      <TransitionSeries.Sequence
        key="intro"
        name="Intro"
        durationInFrames={timeline.introDurationInFrames}
      >
        <LessonIntro
          intro={intro}
          palette={palette}
          variant={videoStyle.intro}
        />
      </TransitionSeries.Sequence>,
      makeTransition({
        key: "intro-transition",
        kind: videoStyle.transition,
        overlapInFrames: timeline.introOverlapInFrames,
        lightLeakFrames: Math.min(
          lightLeakFrames,
          timeline.introDurationInFrames,
        ),
        palette,
        seed: 3,
      }),
    );
  }
  parts.push(
    <TransitionSeries.Sequence
      key="lesson"
      name="Lesson"
      durationInFrames={timeline.bodyDurationInFrames}
      premountFor={fps}
    >
      <LessonBody props={props} palette={palette} strings={strings} />
    </TransitionSeries.Sequence>,
  );
  if (outro && timeline.outroStartFrame !== null) {
    parts.push(
      makeTransition({
        key: "outro-transition",
        kind: videoStyle.transition,
        overlapInFrames: timeline.outroOverlapInFrames,
        lightLeakFrames: Math.min(
          lightLeakFrames,
          timeline.outroDurationInFrames,
        ),
        palette,
        seed: 7,
      }),
      <TransitionSeries.Sequence
        key="outro"
        name="Outro"
        durationInFrames={timeline.outroDurationInFrames}
      >
        <LessonOutroCard outro={outro} palette={palette} strings={strings} />
      </TransitionSeries.Sequence>,
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <TransitionSeries>{parts.filter((p) => p !== null)}</TransitionSeries>
      <LessonAudio
        timeline={timeline}
        music={videoStyle.backgroundMusic}
        whoosh={videoStyle.transition !== "none"}
      />
      <EmitLessonSrt
        scenesAndMetadata={props.scenesAndMetadata}
        bodyStartFrame={timeline.bodyStartFrame}
      />
      <EmitChaptersFile chapters={props.chapters} />
    </AbsoluteFill>
  );
};
