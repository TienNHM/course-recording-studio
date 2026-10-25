import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { REGULAR_FONT, TITLE_FONT } from "../../../config/fonts";
import type { VideoPaletteColors } from "../../../config/themes";
import {
  LESSON_CHAPTER_CARD_SECONDS,
  LESSON_LOWER_THIRD_DELAY_SECONDS,
  LESSON_LOWER_THIRD_SECONDS,
} from "../../../config/transitions";
import type { LessonStrings } from "../i18n";
import type { BodyChapter } from "../timeline";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

// 0 → 1 → 0 over the sequence: in during `inSeconds`, out during the last `outSeconds`.
const useInOut = (inSeconds: number, outSeconds: number) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, inSeconds * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const exit = interpolate(
    frame,
    [durationInFrames - outSeconds * fps, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN },
  );
  return { enter, exit };
};

const ChapterCard: React.FC<{
  chapter: BodyChapter;
  palette: VideoPaletteColors;
  strings: LessonStrings;
}> = ({ chapter, palette, strings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { enter, exit } = useInOut(0.55, 0.5);
  const fill = interpolate(frame, [0.3 * fps, 1.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  return (
    <AbsoluteFill style={{ padding: 44, alignItems: "flex-start" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "18px 26px 20px 26px",
          borderRadius: 18,
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          backdropFilter: "blur(14px)",
          opacity: enter * (1 - exit),
          translate: `${interpolate(enter, [0, 1], [-48, 0]) - exit * 24}px 0`,
          maxWidth: 760,
        }}
      >
        <div
          style={{
            ...TITLE_FONT,
            fontSize: 20,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: palette.accent,
          }}
        >
          {strings.chapterProgress(chapter.index + 1, chapter.total)}
        </div>
        <div
          style={{
            ...TITLE_FONT,
            fontSize: 34,
            lineHeight: 1.2,
            color: palette.text,
          }}
        >
          {chapter.title}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {new Array(chapter.total).fill(true).map((_, i) => {
            const done = i < chapter.index ? 1 : i === chapter.index ? fill : 0;
            return (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.18)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${done * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${palette.brandFrom}, ${palette.accent})`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ChapterCards: React.FC<{
  chapters: BodyChapter[];
  palette: VideoPaletteColors;
  strings: LessonStrings;
}> = ({ chapters, palette, strings }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {chapters.map((chapter) => {
        const duration = Math.min(
          Math.round(LESSON_CHAPTER_CARD_SECONDS * fps),
          chapter.durationInFrames,
        );
        if (duration < fps) {
          return null;
        }
        return (
          <Sequence
            key={chapter.index}
            name={`Chapter card: ${chapter.title}`}
            from={chapter.fromFrame}
            durationInFrames={duration}
          >
            <ChapterCard
              chapter={chapter}
              palette={palette}
              strings={strings}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const LowerThirdInner: React.FC<{
  courseName: string;
  lessonTitle: string;
  palette: VideoPaletteColors;
}> = ({ courseName, lessonTitle, palette }) => {
  const { enter, exit } = useInOut(0.7, 0.5);
  const reveal = enter * (1 - exit);
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", padding: "0 0 70px 60px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 22,
          padding: "20px 34px 22px 22px",
          borderRadius: 18,
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          backdropFilter: "blur(14px)",
          alignSelf: "flex-start",
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0 round 18px)`,
          translate: `${interpolate(reveal, [0, 1], [-30, 0])}px 0`,
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            width: 6,
            borderRadius: 3,
            background: `linear-gradient(180deg, ${palette.accent}, ${palette.brandTo})`,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              ...REGULAR_FONT,
              fontSize: 22,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: palette.accent,
            }}
          >
            {courseName}
          </div>
          <div
            style={{
              ...TITLE_FONT,
              fontSize: 40,
              lineHeight: 1.2,
              color: palette.text,
            }}
          >
            {lessonTitle}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const LowerThird: React.FC<{
  courseName: string;
  lessonTitle: string;
  palette: VideoPaletteColors;
}> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();
  const from = Math.round(LESSON_LOWER_THIRD_DELAY_SECONDS * fps);
  const duration = Math.min(
    Math.round(LESSON_LOWER_THIRD_SECONDS * fps),
    durationInFrames - from,
  );
  if (duration < fps) {
    return null;
  }
  return (
    <Sequence name="Lower third" from={from} durationInFrames={duration}>
      <LowerThirdInner {...props} />
    </Sequence>
  );
};

// Thin lesson progress bar with chapter ticks (always on, very subtle).
export const LessonProgressBar: React.FC<{
  chapters: BodyChapter[];
  palette: VideoPaletteColors;
}> = ({ chapters, palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div
        style={{
          position: "relative",
          height: 5,
          width: "100%",
          background: "rgba(255,255,255,0.10)",
          opacity: 0.9,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${palette.brandFrom}, ${palette.accent})`,
            boxShadow: `0 0 12px ${palette.accent}`,
          }}
        />
        {chapters
          .filter((c) => c.fromFrame > 0)
          .map((c) => (
            <div
              key={c.index}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 3,
                left: `${(c.fromFrame / durationInFrames) * 100}%`,
                background: "rgba(0,0,0,0.65)",
              }}
            />
          ))}
      </div>
    </AbsoluteFill>
  );
};
