import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { REGULAR_FONT, TITLE_FONT } from "../../../config/fonts";
import type { Theme } from "../../../config/themes";
import { COLORS } from "../../../config/themes";

// Generic closing card for course lessons (no brand / social links).
export const LessonOutro: React.FC<{
  title: string;
  subtitle: string;
  theme: Theme;
}> = ({ title, subtitle, theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ fps, frame, config: { damping: 200 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps / 2, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS[theme].BACKGROUND,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          ...REGULAR_FONT,
          fontSize: 44,
          color: COLORS[theme].WORD_COLOR_ON_BG_GREYED,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          width: interpolate(enter, [0, 1], [0, 160]),
          height: 6,
          borderRadius: 3,
          backgroundColor: COLORS[theme].ACCENT_COLOR,
          margin: "28px 0",
        }}
      />
      <div
        style={{
          ...TITLE_FONT,
          fontSize: 72,
          color: COLORS[theme].WORD_COLOR_ON_BG_APPEARED,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [-20, 0])}px)`,
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};
