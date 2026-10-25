import { Audio } from "@remotion/media";
import React from "react";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import {
  LESSON_MUSIC_FADE_SECONDS,
  LESSON_MUSIC_TRACK,
  LESSON_MUSIC_VOLUME,
  LESSON_WHOOSH_SFX,
  LESSON_WHOOSH_VOLUME,
} from "../../../config/sounds";
import type { LessonTimeline } from "../timeline";

const MusicBed: React.FC<{
  from: number;
  durationInFrames: number;
  name: string;
}> = ({ from, durationInFrames, name }) => {
  const { fps } = useVideoConfig();
  const fade = Math.max(
    1,
    Math.min(LESSON_MUSIC_FADE_SECONDS * fps, durationInFrames / 3),
  );
  return (
    <Sequence
      name={name}
      from={from}
      durationInFrames={durationInFrames}
      layout="none"
    >
      <Audio
        src={staticFile(LESSON_MUSIC_TRACK)}
        volume={(f) =>
          interpolate(
            f,
            [0, fade, durationInFrames - fade, durationInFrames],
            [0, LESSON_MUSIC_VOLUME, LESSON_MUSIC_VOLUME, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
    </Sequence>
  );
};

// Background music under the intro and outro cards only (it fades out before
// the speaker starts), and a subtle whoosh on every intro/outro transition.
export const LessonAudio: React.FC<{
  timeline: LessonTimeline;
  music: boolean;
  whoosh: boolean;
}> = ({ timeline, music, whoosh }) => {
  const { fps } = useVideoConfig();
  const whooshLead = Math.round(0.3 * fps);
  return (
    <>
      {music && timeline.introDurationInFrames > 0 ? (
        <MusicBed
          name="Intro music"
          from={0}
          durationInFrames={timeline.introDurationInFrames}
        />
      ) : null}
      {music && timeline.outroStartFrame !== null ? (
        <MusicBed
          name="Outro music"
          from={timeline.outroStartFrame}
          durationInFrames={timeline.outroDurationInFrames}
        />
      ) : null}
      {whoosh
        ? timeline.cutFrames.map((cut) => (
            <Sequence
              key={cut}
              name="Whoosh"
              from={Math.max(0, cut - whooshLead)}
              durationInFrames={fps}
              layout="none"
            >
              <Audio
                src={staticFile(LESSON_WHOOSH_SFX)}
                volume={LESSON_WHOOSH_VOLUME}
              />
            </Sequence>
          ))
        : null}
    </>
  );
};
