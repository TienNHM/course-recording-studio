import {
  Camera,
  Mic,
  Monitor,
  RefreshCw,
  ScreenShare,
  Settings2,
  VideoOff,
  X,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WEBCAM_PREFIX } from "../config/cameras";
import { CropIndicator } from "./CropIndicator";
import { RecordingStatus } from "./RecordButton";
import { ResolutionLimiter } from "./ResolutionLimiter";
import { ToggleRotate } from "./Rotate";
import { ResolutionAndFps, Stream } from "./Stream";
import { ToggleCrop } from "./ToggleCrop";
import { ToggleMirror } from "./ToggleMirror";
import { useDevices } from "./WaitingForDevices";
import { RescanDevices } from "./components/RescanDevices";
import { VolumeMeter } from "./components/VolumeMeter";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Tooltip } from "./components/ui/tooltip";
import { canRotateCamera } from "./helpers/can-rotate-camera";
import {
  MaxResolution,
  getMaxResolutionOfDevice,
} from "./helpers/get-max-resolution-of-device";
import {
  SizeConstraint,
  getSelectedVideoSource,
} from "./helpers/get-selected-video-source";
import { Prefix } from "./helpers/prefixes";
import { cn } from "./helpers/utils";
import { useFormat, useT } from "./i18n";
import {
  getPreferredDeviceIfExists,
  setPreferredDeviceForPrefix,
} from "./preferred-device-localstorage";
import { getPreferredResolutionForDevice } from "./preferred-resolution";
import {
  getDeviceLabel,
  pickDefaultMicrophone,
} from "./recording/device-label";
import { useMediaSources } from "./state/media-sources";

const localStorageKey = "showCropIndicator";
const mirrorLocalStorageKey = "mirrorCamera";

const SCREEN = "display-without-audio";
const SCREEN_WITH_AUDIO = "display-with-audio";
const NONE = "__none__";

const isScreenValue = (value: string | null) =>
  value === SCREEN || value === SCREEN_WITH_AUDIO;

const SLOT_ICONS: Record<Prefix, React.ReactNode> = {
  webcam: <Camera className="h-4 w-4" aria-hidden />,
  display: <Monitor className="h-4 w-4" aria-hidden />,
  alternative1: <Camera className="h-4 w-4" aria-hidden />,
  alternative2: <Camera className="h-4 w-4" aria-hidden />,
};

const readBoolean = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeBoolean = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable: the preference only lasts for this session
  }
};

/**
 * One recording source ("slot"): header with name + tools, live preview, and
 * device pickers (video + microphone for the slot that records audio).
 */
export const RecordingView: React.FC<{
  readonly prefix: Prefix;
  readonly recordingStatus: RecordingStatus;
  /** This slot records the microphone. */
  readonly recordAudio: boolean;
  /** The lesson's recording profile asks for this slot. */
  readonly required: boolean;
  /** Stream used by the level meter (may be a mic-only preview). */
  readonly meterStream: MediaStream | null;
  /** Shown for the webcam of a lesson that does not need one. */
  readonly onHide?: () => void;
}> = ({
  prefix,
  recordingStatus,
  recordAudio,
  required,
  meterStream,
  onHide,
}) => {
  const t = useT("recording");
  const { formatNumber } = useFormat();
  const { mediaSources, setAudioDevice, setVideoDevice } = useMediaSources();
  const mediaStream = mediaSources[prefix];
  const isRecording = recordingStatus.type === "recording";
  const locked = recordingStatus.type !== "idle";

  const [showCropIndicator, setShowCropIndicator] = useState(
    () => readBoolean(localStorageKey) === "true" && prefix === WEBCAM_PREFIX,
  );
  const [resolution, setResolution] = useState<ResolutionAndFps | null>(null);
  const [preferPortrait, setPreferPortrait] = useState(false);
  const [mirrorCamera, setMirrorCamera] = useState(() => {
    if (prefix !== WEBCAM_PREFIX) {
      return false;
    }

    // Mirrored by default for the webcam, unless the user changed it
    const saved = readBoolean(mirrorLocalStorageKey);
    return saved === null ? true : saved === "true";
  });
  const [sizeConstraint, setSizeConstraint] = useState<SizeConstraint>(() =>
    getPreferredResolutionForDevice(mediaStream.videoDevice),
  );
  const [resolutionLimiterOpen, setResolutionLimiterOpen] = useState(false);

  const devices = useDevices();
  const videoInputs = useMemo(
    () => devices.filter((d) => d.kind === "videoinput" && d.deviceId),
    [devices],
  );
  const audioInputs = useMemo(
    () => devices.filter((d) => d.kind === "audioinput" && d.deviceId),
    [devices],
  );

  // The microphone slot always has a microphone selected (automation:
  // nothing to set up for the common case).
  useEffect(() => {
    if (!recordAudio || mediaStream.audioDevice) {
      return;
    }

    const other: Prefix = prefix === "webcam" ? "display" : "webcam";
    const id = pickDefaultMicrophone(devices, [
      getPreferredDeviceIfExists(prefix, "audio", devices),
      getPreferredDeviceIfExists(other, "audio", devices),
    ]);
    if (id) {
      setAudioDevice(prefix, id);
    }
  }, [devices, mediaStream.audioDevice, prefix, recordAudio, setAudioDevice]);

  const activeVideoDevice = useMemo(
    () => devices.find((d) => d.deviceId === mediaStream.videoDevice),
    [devices, mediaStream.videoDevice],
  );

  const maxResolution = useMemo(
    () =>
      activeVideoDevice ? getMaxResolutionOfDevice(activeVideoDevice) : null,
    [activeVideoDevice],
  );

  const selectedVideoSource = useMemo(() => {
    if (mediaStream.videoDevice === SCREEN) {
      return { type: SCREEN } as const;
    }
    if (mediaStream.videoDevice === SCREEN_WITH_AUDIO) {
      return { type: SCREEN_WITH_AUDIO } as const;
    }
    if (!activeVideoDevice) {
      return null;
    }

    return getSelectedVideoSource({
      device: activeVideoDevice,
      resolutionConstraint: sizeConstraint,
      maxResolution,
    });
  }, [
    activeVideoDevice,
    maxResolution,
    mediaStream.videoDevice,
    sizeConstraint,
  ]);

  const isScreen = isScreenValue(mediaStream.videoDevice);
  const cameraLabel = (d: MediaDeviceInfo) =>
    getDeviceLabel(
      d,
      t("sources.cameraFallback", { index: videoInputs.indexOf(d) + 1 }),
    );
  const micLabel = (d: MediaDeviceInfo) =>
    getDeviceLabel(
      d,
      t("sources.micFallback", { index: audioInputs.indexOf(d) + 1 }),
    );

  const cameraRotateable = useMemo(
    () =>
      canRotateCamera({
        selectedSource: selectedVideoSource,
        preferPortrait,
        resolution,
      }),
    [preferPortrait, resolution, selectedVideoSource],
  );

  const onToggleCrop = useCallback(() => {
    setShowCropIndicator((prev) => {
      writeBoolean(localStorageKey, !prev);
      return !prev;
    });
  }, []);

  const onToggleRotate = useCallback(() => {
    setPreferPortrait((prev) => !prev);
  }, []);

  const onToggleMirror = useCallback(() => {
    setMirrorCamera((prev) => {
      writeBoolean(mirrorLocalStorageKey, !prev);
      return !prev;
    });
  }, []);

  const clear = useCallback(() => {
    setVideoDevice(prefix, null);
    setPreferredDeviceForPrefix(prefix, "video", null);
    setResolution(null);
  }, [prefix, setVideoDevice]);

  const onPickVideo = useCallback(
    (value: string) => {
      if (value === NONE) {
        clear();
        return;
      }

      setVideoDevice(prefix, value);
      if (!isScreenValue(value)) {
        setPreferredDeviceForPrefix(prefix, "video", value);
      }
    },
    [clear, prefix, setVideoDevice],
  );

  const pickScreen = useCallback(() => {
    if (mediaStream.videoDevice === SCREEN) {
      // Same value: reset first so the stream (and the picker) restarts.
      // The click's user activation is still valid in the next task.
      setVideoDevice(prefix, null);
      setTimeout(() => setVideoDevice(prefix, SCREEN), 0);
      return;
    }

    setVideoDevice(prefix, SCREEN);
  }, [mediaStream.videoDevice, prefix, setVideoDevice]);

  const onPickAudio = useCallback(
    (value: string) => {
      const id = value === NONE ? null : value;
      setAudioDevice(prefix, id);
      setPreferredDeviceForPrefix(prefix, "audio", id);
    },
    [prefix, setAudioDevice],
  );

  const canShowResolutionLimiter = Boolean(
    !isScreen && activeVideoDevice && maxResolution,
  );
  const live =
    isRecording &&
    mediaStream.streamState.type === "loaded" &&
    Boolean(mediaStream.videoDevice || mediaStream.audioDevice);
  const label = t(`sources.label.${prefix}`);
  const hasVideo = Boolean(mediaStream.videoDevice);

  return (
    <section
      aria-label={label}
      data-live={live}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow",
        live && "border-recording ring-2 ring-recording/40",
      )}
    >
      <header className="flex min-h-12 items-center gap-2 border-b px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {SLOT_ICONS[prefix]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-label">{label}</h3>
            {live ? (
              <Badge tone="recording" variant="soft" size="sm" pulse>
                {t("sources.live")}
              </Badge>
            ) : recordAudio ? (
              <Badge tone="primary" variant="soft" size="sm">
                {t("sources.micBadge")}
              </Badge>
            ) : required ? (
              <Badge tone="neutral" variant="outline" size="sm">
                {t("sources.requiredBadge")}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-caption text-muted-foreground">
            {resolution && hasVideo
              ? t("sources.resolution", {
                  width: resolution.width,
                  height: resolution.height,
                  fps: formatNumber(Math.round(resolution.fps * 100) / 100),
                })
              : t(`sources.hint.${prefix}`)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {prefix === WEBCAM_PREFIX && hasVideo ? (
            <ToggleCrop
              pressed={showCropIndicator}
              onPressedChange={onToggleCrop}
            />
          ) : null}
          {prefix === WEBCAM_PREFIX && activeVideoDevice ? (
            <ToggleMirror
              pressed={mirrorCamera}
              onPressedChange={onToggleMirror}
              disabled={locked}
            />
          ) : null}
          {cameraRotateable ? (
            <ToggleRotate
              pressed={preferPortrait}
              onPressedChange={onToggleRotate}
              disabled={locked}
            />
          ) : null}
          {canShowResolutionLimiter ? (
            <Tooltip content={t("sources.resolutionSettings")} side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("sources.resolutionSettings")}
                onClick={() => setResolutionLimiterOpen(true)}
                disabled={locked}
              >
                <Settings2 className="h-4 w-4" aria-hidden />
              </Button>
            </Tooltip>
          ) : null}
          {isScreen && !locked ? (
            <Tooltip content={t("sources.changeScreen")} side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("sources.changeScreen")}
                onClick={pickScreen}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </Button>
            </Tooltip>
          ) : null}
          {hasVideo && !locked ? (
            <Tooltip content={t("sources.clear")} side="bottom" align="end">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("sources.clear")}
                onClick={clear}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </Tooltip>
          ) : null}
          {onHide && !locked ? (
            <Tooltip
              content={t("sources.webcamOff.disable")}
              side="bottom"
              align="end"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("sources.webcamOff.disable")}
                onClick={onHide}
              >
                <VideoOff className="h-4 w-4" aria-hidden />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </header>

      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <Stream
          selectedAudioSource={mediaStream.audioDevice}
          selectedVideoSource={selectedVideoSource}
          recordAudio={recordAudio}
          setResolution={setResolution}
          prefix={prefix}
          preferPortrait={preferPortrait}
          mirror={mirrorCamera}
          clear={clear}
        />
        {showCropIndicator && resolution && hasVideo ? (
          <CropIndicator resolution={resolution} />
        ) : null}
        {!hasVideo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
              {prefix === "display" ? (
                <ScreenShare className="h-5 w-5" aria-hidden />
              ) : (
                <Camera className="h-5 w-5" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-label">{t("sources.emptyTitle")}</p>
              <p className="mx-auto max-w-xs text-balance text-caption text-muted-foreground">
                {prefix === "display"
                  ? t("sources.emptyScreenHint")
                  : t("sources.emptyHint")}
              </p>
            </div>
            {prefix === "display" && !locked ? (
              <Button size="sm" onClick={pickScreen}>
                <ScreenShare className="h-4 w-4" aria-hidden />
                {t("sources.pickScreen")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-caption text-muted-foreground">
            {t("sources.video")}
          </span>
          <Select
            value={mediaStream.videoDevice ?? undefined}
            onValueChange={onPickVideo}
            disabled={locked}
          >
            <SelectTrigger
              className="h-8 min-w-0 flex-1 text-caption"
              aria-label={`${label} · ${t("sources.video")}`}
            >
              <SelectValue placeholder={t("sources.choose")} />
            </SelectTrigger>
            <SelectContent>
              <SelectPrimitive.Group>
                <SelectPrimitive.Label className="py-1 pl-8 pr-2 text-overline uppercase text-muted-foreground">
                  {t("sources.screenGroup")}
                </SelectPrimitive.Label>
                <SelectItem value={SCREEN}>{t("sources.screen")}</SelectItem>
                <SelectItem value={SCREEN_WITH_AUDIO}>
                  {t("sources.screenWithAudio")}
                </SelectItem>
              </SelectPrimitive.Group>
              {videoInputs.length > 0 ? (
                <>
                  <SelectSeparator />
                  <SelectPrimitive.Group>
                    <SelectPrimitive.Label className="py-1 pl-8 pr-2 text-overline uppercase text-muted-foreground">
                      {t("sources.cameraGroup")}
                    </SelectPrimitive.Label>
                    {videoInputs.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {cameraLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectPrimitive.Group>
                </>
              ) : null}
              {hasVideo ? (
                <>
                  <SelectSeparator />
                  <SelectItem value={NONE}>{t("sources.none")}</SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        {recordAudio ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-caption text-muted-foreground">
                {t("sources.audio")}
              </span>
              <Select
                value={mediaStream.audioDevice ?? NONE}
                onValueChange={onPickAudio}
                disabled={locked}
              >
                <SelectTrigger
                  className="h-8 min-w-0 flex-1 text-caption"
                  aria-label={`${label} · ${t("sources.audio")}`}
                >
                  <SelectValue placeholder={t("sources.noAudio")} />
                </SelectTrigger>
                <SelectContent>
                  {audioInputs.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {micLabel(d)}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NONE}>{t("sources.noAudio")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex w-16 shrink-0 justify-end pr-1 text-muted-foreground">
                <Mic className="h-3.5 w-3.5" aria-hidden />
              </span>
              <VolumeMeter stream={meterStream} label={t("live.micLevel")} />
            </div>
          </>
        ) : null}
        {!locked ? (
          <div className="flex justify-end">
            <RescanDevices />
          </div>
        ) : null}
      </div>

      {canShowResolutionLimiter && activeVideoDevice ? (
        <ResolutionLimiter
          sizeConstraint={sizeConstraint}
          setSizeConstraint={setSizeConstraint}
          maxResolution={maxResolution as MaxResolution}
          deviceName={cameraLabel(activeVideoDevice)}
          deviceId={activeVideoDevice.deviceId}
          open={resolutionLimiterOpen}
          setOpen={setResolutionLimiterOpen}
        />
      ) : null}
    </section>
  );
};

/** Placeholder for the webcam slot of a lesson recorded without webcam. */
export const WebcamOffSlot: React.FC<{
  readonly onEnable: () => void;
  readonly disabled: boolean;
}> = ({ onEnable, disabled }) => {
  const t = useT("recording");
  return (
    <section
      aria-label={t("sources.label.webcam")}
      className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card/50 p-6 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <VideoOff className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h3 className="text-label">{t("sources.webcamOff.title")}</h3>
        <p className="mx-auto mt-1 max-w-xs text-balance text-caption text-muted-foreground">
          {t("sources.webcamOff.body")}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onEnable}
        disabled={disabled}
      >
        <Camera className="h-4 w-4" aria-hidden />
        {t("sources.webcamOff.enable")}
      </Button>
    </section>
  );
};
