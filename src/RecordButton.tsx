import { CameraIcon, MicIcon } from "lucide-react";
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
import { RecordCircle } from "./BlinkingCircle";
import { ProcessStatus } from "./components/ProcessingStatus";
import { Button } from "./components/ui/button";
import { Prefix } from "./helpers/prefixes";
import {
  FinishedRecording,
  startMediaRecorder,
} from "./helpers/start-media-recorder";
import { useKeyPress } from "./helpers/use-key-press";
import { ControlsMode, RecordingControls } from "./recording/RecordingControls";
import { RecoverTakeBanner } from "./recording/RecoverTakeBanner";
import {
  fetchFreeDiskBytes,
  formatGigabytes,
  LOW_DISK_SPACE_BYTES,
} from "./recording/disk-space";
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
  loadTakeManifests,
  removeTakeManifest,
  saveTakeManifest,
  TakeManifest,
} from "./recording/take-manifest";
import { useDocumentPip } from "./recording/use-document-pip";
import { useMediaSources } from "./state/media-sources";
import { visibleByDefault } from "./state/visible-views";

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
// every `type === "recording"` check (device pickers, top bar) keeps treating
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

const COUNTDOWN_SECONDS = 3;

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

export const RecordButton: React.FC<{
  recordingStatus: RecordingStatus;
  setRecordingStatus: React.Dispatch<React.SetStateAction<RecordingStatus>>;
  showAllViews: boolean;
  processingStatus: ProcessStatus | null;
  // Relative to public/, e.g. courses/<course>/<module>/<lesson>
  lessonPath: string | null;
}> = ({
  setRecordingStatus,
  recordingStatus,
  showAllViews,
  processingStatus,
  lessonPath,
}) => {
  const statusRef = useRef(recordingStatus);
  useLayoutEffect(() => {
    statusRef.current = recordingStatus;
  }, [recordingStatus]);
  const stoppingRef = useRef(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [chapterDraft, setChapterDraft] = useState("");
  const chapterDraftRef = useRef(chapterDraft);
  useLayoutEffect(() => {
    chapterDraftRef.current = chapterDraft;
  }, [chapterDraft]);

  // Takes left over from a previous session (crash, reload, not uploaded)
  const [recoverable, setRecoverable] = useState<TakeManifest[]>(() =>
    loadTakeManifests(),
  );
  const onRecoveredHandled = useCallback((id: string) => {
    setRecoverable((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const pip = useDocumentPip();

  const discardVideos = useCallback(async () => {
    if (recordingStatus.type !== "recording-finished") {
      throw new Error("Recording not finished");
    }
    for (const blob of recordingStatus.blobs) {
      await blob.releaseData();
    }
    removeTakeManifest(String(recordingStatus.startDate));

    setRecordingStatus({ type: "idle" });
  }, [recordingStatus, setRecordingStatus]);

  const mediaSources = useMediaSources().mediaSources;

  const activeSources = useMemo(() => {
    return Object.entries(mediaSources).filter(([prefix, source]) => {
      return (
        (showAllViews || visibleByDefault[prefix as Prefix]) &&
        source.streamState.type === "loaded"
      );
    });
  }, [mediaSources, showAllViews]);

  const videoDeviceCount = useMemo(() => {
    return activeSources.filter(([, source]) => {
      return source.videoDevice !== null;
    }).length;
  }, [activeSources]);
  const audioDeviceCount = useMemo(() => {
    return activeSources.filter(([, source]) => {
      return source.audioDevice !== null;
    }).length;
  }, [activeSources]);

  // Stream used by the level meter: prefer the webcam slot (microphone)
  const audioSource = useMemo(() => {
    const withAudio = activeSources
      .map(([prefix, source]) => ({ prefix, state: source.streamState }))
      .filter(
        ({ state }) =>
          state.type === "loaded" && state.stream.getAudioTracks().length > 0,
      );
    return (
      withAudio.find((s) => s.prefix === "webcam")?.state ??
      withAudio[0]?.state ??
      null
    );
  }, [activeSources]);

  const blockedReason = useMemo((): string | null => {
    const hasVideo = activeSources.some(
      ([, s]) =>
        s.streamState.type === "loaded" &&
        s.streamState.stream.getVideoTracks().length > 0,
    );
    if (!hasVideo) {
      return "Select a screen or webcam to record";
    }

    if (audioSource === null) {
      return "No audio: pick a microphone or share the screen with audio";
    }

    return null;
  }, [activeSources, audioSource]);

  const startRecording = useCallback(async () => {
    const startDate = Date.now();
    let recorders: CurrentRecorder[];
    try {
      recorders = (
        await Promise.all(
          activeSources.map(
            ([prefix, source]): Promise<CurrentRecorder | null> => {
              return startMediaRecorder({
                prefix: prefix as Prefix,
                source: source.streamState,
                timestamp: startDate,
              });
            },
          ),
        )
      ).filter(truthy);
    } catch (err) {
      console.error(err);
      pip.close();
      alert(`Could not start recording: ${(err as Error).message}`);
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
  }, [activeSources, lessonPath, pip, setRecordingStatus]);

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
  }, [pip]);

  // Must run inside a user gesture (click / key press): it opens the
  // floating Picture-in-Picture panel.
  const arm = useCallback(async () => {
    if (
      blockedReason !== null ||
      processingStatus !== null ||
      countdown !== null ||
      statusRef.current.type === "recording"
    ) {
      return;
    }

    const pipPromise = pip.open();

    const freeBytes = await fetchFreeDiskBytes();
    if (freeBytes !== null && freeBytes < LOW_DISK_SPACE_BYTES) {
      const proceed = window.confirm(
        `Only ${formatGigabytes(freeBytes)} of disk space is left. A long take may not fit. Record anyway?`,
      );
      if (!proceed) {
        await pipPromise;
        pip.close();
        return;
      }
    }

    setCountdown(COUNTDOWN_SECONDS);
  }, [blockedReason, countdown, pip, processingStatus]);

  const onStop = useCallback(async () => {
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
      });
    } catch (err) {
      console.error(err);
      setRecordingStatus({ type: "idle" });
      alert(
        `Recording failed: ${(err as Error).message}. Reload the page to recover what was recorded.`,
      );
    } finally {
      stoppingRef.current = false;
      pip.close();
    }
  }, [pip, setRecordingStatus]);

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
  }, [setRecordingStatus]);

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
    },
    [setRecordingStatus],
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
            onStop();
          },
          { once: true, signal: controller.signal },
        );
      }
    }

    return () => {
      controller.abort();
    };
  }, [recordingStatus, onStop]);

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

  const disabled = blockedReason !== null || processingStatus !== null;

  const onPressR = useCallback(() => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }

    if (statusRef.current.type === "recording") {
      onStop();
    } else if (statusRef.current.type === "idle") {
      arm();
    }
  }, [arm, cancelCountdown, countdown, onStop]);

  const onShortcut = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (countdown !== null) {
          cancelCountdown();
        }

        return;
      }

      if (statusRef.current.type !== "recording") {
        return;
      }

      if (key === "p") {
        togglePause();
      } else if (key === "m") {
        onMarker("important");
      } else if (key === "b") {
        onMarker("cut");
      } else if (key === "c") {
        onMarker("chapter");
      }
    },
    [cancelCountdown, countdown, onMarker, togglePause],
  );

  const shortcutKeys = useMemo(() => ["p", "m", "b", "c", "escape"], []);

  // In-page hotkeys
  useKeyPress({
    keys: ["r"],
    callback: onPressR,
    metaKey: false,
    shortcut: true,
  });
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

  const onDiscardAndRetake = useCallback(async () => {
    // Open the panel while we still have the user gesture
    await Promise.all([discardVideos(), arm()]);
  }, [arm, discardVideos]);

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
        onStop={onStop}
        onMarker={onMarker}
        onCancelCountdown={cancelCountdown}
        chapterDraft={chapterDraft}
        setChapterDraft={setChapterDraft}
        audioSource={audioSource}
      />
    ) : null;

  const pipPortal =
    pip.pipWindow && controlsMode
      ? createPortal(renderControls("panel"), pip.pipWindow.document.body)
      : null;

  if (controlsMode) {
    return (
      <>
        {renderControls("inline")}
        {pipPortal}
      </>
    );
  }

  return (
    <>
      <div title={disabled && blockedReason ? blockedReason : undefined}>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          title="Press R to start recording"
          className="flex flex-row items-center pl-3 pr-0 py-0"
          onClick={
            recordingStatus.type === "recording-finished"
              ? onDiscardAndRetake
              : arm
          }
        >
          <RecordCircle />
          <div className="w-2"></div>
          <div>
            {blockedReason
              ? blockedReason
              : recordingStatus.type === "recording-finished"
                ? "Discard and retake"
                : "Start recording"}
          </div>
          <div className="w-3"></div>
          {videoDeviceCount > 0 && !disabled && (
            <div className="flex flex-row items-center gap-1 border-l-[1px] h-full px-2">
              <CameraIcon className="w-5" />
              <div>{videoDeviceCount}</div>
            </div>
          )}
          {audioDeviceCount > 0 && !disabled && (
            <div className="flex flex-row items-center gap-1 border-l-[1px] h-full px-2">
              <MicIcon className="w-5" />
              <div>{audioDeviceCount}</div>
            </div>
          )}
        </Button>
      </div>
      {recordingStatus.type === "idle" ? (
        <RecoverTakeBanner
          manifests={recoverable}
          lessonPath={lessonPath}
          onHandled={onRecoveredHandled}
          disabled={processingStatus !== null}
        />
      ) : null}
    </>
  );
};
