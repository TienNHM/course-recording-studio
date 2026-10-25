import React, { useEffect, useRef, useState } from "react";
import { cn } from "../helpers/utils";
import { useFormat } from "../i18n";
import { elapsedMediaMs, PauseClock } from "./pause-clock";

// Shows the media time of the take (paused time excluded).
export const RecordingTimer: React.FC<{
  readonly clock: PauseClock;
  readonly className?: string;
}> = ({ clock, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const { formatDuration } = useFormat();

  useEffect(() => {
    // Schedule on the window that displays the timer: when shown in the
    // Picture-in-Picture panel, the main tab may be hidden and throttled.
    const win = ref.current?.ownerDocument.defaultView ?? window;
    const int = win.setInterval(() => setNow(Date.now()), 250);
    return () => win.clearInterval(int);
  }, []);

  return (
    <span ref={ref} className={cn("timecode", className)}>
      {formatDuration(elapsedMediaMs(clock, Math.max(now, clock.startedAt)))}
    </span>
  );
};
