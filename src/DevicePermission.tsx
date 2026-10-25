import type { ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Mic, ShieldCheck } from "lucide-react";
import { PermissionError } from "./PermissionError";
import { Badge, BadgeTone } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { cn } from "./helpers/utils";
import { useT } from "./i18n";
import { RecorderShell } from "./recording/RecorderShell";

type PermissionState = "granted" | "denied" | "prompt" | "initial";

const Permission: React.FC<{
  type: "audio" | "video";
  deviceState: PermissionState;
  setDeviceState: (newState: PermissionState) => void;
  isInitialState: boolean;
  onNoDevicesFound: () => void;
  requestVideo: boolean;
}> = ({
  type,
  deviceState,
  setDeviceState,
  isInitialState,
  onNoDevicesFound,
  requestVideo,
}) => {
  const t = useT("recording");
  const handleError = useCallback(
    (error: Error) => {
      if (
        error.message.includes("Requested device not found") ||
        error.message.includes("The object can not be found here")
      ) {
        onNoDevicesFound();
        return;
      }

      setDeviceState("denied");
    },
    [onNoDevicesFound, setDeviceState],
  );

  const run = useCallback(async () => {
    const name =
      type === "audio"
        ? ("microphone" as PermissionName)
        : ("camera" as PermissionName);
    const result = await navigator.permissions
      .query({ name })
      .then((res) => res)
      .catch((e) => {
        // firefox doesn't support microphone and camera as valid property
        if (e instanceof TypeError) {
          return null;
        }

        console.log(e);
        return null;
      });
    // firefox case
    if (!result && deviceState === "initial") {
      // probe for permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: requestVideo,
        });
        setDeviceState("prompt");
        stream.getVideoTracks().forEach((track) => track.stop());
        stream.getAudioTracks().forEach((track) => track.stop());
      } catch (err) {
        console.log("Error on getUserMedia(", err);
        handleError(err as Error);
        return;
      }

      setDeviceState("granted");
      return;
    }

    if (!result) {
      return;
    }

    setDeviceState(result.state);

    if (result.state === "prompt" && type === "audio") {
      try {
        await navigator.mediaDevices.getUserMedia({
          video: requestVideo,
          audio: true,
        });
      } catch (err) {
        console.log("Error on getUserMedia()", err);
        handleError(err as Error);
        return;
      }
    }

    if (result.state === "granted") {
      setDeviceState("granted");
    } else if (result.state === "denied") {
      setDeviceState("denied");
    }
  }, [deviceState, handleError, requestVideo, setDeviceState, type]);

  useEffect(() => {
    run();
  }, [run]);

  if (isInitialState) return null;

  const tone: BadgeTone =
    deviceState === "granted"
      ? "success"
      : deviceState === "denied"
        ? "destructive"
        : "info";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-3 rounded-lg border bg-background p-5",
        deviceState === "denied" && "border-destructive/40",
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          deviceState === "denied"
            ? "bg-destructive/10 text-destructive"
            : deviceState === "granted"
              ? "bg-success/10 text-success"
              : "bg-primary/10 text-primary",
        )}
      >
        {type === "audio" ? (
          <Mic className="h-6 w-6" aria-hidden />
        ) : (
          <Camera className="h-6 w-6" aria-hidden />
        )}
      </span>
      <span className="text-label">
        {type === "audio" ? t("permission.microphone") : t("permission.camera")}
      </span>
      <Badge tone={tone} dot pulse={deviceState === "prompt"}>
        {t(`permission.state.${deviceState}`)}
      </Badge>
    </div>
  );
};

// Lessons recorded without a webcam only need microphone access; the screen
// is shared later through the browser's own picker.
export const DevicePermission: React.FC<{
  children: ReactNode;
  requireCamera: boolean;
}> = ({ children, requireCamera }) => {
  const t = useT("recording");
  const [noDeviceFound, setNoDeviceFound] = useState(false);
  const [audioState, setAudioState] = useState<PermissionState>("initial");
  const [videoState, setVideoState] = useState<PermissionState>("initial");

  const isInitialState = useMemo(() => {
    return (
      audioState === "initial" || (requireCamera && videoState === "initial")
    );
  }, [audioState, requireCamera, videoState]);

  const onNoDevicesFound = useCallback(() => {
    setNoDeviceFound(true);
  }, []);

  if (noDeviceFound) {
    return <PermissionError />;
  }

  if (
    audioState === "granted" &&
    (!requireCamera || videoState === "granted")
  ) {
    return <>{children}</>;
  }

  const anyDenied =
    audioState === "denied" || (requireCamera && videoState === "denied");
  const anyPrompt =
    audioState === "prompt" || (requireCamera && videoState === "prompt");

  return (
    <RecorderShell>
      <div
        className={cn(
          "w-full max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm",
          isInitialState && "invisible",
        )}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-title">{t("permission.title")}</h2>
            <p className="mt-1 text-body text-muted-foreground">
              {requireCamera
                ? t("permission.bodyCamera")
                : t("permission.bodyMic")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Permission
            isInitialState={isInitialState}
            type="audio"
            deviceState={audioState}
            setDeviceState={(newState) => setAudioState(newState)}
            onNoDevicesFound={onNoDevicesFound}
            requestVideo={requireCamera}
          />
          {requireCamera ? (
            <Permission
              isInitialState={isInitialState}
              type="video"
              deviceState={videoState}
              setDeviceState={(newState) => setVideoState(newState)}
              onNoDevicesFound={onNoDevicesFound}
              requestVideo
            />
          ) : null}
        </div>
        {anyPrompt && !anyDenied ? (
          <p className="mt-4 text-caption text-muted-foreground">
            {t("permission.promptHint")}
          </p>
        ) : null}
        {anyDenied ? (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <h3 className="text-label">{t("permission.deniedTitle")}</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-body text-muted-foreground">
              <li>{t("permission.steps.one")}</li>
              <li>{t("permission.steps.two")}</li>
              <li>{t("permission.steps.three")}</li>
              <li>{t("permission.steps.four")}</li>
            </ol>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              {t("permission.reload")}
            </Button>
          </div>
        ) : null}
      </div>
    </RecorderShell>
  );
};
