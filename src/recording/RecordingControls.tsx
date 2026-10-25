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
import { VolumeMeter } from "../components/VolumeMeter";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Kbd, RecordingIndicator } from "../components/ui/misc";
import { cn } from "../helpers/utils";
import { useFormat, useT } from "../i18n";
import { defaultChapterTitle, MARKER_TYPES } from "./markers";
import { isClockPaused, PauseClock } from "./pause-clock";
import { RecordingTimer } from "./RecordingTimer";
import { SHORTCUT_LABELS } from "./shortcuts";

export type ControlsMode =
  | { type: "countdown"; secondsLeft: number }
  | { type: "recording"; clock: PauseClock; markers: Marker[] };

const MARKER_ICONS: Record<MarkerType, React.ReactNode> = {
  cut: <ScissorsIcon className="h-3.5 w-3.5" aria-hidden />,
  important: <StarIcon className="h-3.5 w-3.5" aria-hidden />,
  chapter: <BookmarkIcon className="h-3.5 w-3.5" aria-hidden />,
};

const MARKER_KEYS: Record<MarkerType, string> = {
  cut: SHORTCUT_LABELS.cut,
  important: SHORTCUT_LABELS.important,
  chapter: SHORTCUT_LABELS.chapter,
};

/**
 * Recording controls. Rendered in the floating Picture-in-Picture window
 * ("panel", compact, follows theme/palette/locale via useThemeMirror) and in
 * the recorder's side panel ("inline").
 */
export const RecordingControls: React.FC<{
  readonly mode: ControlsMode;
  readonly variant: "panel" | "inline";
  readonly onTogglePause: () => void;
  readonly onStop: () => void;
  readonly onMarker: (type: MarkerType) => void;
  readonly onCancelCountdown: () => void;
  readonly chapterDraft: string;
  readonly setChapterDraft: (value: string) => void;
  readonly micStream: MediaStream | null;
}> = ({
  mode,
  variant,
  onTogglePause,
  onStop,
  onMarker,
  onCancelCountdown,
  chapterDraft,
  setChapterDraft,
  micStream,
}) => {
  const t = useT("recording");
  const { formatDuration } = useFormat();
  const isPanel = variant === "panel";
  const chapterTitle = (n: number) =>
    t("markers.defaultChapter", { number: n });

  if (mode.type === "countdown") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 text-center",
          isPanel ? "h-screen p-4" : "py-2",
        )}
      >
        <div className="text-overline uppercase text-muted-foreground">
          {t("countdown.title")}
        </div>
        <div
          className={cn(
            "flex items-center justify-center rounded-full border-4 border-recording/30 font-bold text-recording timecode",
            isPanel ? "h-24 w-24 text-display" : "h-20 w-20 text-display",
          )}
          aria-hidden
        >
          {mode.secondsLeft}
        </div>
        <Button variant="outline" size="sm" onClick={onCancelCountdown}>
          {t("countdown.cancel")}
          <Kbd>{SHORTCUT_LABELS.cancel}</Kbd>
        </Button>
      </div>
    );
  }

  const paused = isClockPaused(mode.clock);
  const lastMarker = mode.markers.length
    ? mode.markers.reduce((a, b) => (b.timeMs >= a.timeMs ? b : a))
    : null;

  return (
    <div
      className={cn(
        "flex flex-col",
        isPanel ? "h-screen gap-2.5 p-3" : "gap-3",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <RecordingIndicator
          label={paused ? t("live.paused") : t("live.rec")}
          paused={paused}
        />
        <RecordingTimer
          clock={mode.clock}
          className={cn(
            "text-title font-semibold",
            paused ? "text-warning" : "text-foreground",
          )}
        />
      </div>

      {micStream ? (
        <VolumeMeter stream={micStream} label={t("live.micLevel")} />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTogglePause}
          aria-keyshortcuts="P"
        >
          {paused ? (
            <PlayIcon className="h-4 w-4" aria-hidden />
          ) : (
            <PauseIcon className="h-4 w-4" aria-hidden />
          )}
          {paused ? t("live.resume") : t("live.pause")}
          <Kbd>{SHORTCUT_LABELS.pause}</Kbd>
        </Button>
        <Button
          variant="recording"
          size="sm"
          onClick={onStop}
          aria-keyshortcuts="R"
        >
          <SquareIcon className="h-3.5 w-3.5 fill-current" aria-hidden />
          {t("live.stop")}
          <Kbd className="border-recording-foreground/30 bg-recording-foreground/15 text-recording-foreground">
            {SHORTCUT_LABELS.record}
          </Kbd>
        </Button>
      </div>

      <div
        className="grid grid-cols-3 gap-1.5"
        role="group"
        aria-label={t("live.markers")}
      >
        {MARKER_TYPES.map((type) => (
          <Button
            key={type}
            variant="secondary"
            size="xs"
            className="justify-between gap-1 px-2"
            onClick={() => onMarker(type)}
            aria-label={t("markers.add", {
              type: t(`markers.${type}`),
              key: MARKER_KEYS[type],
            })}
            aria-keyshortcuts={MARKER_KEYS[type]}
          >
            <span className="flex min-w-0 items-center gap-1">
              {MARKER_ICONS[type]}
              <span className="truncate">{t(`markers.${type}`)}</span>
            </span>
            <Kbd>{MARKER_KEYS[type]}</Kbd>
          </Button>
        ))}
      </div>

      <Input
        className="h-8 text-caption"
        placeholder={t("live.chapterPlaceholder", {
          title: defaultChapterTitle(mode.markers, chapterTitle),
        })}
        aria-label={t("live.chapterInput")}
        value={chapterDraft}
        onChange={(e) => setChapterDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onMarker("chapter");
          }
        }}
      />

      <div
        className={cn(
          "truncate text-caption text-muted-foreground",
          isPanel && "mt-auto",
        )}
      >
        {lastMarker
          ? `${t("live.markerCount", { count: mode.markers.length })} · ${t(
              "live.lastMarker",
              {
                title: lastMarker.title ?? t(`markers.${lastMarker.type}`),
                time: formatDuration(lastMarker.timeMs),
              },
            )}`
          : t("live.markerCount", { count: 0 })}
      </div>
    </div>
  );
};
