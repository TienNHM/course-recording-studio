import { lightLeak } from "@remotion/effects/light-leak";
import React from "react";
import { interpolate, Solid, useCurrentFrame, useVideoConfig } from "remotion";

// Light leak played over a cut (inside <TransitionSeries.Overlay>).
// Uses WebGL2: rendering needs a GL backend (see render-lesson.ts).
export const LightLeakOverlay: React.FC<{ seed: number; hueShift: number }> = ({
  seed,
  hueShift,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();

  return (
    <Solid
      width={width}
      height={height}
      effects={[
        lightLeak({
          seed,
          hueShift,
          progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }),
      ]}
    />
  );
};
