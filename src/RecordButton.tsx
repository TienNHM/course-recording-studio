import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Marker, MarkerType } from "../config/course";
import { FPS } from "../config/fps";
import { truthy } from "../remotion/helpers/truthy";
import { Prefix } from "./helpers/prefixes";
import {
  FinishedRecording,
  startMediaRecorder,
} from "./helpers/start-media-recorder";
import { useKeyPress } from "./helpers/use-key-press";
import { useT } from "./i18n";
import { ControlsMode, RecordingControls } from "./recording/RecordingControls";
import { addMarker, createMarker } from "./recording/markers";
import {
  createPauseClock,
  elapsedMediaMs,
  expectedFramesForDuration,
  isClockPaused,
  PauseClock,
  pauseClock,
  resumeClock,
  totalPausedMs,
} from "./recording/pause-clock";
import {
  RecorderPhase,
  resolveShortcut,
  SHORTCUT_KEYS,
} from "./recording/shortcuts";
import { saveTakeManifest, TakeManifest } from "./recording/take-manifest";
import { useDocumentPip } from "./recording/use-document-pip";
import { StreamState } from "./state/media-sources";
import { useThemeMirror } from "./theme/PreferencesProvider";

export type CurrentRecorder = {
  recorder: MediaRecorder;
  stopAndWaitUntilDone: () => Promise<FinishedRecording>;
  mimeType: string;
  prefix: Prefix;
  // Name of the recording in the Origin Private File System
  filename: string;
  pause: () => void;
  resume: () => void;
};

// "Paused" is a sub-state of "recording" (see `isRecordingPaused()`), so that
// every `type === "recording"` check (device pickers, header) keeps treating
// a paused take as in progress.
export type RecordingStatus =
  | {
      type: "idle";
    }
  | {
      type: "recording";
      ongoing: OngoingRecording;
    }
  | {
      type: "recording-finished";
      blobs: FinishedRecording[];
      // Media duration, paused time excluded
      expectedFrames: number;
      durationMs: number;
      pausedMs: number;
      // Take id = String(endDate)
      endDate: number;
      // Timestamp in the OPFS file names = take manifest id
      startDate: number;
      // Wall-clock time the recorders started
      startedAt: number;
      markers: Marker[];
      // Lesson the take was recorded for
      lessonPath: string | null;
    };

export type OngoingRecording = {
  startDate: number;
  recorders: CurrentRecorder[];
  clock: PauseClock;
  markers: Marker[];
  lessonPath: string | null;
};

export const isRecordingPaused = (status: RecordingStatus) =>
  status.type === "recording" && isClockPaused(status.ongoing.clock);

export const COUNTDOWN_SECONDS = 3;

const manifestFromOngoing = (
  ongoing: OngoingRecording,
  extra: Partial<TakeManifest> = {},
): TakeManifest => ({
  version: 1,
  id: String(ongoing.startDate),
  lessonPath: ongoing.lessonPath,
  startDate: ongoing.startDate,
  clock: ongoing.clock,
  markers: ongoing.markers,
  sources: ongoing.recorders.map((r) => ({
    prefix: r.prefix,
    filename: r.filename,
    mimeType: r.mimeType,
  })),
  lastAliveAt: Date.now(),
  takeId: null,
  endedAt: null,
  durationMs: null,
  ...extra,
});

export type ActiveSource = {
  readonly prefix: Prefix;
  readonly streamState: StreamState;
};

/**
 * The recording session: countdown, MediaRecorders, pause clock, markers,
 * floating Picture-in-Picture panel and keyboard shortcuts. The recorder UI
 * (src/recording/Recorder.tsx) renders the returned state.
 */
export const useRecordingSession = ({
  recordingStatus,
  setRecordingStatus,
  activeSources,
  micStream,
  lessonPath,
  canStart,
  busy,
  lowDisk,
  onArmed,
  onError,
  announce,
}: {
  recordingStatus: RecordingStatus;
  setRecordingStatus: React.Dispatch<React.SetStateAction<RecordingStatus>>;
  // Visible slots with a live stream: they are all recorded
  activeSources: readonly ActiveSource[];
  micStream: MediaStream | null;
  // Relative to public/, e.g. courses/<course>/<module>/<lesson>
  lessonPath: string | null;
  canStart: boolean;
  // A take is being saved: no new recording until it's done
  busy: boolean;
  lowDisk: boolean;
  onArmed: () => void;
  onError: (message: string) => void;
  announce: (message: string) => void;
}) => {
  const t = useT("recording");
  const statusRef = useRef(recordingStatus);
  useLayoutEffect(() => {
    statusRef.current = recordingStatus;
  }, [recordingStatus]);
  const stoppingRef = useRef(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [diskConfirmOpen, setDiskConfirmOpen] = useState(false);
  const [chapterDraft, setChapterDraft] = useState("");
  const chapterDraftRef = useRef(chapterDraft);
  useLayoutEffect(() => {
    chapterDraftRef.current = chapterDraft;
  }, [chapterDraft]);

  const pip = useDocumentPip(t("live.pipTitle"));
  // The PiP window follows mode / palette / language live
  useThemeMirror(pip.pipWindow?.document ?? null);

  const formatChapterTitle = useCallback(
    (n: number) => t("markers.defaultChapter", { number: n }),
    [t],
  );

  const startRecording = useCallback(async () => {
    const startDate = Date.now();
    let recorders: CurrentRecorder[];
    try {
      recorders = (
        await Promise.all(
          activeSources.map(
            ({ prefix, streamState }): Promise<CurrentRecorder | null> => {
              return startMediaRecorder({
                prefix,
                source: streamState,
                timestamp: startDate,
              });
            },
          ),
        )
      ).filter(truthy);
    } catch (err) {
      console.error(err);
      pip.close();
      onError(t("errors.startFailed", { message: (err as Error).message }));
      return;
    }

    const ongoing: OngoingRecording = {
      recorders,
      startDate,
      clock: createPauseClock(Date.now()),
      markers: [],
      lessonPath,
    };
    saveTakeManifest(manifestFromOngoing(ongoing));
    setChapterDraft("");
    setRecordingStatus({ type: "recording", ongoing });
    announce(t("announce.started"));
  }, [
    activeSources,
    announce,
    lessonPath,
    onError,
    pip,
    setRecordingStatus,
    t,
  ]);

  // Countdown before the recorders actually start
  useEffect(() => {
    if (countdown === null) {
      return;
    }

    const timeout = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [countdown, startRecording]);

  const cancelCountdown = useCallback(() => {
    setCountdown(null);
    pip.close();
    announce(t("announce.cancelled"));
  }, [announce, pip, t]);

  // Must run inside a user gesture (click / key press): it opens the
  // floating Picture-in-Picture panel.
  const arm = useCallback(
    (options: { ignoreLowDisk?: boolean } = {}) => {
      if (
        !canStart ||
        busy ||
        countdown !== null ||
        statusRef.current.type === "recording"
      ) {
        return;
      }

      if (lowDisk && !options.ignoreLowDisk) {
        setDiskConfirmOpen(true);
        return;
      }

      pip.open();
      onArmed();
      setCountdown(COUNTDOWN_SECONDS);
      announce(t("announce.countdown", { seconds: COUNTDOWN_SECONDS }));
    },
    [announce, busy, canStart, countdown, lowDisk, onArmed, pip, t],
  );

  const confirmLowDisk = useCallback(() => {
    arm({ ignoreLowDisk: true });
  }, [arm]);

  const stop = useCallback(async () => {
    const current = statusRef.current;
    if (current.type !== "recording" || stoppingRef.current) {
      return;
    }

    stoppingRef.current = true;
    const stopRequestedAt = Date.now();

    try {
      const blobs = await Promise.all(
        current.ongoing.recorders.map((r) => r.stopAndWaitUntilDone()),
      );

      // Markers may have been added while waiting for the recorders
      const latest =
        statusRef.current.type === "recording"
          ? statusRef.current.ongoing
          : current.ongoing;
      const endDate = Date.now();
      const durationMs = Math.round(
        elapsedMediaMs(latest.clock, stopRequestedAt),
      );

      saveTakeManifest(
        manifestFromOngoing(latest, {
          takeId: String(endDate),
          endedAt: endDate,
          durationMs,
        }),
      );

      setRecordingStatus({
        type: "recording-finished",
        blobs,
        expectedFrames: expectedFramesForDuration(durationMs, FPS),
        durationMs,
        pausedMs: totalPausedMs(latest.clock, stopRequestedAt),
        endDate,
        startDate: latest.startDate,
        startedAt: latest.clock.startedAt,
        markers: latest.markers,
        lessonPath: latest.lessonPath,
      });
      announce(t("announce.stopped"));
    } catch (err) {
      console.error(err);
      setRecordingStatus({ type: "idle" });
      onError(t("errors.recordingFailed", { message: (err as Error).message }));
    } finally {
      stoppingRef.current = false;
      pip.close();
    }
  }, [announce, onError, pip, setRecordingStatus, t]);

  const togglePause = useCallback(() => {
    const current = statusRef.current;
    if (current.type !== "recording" || stoppingRef.current) {
      return;
    }

    const now = Date.now();
    const wasPaused = isClockPaused(current.ongoing.clock);
    for (const r of current.ongoing.recorders) {
      if (wasPaused) {
        r.resume();
      } else {
        r.pause();
      }
    }

    setRecordingStatus((prev) => {
      if (prev.type !== "recording") {
        return prev;
      }

      const clock = wasPaused
        ? resumeClock(prev.ongoing.clock, now)
        : pauseClock(prev.ongoing.clock, now);
      return { ...prev, ongoing: { ...prev.ongoing, clock } };
    });
    announce(wasPaused ? t("announce.resumed") : t("announce.paused"));
  }, [announce, setRecordingStatus, t]);

  const onMarker = useCallback(
    (type: MarkerType) => {
      if (statusRef.current.type !== "recording") {
        return;
      }

      const now = Date.now();
      const title = type === "chapter" ? chapterDraftRef.current : undefined;
      setRecordingStatus((prev) => {
        if (prev.type !== "recording") {
          return prev;
        }

        const marker = createMarker({
          type,
          clock: prev.ongoing.clock,
          now,
          existing: prev.ongoing.markers,
          title,
          formatChapterTitle,
        });
        return {
          ...prev,
          ongoing: {
            ...prev.ongoing,
            markers: addMarker(prev.ongoing.markers, marker),
          },
        };
      });
      if (type === "chapter") {
        setChapterDraft("");
      }

      announce(t("announce.marker", { type: t(`markers.${type}`) }));
    },
    [announce, formatChapterTitle, setRecordingStatus, t],
  );

  // Keep the recovery manifest up to date while recording
  useEffect(() => {
    if (recordingStatus.type !== "recording") {
      return;
    }

    const { ongoing } = recordingStatus;
    const write = () => saveTakeManifest(manifestFromOngoing(ongoing));
    write();
    const interval = setInterval(write, 5000);
    return () => clearInterval(interval);
  }, [recordingStatus]);

  // A source that ends (screen sharing stopped from the browser bar, camera
  // unplugged) stops the take.
  useEffect(() => {
    if (recordingStatus.type !== "recording") {
      return;
    }

    const controller = new AbortController();

    for (const rec of recordingStatus.ongoing.recorders) {
      for (const track of rec.recorder.stream.getTracks()) {
        track.addEventListener(
          "ended",
          () => {
            stop();
          },
          { once: true, signal: controller.signal },
        );
      }
    }

    return () => {
      controller.abort();
    };
  }, [recordingStatus, stop]);

  // Stop the recorders only when the component goes away (not on every
  // status change, e.g. pause or a new marker).
  useEffect(() => {
    return () => {
      const current = statusRef.current;
      if (current.type === "recording") {
        current.ongoing.recorders.forEach((r) => {
          r.stopAndWaitUntilDone();
        });
      }
    };
  }, []);

  const phase: RecorderPhase =
    countdown !== null
      ? "countdown"
      : recordingStatus.type === "recording"
        ? "recording"
        : recordingStatus.type === "recording-finished"
          ? "finished"
          : "idle";

  const onShortcut = useCallback(
    (event: KeyboardEvent) => {
      const action = resolveShortcut(event.key, phase);
      switch (action) {
        case "start":
          arm();
          break;
        case "stop":
          stop();
          break;
        case "cancelCountdown":
          cancelCountdown();
          break;
        case "togglePause":
          togglePause();
          break;
        case "markImportant":
          onMarker("important");
          break;
        case "markCut":
          onMarker("cut");
          break;
        case "markChapter":
          onMarker("chapter");
          break;
        default:
          return;
      }

      event.preventDefault();
    },
    [arm, cancelCountdown, onMarker, phase, stop, togglePause],
  );

  const shortcutKeys = useMemo(() => [...SHORTCUT_KEYS], []);

  // In-page hotkeys
  useKeyPress({
    keys: shortcutKeys,
    callback: onShortcut,
    metaKey: false,
    shortcut: true,
  });
  // Same hotkeys inside the floating panel
  useKeyPress({
    keys: shortcutKeys,
    callback: onShortcut,
    metaKey: false,
    shortcut: true,
    target: pip.pipWindow?.document ?? null,
    enabled: pip.pipWindow !== null,
  });

  const controlsMode: ControlsMode | null =
    countdown !== null
      ? { type: "countdown", secondsLeft: countdown }
      : recordingStatus.type === "recording"
        ? {
            type: "recording",
            clock: recordingStatus.ongoing.clock,
            markers: recordingStatus.ongoing.markers,
          }
        : null;

  const renderControls = (variant: "panel" | "inline") =>
    controlsMode ? (
      <RecordingControls
        mode={controlsMode}
        variant={variant}
        onTogglePause={togglePause}
        onStop={stop}
        onMarker={onMarker}
        onCancelCountdown={cancelCountdown}
        chapterDraft={chapterDraft}
        setChapterDraft={setChapterDraft}
        micStream={micStream}
      />
    ) : null;

  const pipPortal =
    pip.pipWindow && controlsMode
      ? createPortal(renderControls("panel"), pip.pipWindow.document.body)
      : null;

  return {
    phase,
    countdown,
    arm,
    stop,
    cancelCountdown,
    togglePause,
    onMarker,
    controlsMode,
    renderControls,
    pipPortal,
    pipSupported: pip.supported,
    pipOpen: pip.pipWindow !== null,
    diskConfirmOpen,
    setDiskConfirmOpen,
    confirmLowDisk,
  };
};
