import {
  BookmarkIcon,
  PauseIcon,
  PlayIcon,
  ScissorsIcon,
  SquareIcon,
  StarIcon,
} from "lucide-react";
import React from "react";
import type { Marker, MarkerType } from "../../config/course";
import { BlinkingCircle } from "../BlinkingCircle";
import { Button } from "../components/ui/button";
import { VolumeMeter } from "../components/VolumeMeter";
import { formatMilliseconds } from "../helpers/format-time";
import { StreamState } from "../state/media-sources";
import { defaultChapterTitle, MARKER_LABELS } from "./markers";
import { isClockPaused, PauseClock } from "./pause-clock";
import { RecordingTimer } from "./RecordingTimer";

export type ControlsMode =
  | { type: "countdown"; secondsLeft: number }
  | { type: "recording"; clock: PauseClock; markers: Marker[] };

const MARKER_ICONS: Record<MarkerType, React.ReactNode> = {
  cut: <ScissorsIcon className="w-4" />,
  important: <StarIcon className="w-4" />,
  chapter: <BookmarkIcon className="w-4" />,
};

const MARKER_KEYS: Record<MarkerType, string> = {
  cut: "B",
  important: "M",
  chapter: "C",
};

const PausedIcon: React.FC = () => (
  <PauseIcon className="w-4 text-yellow-400" aria-label="Paused" />
);

// The recording controls. Rendered in the floating Picture-in-Picture panel
// ("panel") and, as a fallback, inside the page ("inline").
export const RecordingControls: React.FC<{
  readonly mode: ControlsMode;
  readonly variant: "panel" | "inline";
  readonly onTogglePause: () => void;
  readonly onStop: () => void;
  readonly onMarker: (type: MarkerType) => void;
  readonly onCancelCountdown: () => void;
  readonly chapterDraft: string;
  readonly setChapterDraft: (value: string) => void;
  readonly audioSource: StreamState | null;
}> = ({
  mode,
  variant,
  onTogglePause,
  onStop,
  onMarker,
  onCancelCountdown,
  chapterDraft,
  setChapterDraft,
  audioSource,
}) => {
  const isPanel = variant === "panel";

  if (mode.type === "countdown") {
    return (
      <div
        className={
          isPanel
            ? "flex flex-col items-center justify-center gap-3 p-4 h-screen"
            : "flex flex-row items-center gap-3"
        }
      >
        <div className={isPanel ? "text-5xl font-bold" : "text-lg font-bold"}>
          {mode.secondsLeft}
        </div>
        <div className="text-sm text-muted-foreground">
          Recording starts soon
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelCountdown}
          title="Esc"
        >
          Cancel
        </Button>
      </div>
    );
  }

  const paused = isClockPaused(mode.clock);
  const lastMarker = mode.markers.length
    ? mode.markers.reduce((a, b) => (b.timeMs >= a.timeMs ? b : a))
    : null;

  const markerButtons = (["cut", "important", "chapter"] as const).map(
    (type) => (
      <Button
        key={type}
        variant="secondary"
        size="sm"
        className="gap-1 px-2"
        onClick={() => onMarker(type)}
        title={`${MARKER_LABELS[type]} marker (${MARKER_KEYS[type]})`}
      >
        {MARKER_ICONS[type]}
        {isPanel ? MARKER_LABELS[type] : null}
        <kbd className="text-xs opacity-60">{MARKER_KEYS[type]}</kbd>
      </Button>
    ),
  );

  const chapterInput = (
    <input
      className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0 flex-1"
      placeholder={defaultChapterTitle(mode.markers)}
      value={chapterDraft}
      onChange={(e) => setChapterDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onMarker("chapter");
        }
      }}
      title="Title for the next chapter marker (Enter to add)"
      style={{ width: isPanel ? undefined : 130 }}
    />
  );

  const status = (
    <div className="flex flex-row items-center gap-2">
      {paused ? <PausedIcon /> : <BlinkingCircle />}
      <span
        className={paused ? "text-yellow-400 font-semibold" : "font-semibold"}
      >
        {paused ? "Paused" : "Rec"}
      </span>
      <RecordingTimer
        clock={mode.clock}
        className={isPanel ? "text-2xl font-mono" : "font-mono"}
      />
    </div>
  );

  const transport = (
    <div className="flex flex-row items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={onTogglePause}
        title="Pause / resume (P)"
      >
        {paused ? <PlayIcon className="w-4" /> : <PauseIcon className="w-4" />}
        {paused ? "Resume" : "Pause"}
        <kbd className="text-xs opacity-60">P</kbd>
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1"
        onClick={onStop}
        title="Stop recording"
      >
        <SquareIcon className="w-4" />
        Stop
      </Button>
    </div>
  );

  if (!isPanel) {
    return (
      <div className="flex flex-row items-center gap-2 flex-wrap">
        {status}
        {transport}
        {markerButtons}
        {chapterInput}
        {mode.markers.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {mode.markers.length} marker{mode.markers.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-row items-center justify-between gap-2">
        {status}
        {transport}
      </div>
      <div className="flex flex-row items-center gap-2">{markerButtons}</div>
      <div className="flex flex-row items-center gap-2">{chapterInput}</div>
      {audioSource ? <VolumeMeter mediaStream={audioSource} /> : null}
      <div className="text-xs text-muted-foreground truncate">
        {lastMarker
          ? `${mode.markers.length} marker${mode.markers.length === 1 ? "" : "s"} · last: ${
              lastMarker.title ?? MARKER_LABELS[lastMarker.type]
            } @ ${formatMilliseconds(lastMarker.timeMs)}`
          : "Keys: P pause · B cut · M important · C chapter"}
      </div>
    </div>
  );
};
