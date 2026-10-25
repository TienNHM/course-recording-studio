import {
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ProcessStatus } from "../components/ProcessingStatus";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { RecordingIndicator } from "../components/ui/misc";
import { Tooltip } from "../components/ui/tooltip";
import { Prefix, prefixes } from "../helpers/prefixes";
import { cn } from "../helpers/utils";
import { useFormat, useT } from "../i18n";
import {
  ActiveSource,
  isRecordingPaused,
  RecordingStatus,
  useRecordingSession,
} from "../RecordButton";
import { RecordingView, WebcamOffSlot } from "../RecordingView";
import { useCurrentLesson } from "../state/current-lesson";
import { StreamState, useMediaSources } from "../state/media-sources";
import { ConfirmDialog } from "./ConfirmDialog";
import { CountdownOverlay } from "./CountdownOverlay";
import { useRecentPeak } from "./audio-level";
import { useFreeDiskSpace } from "./disk-space";
import { LessonNotesPanel } from "./LessonNotesPanel";
import {
  canStartRecording,
  computePreflight,
  isSlotVisible,
  LOW_DISK_SPACE_BYTES,
  microphonePrefix,
  SourceSummary,
} from "./preflight";
import { PreflightPanel } from "./PreflightPanel";
import { RecorderHeader } from "./RecorderShell";
import { RecoverTakeBanner } from "./RecoverTakeBanner";
import { RecordingTimer } from "./RecordingTimer";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { SavedTake, SavedTakePanel, SaveTakePanel } from "./TakePanel";
import { loadTakeManifests, TakeManifest } from "./take-manifest";

const SHOW_ALTERNATIVES_KEY = "showAlternativeViews";
const NOTES_OPEN_KEY = "crs:recorder.notesOpen";
const SCREEN = "display-without-audio";
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

const readFlag = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
};

const writeFlag = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore: preference lasts for this session only
  }
};

const loadedStream = (state: StreamState) =>
  state.type === "loaded" ? state.stream : null;

const summarize = (state: StreamState, selected: boolean): SourceSummary => ({
  selected,
  loading: state.type === "loading",
  hasVideo: state.type === "loaded" && state.stream.getVideoTracks().length > 0,
});

/**
 * Audio-only stream of the selected microphone, so the level can be checked
 * before the screen is shared (the mic is combined with the screen stream).
 */
const useMicPreview = (deviceId: string | null) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!deviceId) {
      setStream(null);
      return;
    }

    let cancelled = false;
    let opened: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }

        opened = s;
        setStream(s);
      })
      .catch(() => setStream(null));

    return () => {
      cancelled = true;
      opened?.getTracks().forEach((track) => track.stop());
      setStream(null);
    };
  }, [deviceId]);
  return stream;
};

export const Recorder: React.FC<{
  readonly onBackToLibrary: () => void;
  readonly onReview: () => void;
}> = ({ onBackToLibrary, onReview }) => {
  const t = useT("recording");
  const { formatBytes } = useFormat();
  const { lesson, location, lessonPath } = useCurrentLesson();
  const { mediaSources, setVideoDevice } = useMediaSources();

  const webcamRequired = lesson?.recordingProfile.webcam ?? false;
  const microphoneRequired = lesson?.recordingProfile.microphone ?? true;
  const autoProcess = lesson?.postProduction.autoProcess ?? true;
  const micPrefix = microphonePrefix(webcamRequired);

  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>({
    type: "idle",
  });
  const [processing, setProcessing] = useState<ProcessStatus | null>(null);
  const [savedTake, setSavedTake] = useState<SavedTake | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(() =>
    readFlag(SHOW_ALTERNATIVES_KEY, false),
  );
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [notesOpen, setNotesOpenState] = useState(() =>
    readFlag(NOTES_OPEN_KEY, true),
  );
  const [recoverable, setRecoverable] =
    useState<TakeManifest[]>(loadTakeManifests);
  const disk = useFreeDiskSpace();
  const webcamShown = webcamRequired || webcamEnabled;

  const setNotesOpen = useCallback((open: boolean) => {
    setNotesOpenState(open);
    writeFlag(NOTES_OPEN_KEY, open);
  }, []);

  const toggleAlternatives = useCallback(() => {
    setShowAlternatives((prev) => {
      writeFlag(SHOW_ALTERNATIVES_KEY, !prev);
      return !prev;
    });
  }, []);

  const announce = useCallback((message: string) => {
    // Same text twice in a row is not re-announced: make it differ
    setAnnouncement((prev) =>
      prev === message ? `${message}${ZERO_WIDTH_SPACE}` : message,
    );
  }, []);

  const visiblePrefixes = useMemo(
    () =>
      prefixes.filter((p) =>
        isSlotVisible(p, { showAlternatives, webcamShown }),
      ),
    [showAlternatives, webcamShown],
  );

  const activeSources = useMemo((): ActiveSource[] => {
    return visiblePrefixes
      .map((prefix) => ({
        prefix,
        streamState: mediaSources[prefix].streamState,
      }))
      .filter((s) => s.streamState.type === "loaded");
  }, [mediaSources, visiblePrefixes]);

  const micSlot = mediaSources[micPrefix];
  const micSlotStream = loadedStream(micSlot.streamState);
  const micSlotHasAudio = Boolean(micSlotStream?.getAudioTracks().length);
  const previewStream = useMicPreview(
    recordingStatus.type === "idle" && !micSlotHasAudio
      ? micSlot.audioDevice
      : null,
  );
  // Any recorded stream with audio (e.g. "screen + system audio")
  const otherAudioStream = useMemo(() => {
    for (const s of activeSources) {
      const stream = loadedStream(s.streamState);
      if (stream && stream.getAudioTracks().length > 0) {
        return stream;
      }
    }

    return null;
  }, [activeSources]);
  const micStream = micSlotHasAudio
    ? micSlotStream
    : (previewStream ?? otherAudioStream);
  const micPeak = useRecentPeak(micStream);

  const hasAudio = otherAudioStream !== null;
  const anyVideo = activeSources.some(
    (s) => (loadedStream(s.streamState)?.getVideoTracks().length ?? 0) > 0,
  );

  const preflightInput = {
    serverEnabled: Boolean(window.remotionServerEnabled),
    hasLesson: lessonPath !== null,
    webcamRequired,
    microphoneRequired,
    micSelected:
      Boolean(micSlot.audioDevice) ||
      micSlot.videoDevice === "display-with-audio",
    hasAudio,
    micPeak,
    screen: summarize(
      mediaSources.display.streamState,
      Boolean(mediaSources.display.videoDevice),
    ),
    webcam: webcamShown
      ? summarize(
          mediaSources.webcam.streamState,
          Boolean(mediaSources.webcam.videoDevice),
        )
      : { selected: false, loading: false, hasVideo: false },
    anyVideo,
    freeDiskBytes: disk.freeBytes,
    diskChecked: disk.checked,
  };
  const checks = computePreflight(preflightInput);
  const canStart = canStartRecording(preflightInput);

  const onArmed = useCallback(() => {
    setSavedTake(null);
    setError(null);
  }, []);

  const session = useRecordingSession({
    recordingStatus,
    setRecordingStatus,
    activeSources,
    micStream,
    lessonPath,
    canStart,
    busy: processing !== null || recordingStatus.type === "recording-finished",
    lowDisk: disk.freeBytes !== null && disk.freeBytes < LOW_DISK_SPACE_BYTES,
    onArmed,
    onError: setError,
    announce,
  });

  const pickScreen = useCallback(() => {
    if (mediaSources.display.videoDevice === SCREEN) {
      setVideoDevice("display", null);
      setTimeout(() => setVideoDevice("display", SCREEN), 0);
      return;
    }

    setVideoDevice("display", SCREEN);
  }, [mediaSources.display.videoDevice, setVideoDevice]);

  const onRecoveredHandled = useCallback((id: string) => {
    setRecoverable((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const phase = session.phase;
  const live = recordingStatus.type === "recording";
  const paused = isRecordingPaused(recordingStatus);
  const locked = phase !== "idle" || processing !== null;

  const renderSlot = (prefix: Prefix) => {
    if (prefix === "webcam" && !webcamShown) {
      return (
        <WebcamOffSlot
          key={prefix}
          onEnable={() => setWebcamEnabled(true)}
          disabled={locked}
        />
      );
    }

    return (
      <RecordingView
        key={prefix}
        prefix={prefix}
        recordingStatus={recordingStatus}
        recordAudio={prefix === micPrefix}
        required={prefix === "webcam" && webcamRequired}
        meterStream={prefix === micPrefix ? micStream : null}
        onHide={
          prefix === "webcam" && !webcamRequired
            ? () => setWebcamEnabled(false)
            : undefined
        }
      />
    );
  };

  const slotOrder: Prefix[] = [
    "display",
    "webcam",
    "alternative1",
    "alternative2",
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <RecorderHeader
        backDisabled={locked}
        actions={
          <>
            {live ? (
              <span className="hidden items-center gap-2 sm:flex">
                <RecordingIndicator
                  label={paused ? t("live.paused") : t("live.rec")}
                  paused={paused}
                />
                {recordingStatus.type === "recording" ? (
                  <RecordingTimer
                    clock={recordingStatus.ongoing.clock}
                    className="text-label"
                  />
                ) : null}
              </span>
            ) : null}
            <ShortcutsHelp />
            <Tooltip
              content={
                notesOpen ? t("header.hideNotes") : t("header.showNotes")
              }
              side="bottom"
              align="end"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  notesOpen ? t("header.hideNotes") : t("header.showNotes")
                }
                aria-pressed={notesOpen}
                onClick={() => setNotesOpen(!notesOpen)}
              >
                {notesOpen ? (
                  <PanelRightClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelRightOpen className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </Tooltip>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            {phase === "idle" && processing === null ? (
              <RecoverTakeBanner
                manifests={recoverable}
                lessonPath={lessonPath}
                onHandled={onRecoveredHandled}
                disabled={false}
              />
            ) : null}
            <h2 className="sr-only">{t("sources.title")}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {slotOrder
                .filter((p) => p === "webcam" || visiblePrefixes.includes(p))
                .map(renderSlot)}
            </div>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAlternatives}
                disabled={locked}
                aria-expanded={showAlternatives}
              >
                {showAlternatives ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
                {showAlternatives ? t("sources.fewer") : t("sources.more")}
              </Button>
            </div>
          </div>
        </main>

        <aside
          className="flex w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-background p-4"
          aria-label={t("preflight.title")}
        >
          {error ? (
            <Alert
              tone="destructive"
              title={t("errors.title")}
              action={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setError(null)}
                >
                  {t("errors.dismiss")}
                </Button>
              }
            >
              {error}
            </Alert>
          ) : null}

          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            {session.controlsMode ? (
              <div className="flex flex-col gap-3">
                {session.renderControls("inline")}
                <p className="text-caption text-muted-foreground">
                  {session.pipSupported
                    ? t("live.pipHint")
                    : t("live.pipUnsupported")}
                </p>
              </div>
            ) : recordingStatus.type === "recording-finished" ? (
              <SaveTakePanel
                status={recordingStatus}
                setRecordingStatus={setRecordingStatus}
                processing={processing}
                setProcessing={setProcessing}
                onSaved={setSavedTake}
                announce={announce}
              />
            ) : savedTake ? (
              <SavedTakePanel
                take={savedTake}
                onBackToLibrary={onBackToLibrary}
                onRecordAnother={() => setSavedTake(null)}
                onReview={onReview}
              />
            ) : (
              <PreflightPanel
                checks={checks}
                canStart={canStart}
                location={location}
                freeDiskBytes={disk.freeBytes}
                micSourceLabel={t(`sources.label.${micPrefix}`)}
                autoProcess={autoProcess}
                onStart={() => session.arm()}
                onPickScreen={pickScreen}
                onChooseLesson={onBackToLibrary}
                busy={processing !== null}
              />
            )}
          </div>

          {notesOpen ? (
            <LessonNotesPanel
              open
              onOpenChange={setNotesOpen}
              className={cn(live && "min-h-[16rem] flex-1")}
            />
          ) : null}
        </aside>
      </div>

      {session.countdown !== null ? (
        <CountdownOverlay
          secondsLeft={session.countdown}
          onCancel={session.cancelCountdown}
        />
      ) : null}
      {session.pipPortal}
      <ConfirmDialog
        open={session.diskConfirmOpen}
        onOpenChange={session.setDiskConfirmOpen}
        title={t("disk.confirmTitle")}
        description={t("disk.confirmBody", {
          free: disk.freeBytes === null ? "" : formatBytes(disk.freeBytes),
        })}
        confirmLabel={t("disk.confirm")}
        onConfirm={session.confirmLowDisk}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
};
