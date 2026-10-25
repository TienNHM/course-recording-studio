import { noise2D } from "@remotion/noise";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoPaletteColors } from "../../../config/themes";
import { withAlpha } from "../../../config/themes";

// Static film grain (SVG turbulence), very low opacity.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

const Blob: React.FC<{
  color: string;
  size: number;
  seed: string;
  baseX: number;
  baseY: number;
  opacity: number;
}> = ({ color, size, seed, baseX, baseY, opacity }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Slow drift driven by noise so the background never feels static.
  const dx = noise2D(seed, frame * 0.006, 0) * width * 0.12;
  const dy = noise2D(seed, 0, frame * 0.006) * height * 0.12;

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: baseX * width - size / 2,
        top: baseY * height - size / 2,
        translate: `${dx}px ${dy}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle at center, ${color} 0%, transparent 65%)`,
        opacity,
      }}
    />
  );
};

// Animated brand gradient with drifting color blobs, a faint grid and grain.
// `intensity` 1 = full brand gradient (gradient intro), lower = darker base.
export const BrandBackground: React.FC<{
  palette: VideoPaletteColors;
  intensity?: number;
  grid?: boolean;
}> = ({ palette, intensity = 1, grid = true }) => {
  const frame = useCurrentFrame();
  const angle = 125 + frame * 0.35;

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.background, overflow: "hidden" }}
    >
      <AbsoluteFill
        style={{
          background: `linear-gradient(${angle}deg, ${palette.brandFrom} 0%, ${palette.brandTo} 100%)`,
          opacity: intensity,
        }}
      />
      <Blob
        color={palette.brandFrom}
        size={1300}
        seed="a"
        baseX={0.15}
        baseY={0.2}
        opacity={0.9}
      />
      <Blob
        color={palette.brandTo}
        size={1200}
        seed="b"
        baseX={0.85}
        baseY={0.85}
        opacity={0.85}
      />
      <Blob
        color={palette.accent}
        size={900}
        seed="c"
        baseX={0.7}
        baseY={0.15}
        opacity={0.35}
      />
      {/* Darken the edges so text stays readable everywhere */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 35% 50%, transparent 0%, ${withAlpha(palette.background, 0.33)} 55%, ${withAlpha(palette.background, 0.82)} 100%)`,
        }}
      />
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            backgroundPosition: `${-frame * 0.4}px ${-frame * 0.2}px`,
            maskImage:
              "radial-gradient(ellipse at 30% 50%, black 0%, transparent 75%)",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          opacity: 0.07,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
