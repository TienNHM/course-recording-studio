import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { Dimensions } from "../config/layout";
import { fitElementSizeInContainer } from "../remotion/layout/fit-element";
import { useElementSize } from "./helpers/use-element-size";

export const CropIndicator: React.FC<{
  resolution: Dimensions;
}> = ({ resolution }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const elementSize = useElementSize(ref);

  const videoSize = useMemo(() => {
    return elementSize
      ? fitElementSizeInContainer({
          containerSize: elementSize,
          elementSize: resolution,
        })
      : null;
  }, [elementSize, resolution]);

  const cropIndicatorRect = useMemo(() => {
    return videoSize
      ? fitElementSizeInContainer({
          containerSize: videoSize,
          elementSize: {
            width: 350,
            height: 400,
          },
        })
      : null;
  }, [videoSize]);

  const cropIndicator: React.CSSProperties = useMemo(() => {
    return { ...cropIndicatorRect };
  }, [cropIndicatorRect]);

  return (
    <AbsoluteFill
      ref={ref}
      className="pointer-events-none overflow-hidden"
      aria-hidden
    >
      <AbsoluteFill style={videoSize ?? undefined}>
        <AbsoluteFill
          className="rounded-lg border-2 border-dashed border-primary shadow-[0_0_0_9999px_hsl(var(--background)/0.35)]"
          style={cropIndicator}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
