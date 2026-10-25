import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { REGULAR_FONT, TITLE_FONT } from "../../../config/fonts";
import type { VideoPaletteColors } from "../../../config/themes";
import type { LessonOutroData } from "../calc-lesson-metadata";
import type { LessonStrings } from "../i18n";
import { BrandBackground } from "./BrandBackground";
import { StaggeredWords, useReveal } from "./StaggeredWords";

const FadeToBlack: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        opacity: interpolate(
          frame,
          [durationInFrames - 0.6 * fps, durationInFrames - 1],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
      }}
    />
  );
};

// Closing card: "Thanks for watching" + course / lesson, in the palette.
export const LessonOutroCard: React.FC<{
  outro: LessonOutroData;
  palette: VideoPaletteColors;
  strings: LessonStrings;
}> = ({ outro, palette, strings }) => {
  const line = useReveal(0.55, 0.8);
  const meta = useReveal(0.8, 0.6);

  return (
    <AbsoluteFill>
      <BrandBackground palette={palette} intensity={0.4} grid={false} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 200px",
          gap: 30,
        }}
      >
        <StaggeredWords
          text={strings.thanksForWatching}
          delay={0.15}
          stagger={0.08}
          style={{
            ...TITLE_FONT,
            fontSize: 96,
            lineHeight: 1.1,
            color: "#fff",
            textWrap: "balance",
          }}
        />
        <div
          style={{
            width: line * 200,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.brandTo})`,
          }}
        />
        <div
          style={{
            ...REGULAR_FONT,
            fontSize: 38,
            color: palette.mutedText,
            opacity: meta,
            translate: `0 ${interpolate(meta, [0, 1], [16, 0])}px`,
          }}
        >
          {strings.seeYouNext}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 90,
        }}
      >
        <div
          style={{
            ...REGULAR_FONT,
            fontSize: 28,
            color: palette.mutedText,
            opacity: meta * 0.9,
            display: "flex",
            gap: 16,
          }}
        >
          <span style={{ color: "#fff" }}>{outro.courseName}</span>
          <span style={{ color: palette.accent }}>•</span>
          <span>{outro.lessonTitle}</span>
        </div>
      </AbsoluteFill>
      <FadeToBlack />
    </AbsoluteFill>
  );
};
