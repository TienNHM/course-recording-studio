import React, { useMemo } from "react";
import { Sequence, useVideoConfig } from "remotion";
import { useCaptions } from "../../editor/captions-provider";
import { remapCaptions } from "../../../lesson/timeline";
import { calculateSrt } from "../helpers/calculate-srt";
import { SrtPreviewLine } from "./SrtPreviewLine";

export const SrtPreview: React.FC<{
  startFrame: number;
  // If set, only captions between startFrame and endFrame are shown,
  // exactly like in the emitted .srt file of the "lesson" composition.
  endFrame: number | null;
}> = ({ startFrame, endFrame }) => {
  const { fps } = useVideoConfig();
  const captions = useCaptions();

  const srt = useMemo(() => {
    if (endFrame !== null) {
      return calculateSrt({
        captions: remapCaptions(captions, [
          {
            startMs: (startFrame / fps) * 1000,
            endMs: (endFrame / fps) * 1000,
          },
        ]),
        startFrame: 0,
        fps,
      });
    }

    return calculateSrt({
      captions,
      startFrame,
      fps,
    });
  }, [captions, startFrame, endFrame, fps]);

  return (
    <>
      {srt.map((segment, index) => {
        const durationInFrames =
          ((segment.lastTimestampMs - segment.firstTimestampMs) / 1000) * fps;
        const from = (segment.firstTimestampMs / 1000) * fps;

        return (
          <Sequence
            key={index}
            durationInFrames={durationInFrames}
            from={from}
            showInTimeline={false}
            layout="none"
          >
            <SrtPreviewLine segment={segment} />
          </Sequence>
        );
      })}
    </>
  );
};
