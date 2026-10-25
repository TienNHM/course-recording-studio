import React, { useRef } from "react";
import { cn } from "../helpers/utils";
import { meterPosition, useAudioLevel } from "../recording/audio-level";

const SEGMENTS = 16;
// Segments from this index on are "loud" (warning tone).
const LOUD_FROM = 13;

/**
 * Segmented microphone level meter. Tokens only: success for normal speech,
 * warning when close to clipping.
 */
export const VolumeMeter: React.FC<{
  readonly stream: MediaStream | null;
  /** Accessible name, e.g. t("live.micLevel"). */
  readonly label: string;
  readonly className?: string;
}> = ({ stream, label, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const level = useAudioLevel(stream, ref);
  const position = meterPosition(level);
  const lit = Math.round(position * SEGMENTS);

  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      className={cn("flex h-2 w-full items-stretch gap-0.5", className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[1px] transition-colors duration-75",
            i >= lit
              ? "bg-foreground/10"
              : i >= LOUD_FROM
                ? "bg-warning"
                : "bg-success",
          )}
        />
      ))}
    </div>
  );
};
