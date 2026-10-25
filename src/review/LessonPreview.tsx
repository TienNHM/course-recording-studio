import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import React, { useCallback, useImperativeHandle, useRef } from "react";
import { LessonMain } from "../../remotion/lesson/LessonMain";
import type { LessonMetadata } from "./use-lesson-metadata";

// Positions are on the output timeline of the take content, i.e. without the
// intro card (0 = first kept frame of the take).
export type LessonPreviewHandle = {
  seekToOutputMs: (ms: number) => void;
  getOutputMs: () => number;
};

export const LessonPreview = React.forwardRef<
  LessonPreviewHandle,
  { readonly metadata: LessonMetadata }
>(({ metadata }, ref) => {
  const player = useRef<PlayerRef>(null);
  const introMs = metadata.props.info?.introDurationInMs ?? 0;
  const { fps, durationInFrames } = metadata;

  const seekToOutputMs = useCallback(
    (ms: number) => {
      const frame = Math.round(((ms + introMs) / 1000) * fps);
      player.current?.seekTo(
        Math.max(0, Math.min(durationInFrames - 1, frame)),
      );
    },
    [durationInFrames, fps, introMs],
  );

  const getOutputMs = useCallback(() => {
    const frame = player.current?.getCurrentFrame() ?? 0;
    return Math.max(0, (frame / fps) * 1000 - introMs);
  }, [fps, introMs]);

  useImperativeHandle(ref, () => ({ seekToOutputMs, getOutputMs }), [
    getOutputMs,
    seekToOutputMs,
  ]);

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
      acknowledgeRemotionLicense
      style={{
        width: "100%",
        aspectRatio: `${metadata.width} / ${metadata.height}`,
      }}
    />
  );
});
LessonPreview.displayName = "LessonPreview";
