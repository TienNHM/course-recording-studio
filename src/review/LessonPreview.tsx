import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { LessonMain } from "../../remotion/lesson/LessonMain";
import type { LessonMetadata } from "./use-lesson-metadata";

// Positions are in ms on the rendered video (intro included); the Review page
// maps them to the original take with info.introDurationInMs.
export type LessonPreviewHandle = {
  seekToPlayerMs: (ms: number) => void;
  getPlayerMs: () => number;
  seekBy: (deltaMs: number) => void;
  toggle: () => void;
  pause: () => void;
};

export const LessonPreview = React.forwardRef<
  LessonPreviewHandle,
  {
    readonly metadata: LessonMetadata;
    /** Called on every frame change (playback and seeking). */
    readonly onFrame?: (playerMs: number) => void;
    readonly onPlayingChange?: (playing: boolean) => void;
  }
>(({ metadata, onFrame, onPlayingChange }, ref) => {
  const player = useRef<PlayerRef>(null);
  const { fps, durationInFrames } = metadata;

  const seekToFrame = useCallback(
    (frame: number) => {
      player.current?.seekTo(
        Math.max(0, Math.min(durationInFrames - 1, Math.round(frame))),
      );
    },
    [durationInFrames],
  );

  const getPlayerMs = useCallback(
    () => ((player.current?.getCurrentFrame() ?? 0) / fps) * 1000,
    [fps],
  );

  useImperativeHandle(
    ref,
    () => ({
      seekToPlayerMs: (ms) => seekToFrame((ms / 1000) * fps),
      getPlayerMs,
      seekBy: (deltaMs) =>
        seekToFrame(((getPlayerMs() + deltaMs) / 1000) * fps),
      toggle: () => player.current?.toggle(),
      pause: () => player.current?.pause(),
    }),
    [fps, getPlayerMs, seekToFrame],
  );

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onPlayingRef = useRef(onPlayingChange);
  onPlayingRef.current = onPlayingChange;

  useEffect(() => {
    const current = player.current;
    if (!current) {
      return;
    }
    const frame = (e: { detail: { frame: number } }) =>
      onFrameRef.current?.((e.detail.frame / fps) * 1000);
    const play = () => onPlayingRef.current?.(true);
    const pause = () => onPlayingRef.current?.(false);
    current.addEventListener("frameupdate", frame);
    current.addEventListener("seeked", frame);
    current.addEventListener("play", play);
    current.addEventListener("pause", pause);
    current.addEventListener("ended", pause);
    onFrameRef.current?.(((current.getCurrentFrame() ?? 0) / fps) * 1000);
    return () => {
      current.removeEventListener("frameupdate", frame);
      current.removeEventListener("seeked", frame);
      current.removeEventListener("play", play);
      current.removeEventListener("pause", pause);
      current.removeEventListener("ended", pause);
    };
  }, [fps, metadata]);

  return (
    <Player
      ref={player}
      component={LessonMain}
      inputProps={metadata.props}
      durationInFrames={metadata.durationInFrames}
      fps={metadata.fps}
      compositionWidth={metadata.width}
      compositionHeight={metadata.height}
      controls
      clickToPlay
      // Space is handled by the Review page's own shortcuts.
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
      style={{
        width: "100%",
        aspectRatio: `${metadata.width} / ${metadata.height}`,
      }}
    />
  );
});
LessonPreview.displayName = "LessonPreview";
