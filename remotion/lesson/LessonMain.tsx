import React, { useMemo } from "react";
import { AbsoluteFill, Artifact, useCurrentFrame } from "remotion";
import { REGULAR_FONT, TITLE_FONT } from "../../config/fonts";
import { COLORS } from "../../config/themes";
import { Main } from "../Main";
import type { LessonProps } from "./calc-lesson-metadata";
import type { TimelineChapter } from "./timeline";

export const CHAPTERS_ARTIFACT_FILENAME = "chapters.json";

// Emits chapters.json ([{timeMs, title}] on the output timeline) while rendering.
const EmitChaptersFile: React.FC<{
  chapters: TimelineChapter[];
}> = ({ chapters }) => {
  const frame = useCurrentFrame();
  const content = useMemo(() => JSON.stringify(chapters, null, 2), [chapters]);

  if (frame !== 0) {
    return null;
  }

  return <Artifact content={content} filename={CHAPTERS_ARTIFACT_FILENAME} />;
};

const LessonPlaceholder: React.FC<Pick<LessonProps, "theme">> = ({ theme }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS[theme].BACKGROUND,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        padding: 100,
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...TITLE_FONT,
          fontSize: 64,
          color: COLORS[theme].WORD_COLOR_ON_BG_APPEARED,
        }}
      >
        No lesson selected
      </div>
      <div
        style={{
          ...REGULAR_FONT,
          fontSize: 36,
          color: COLORS[theme].WORD_COLOR_ON_BG_GREYED,
        }}
      >
        Set the <code>lessonPath</code> prop, e.g.
        courses/my-course/module/lesson
      </div>
    </AbsoluteFill>
  );
};

export const LessonMain: React.FC<LessonProps> = ({
  scenesAndMetadata,
  theme,
  chapters,
  info,
}) => {
  if (info === null) {
    return <LessonPlaceholder theme={theme} />;
  }

  return (
    <>
      <Main
        canvasLayout="landscape"
        scenes={[]}
        scenesAndMetadata={scenesAndMetadata}
        theme={theme}
        platform="youtube"
      />
      <EmitChaptersFile chapters={chapters} />
    </>
  );
};
