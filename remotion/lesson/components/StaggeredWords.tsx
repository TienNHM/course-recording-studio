import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Reveals text word by word (fade + rise + unblur). Words never break apart,
// which keeps Vietnamese diacritics and multi-letter graphemes intact.
export const StaggeredWords: React.FC<{
  text: string;
  // Delay before the first word, in seconds
  delay?: number;
  // Delay between two words, in seconds
  stagger?: number;
  // Duration of one word's animation, in seconds
  duration?: number;
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
}> = ({
  text,
  delay = 0,
  stagger = 0.06,
  duration = 0.6,
  style,
  wordStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter((w) => w !== "");

  return (
    <div style={style}>
      {words.map((word, i) => {
        const start = (delay + i * stagger) * fps;
        const range = [start, start + duration * fps];
        const progress = interpolate(frame, range, [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE_OUT,
        });
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                opacity: progress,
                translate: `0 ${interpolate(progress, [0, 1], [0.45, 0])}em`,
                filter: `blur(${interpolate(progress, [0, 1], [10, 0])}px)`,
                ...wordStyle,
              }}
            >
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// 0 → 1 between `delay` and `delay + duration` seconds, eased.
export const useReveal = (delay: number, duration = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [delay * fps, (delay + duration) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
};
