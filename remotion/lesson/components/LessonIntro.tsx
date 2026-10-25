import { starburst } from "@remotion/effects/starburst";
import { vignette } from "@remotion/effects/vignette";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Solid,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VideoStyle } from "../../../config/course";
import { REGULAR_FONT, TITLE_FONT } from "../../../config/fonts";
import type { VideoPaletteColors } from "../../../config/themes";
import { withAlpha } from "../../../config/themes";
import type { LessonIntroData } from "../calc-lesson-metadata";
import { BrandBackground } from "./BrandBackground";
import { StaggeredWords, useReveal } from "./StaggeredWords";

const titleFontSize = (title: string) => {
  if (title.length > 60) {
    return 72;
  }
  if (title.length > 36) {
    return 88;
  }
  return 104;
};

const Chip: React.FC<{
  palette: VideoPaletteColors;
  children: React.ReactNode;
  delay: number;
}> = ({ palette, children, delay }) => {
  const p = useReveal(delay, 0.5);
  return (
    <div
      style={{
        ...TITLE_FONT,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 22px",
        borderRadius: 999,
        fontSize: 28,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#fff",
        background: `linear-gradient(90deg, ${palette.brandFrom}, ${palette.brandTo})`,
        boxShadow: `0 10px 40px ${withAlpha(palette.brandFrom, 0.4)}`,
        opacity: p,
        scale: interpolate(p, [0, 1], [0.85, 1]),
      }}
    >
      {children}
    </div>
  );
};

const Breadcrumb: React.FC<{
  items: string[];
  palette: VideoPaletteColors;
  delay: number;
  align: "left" | "center";
}> = ({ items, palette, delay, align }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...REGULAR_FONT,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "center",
        gap: 18,
        fontSize: 32,
        color: palette.mutedText,
      }}
    >
      {items.map((item, i) => {
        const p = interpolate(
          frame,
          [(delay + i * 0.12) * fps, (delay + i * 0.12 + 0.5) * fps],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        );
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <span style={{ color: palette.accent, opacity: p }}>›</span>
            ) : null}
            <span
              style={{
                opacity: p,
                translate: `${interpolate(p, [0, 1], [-24, 0])}px 0`,
                color: i === items.length - 1 ? "#fff" : palette.mutedText,
              }}
            >
              {item}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const AccentBar: React.FC<{
  palette: VideoPaletteColors;
  delay: number;
  width: number;
}> = ({ palette, delay, width }) => {
  const p = useReveal(delay, 0.8);
  return (
    <div
      style={{
        width: p * width,
        height: 8,
        borderRadius: 4,
        background: `linear-gradient(90deg, ${palette.accent}, ${palette.brandTo})`,
        boxShadow: `0 0 24px ${withAlpha(palette.accent, 0.53)}`,
      }}
    />
  );
};

// Slow push-in of the whole card so it never feels static.
const usePushIn = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [0, durationInFrames], [1, 1.04]);
};

const GradientIntro: React.FC<{
  intro: LessonIntroData;
  palette: VideoPaletteColors;
}> = ({ intro, palette }) => {
  const scale = usePushIn();
  return (
    <AbsoluteFill>
      <BrandBackground palette={palette} intensity={0.75} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          paddingLeft: 160,
          paddingRight: 200,
          gap: 36,
          scale,
          transformOrigin: "left center",
        }}
      >
        {intro.breadcrumb.length > 0 ? (
          <Breadcrumb
            items={intro.breadcrumb}
            palette={palette}
            delay={0.1}
            align="left"
          />
        ) : null}
        {intro.label ? (
          <div>
            <Chip palette={palette} delay={0.25}>
              {intro.label}
            </Chip>
          </div>
        ) : null}
        <StaggeredWords
          text={intro.title}
          delay={0.35}
          stagger={0.07}
          style={{
            ...TITLE_FONT,
            fontSize: titleFontSize(intro.title),
            lineHeight: 1.12,
            color: "#fff",
            maxWidth: 1500,
            textWrap: "balance",
            textShadow: "0 6px 40px rgba(0,0,0,0.35)",
          }}
        />
        <AccentBar palette={palette} delay={0.7} width={260} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const MinimalIntro: React.FC<{
  intro: LessonIntroData;
  palette: VideoPaletteColors;
}> = ({ intro, palette }) => {
  const subtitle = useReveal(0.75, 0.6);
  const scale = usePushIn();
  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 55%, ${withAlpha(palette.brandFrom, 0.33)} 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 180px",
          gap: 34,
          scale,
        }}
      >
        {intro.label ? (
          <Chip palette={palette} delay={0.1}>
            {intro.label}
          </Chip>
        ) : null}
        <StaggeredWords
          text={intro.title}
          delay={0.2}
          stagger={0.06}
          style={{
            ...TITLE_FONT,
            fontSize: titleFontSize(intro.title),
            lineHeight: 1.12,
            color: "#fff",
            textWrap: "balance",
          }}
        />
        <AccentBar palette={palette} delay={0.55} width={180} />
        {intro.subtitle ? (
          <div
            style={{
              ...REGULAR_FONT,
              fontSize: 34,
              color: palette.mutedText,
              opacity: subtitle,
              translate: `0 ${interpolate(subtitle, [0, 1], [16, 0])}px`,
              textWrap: "balance",
            }}
          >
            {intro.subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StarburstBackground: React.FC<{ palette: VideoPaletteColors }> = ({
  palette,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <AbsoluteFill>
        <Solid
          width={width}
          height={height}
          style={{
            scale: interpolate(frame, [0, 1.2 * fps], [1.35, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
          effects={[
            starburst({
              rays: 28,
              colors: [
                palette.brandFrom,
                palette.background,
                palette.brandTo,
                palette.background,
              ],
              rotation: (frame * 0.25) % 360,
              smoothness: 0.35,
            }),
            // Darken the edges. Done in the effect chain because CSS
            // gradients layered above a WebGL canvas don't composite
            // reliably in headless Chrome.
            vignette({
              amount: 0.8,
              radius: 0.35,
              feather: 0.7,
              color: palette.background,
            }),
          ]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StarburstIntro: React.FC<{
  intro: LessonIntroData;
  palette: VideoPaletteColors;
}> = ({ intro, palette }) => {
  const scale = usePushIn();
  const card = useReveal(0.1, 0.6);
  return (
    <AbsoluteFill>
      <StarburstBackground palette={palette} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          scale,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
            maxWidth: 1500,
            padding: "56px 90px",
            borderRadius: 40,
            // Flat colors composite fine above the WebGL canvas
            backgroundColor: withAlpha(palette.background, 0.62),
            border: `1px solid ${palette.border}`,
            opacity: card,
            scale: interpolate(card, [0, 1], [0.92, 1]),
          }}
        >
          {intro.label ? (
            <Chip palette={palette} delay={0.2}>
              {intro.label}
            </Chip>
          ) : null}
          <StaggeredWords
            text={intro.title}
            delay={0.3}
            stagger={0.07}
            style={{
              ...TITLE_FONT,
              fontSize: titleFontSize(intro.title),
              lineHeight: 1.12,
              color: "#fff",
              textWrap: "balance",
              textShadow: `0 0 60px ${withAlpha(palette.brandFrom, 0.67)}`,
            }}
          />
          {intro.breadcrumb.length > 0 ? (
            <Breadcrumb
              items={intro.breadcrumb}
              palette={palette}
              delay={0.7}
              align="center"
            />
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LessonIntro: React.FC<{
  intro: LessonIntroData;
  palette: VideoPaletteColors;
  variant: VideoStyle["intro"];
}> = ({ intro, palette, variant }) => {
  if (variant === "starburst") {
    return <StarburstIntro intro={intro} palette={palette} />;
  }
  if (variant === "minimal") {
    return <MinimalIntro intro={intro} palette={palette} />;
  }
  return <GradientIntro intro={intro} palette={palette} />;
};
