import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { Spinner } from "./components/Spinner";
import { Button } from "./components/ui/button";
import type { SelectedSource } from "./helpers/get-selected-video-source";
import { getVideoStream } from "./helpers/get-video-stream";
import { Prefix } from "./helpers/prefixes";
import { useT } from "./i18n";
import { useMediaSources } from "./state/media-sources";

// Stream errors are stored as "code:<name>" so they can be shown in the
// current language; anything else is a raw browser message.
const STREAM_ERROR_CODES = {
  NotReadableError: "notReadable",
  OverconstrainedError: "overconstrained",
  NotAllowedError: "notAllowed",
  NotFoundError: "notFound",
  AbortError: "cancelled",
} as const;

export const streamErrorCode = (e: Error): string => {
  const code =
    STREAM_ERROR_CODES[e.name as keyof typeof STREAM_ERROR_CODES] ?? null;
  return code ? `code:${code}` : e.message || e.name;
};

const StreamError: React.FC<{
  readonly error: string;
  readonly isScreen: boolean;
  readonly onRetry: () => void;
}> = ({ error, isScreen, onRetry }) => {
  const t = useT("recording");
  let code = error.startsWith("code:") ? error.slice(5) : null;
  // Cancelling the screen picker is reported as NotAllowedError
  if (isScreen && code === "notAllowed") {
    code = "cancelled";
  }

  const message =
    code === "notReadable" ||
    code === "overconstrained" ||
    code === "notAllowed" ||
    code === "notFound" ||
    code === "cancelled"
      ? t(`sources.error.${code}`)
      : t("sources.error.generic", { message: error });

  return (
    <AbsoluteFill className="items-center justify-center gap-3 bg-muted p-4 text-center">
      <p className="max-w-sm text-balance text-caption text-muted-foreground">
        {message}
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {t("sources.error.retry")}
      </Button>
    </AbsoluteFill>
  );
};

const container: React.CSSProperties = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
};

export type ResolutionAndFps = {
  width: number;
  height: number;
  fps: number;
};

export const Stream: React.FC<{
  prefix: Prefix;
  setResolution: React.Dispatch<React.SetStateAction<ResolutionAndFps | null>>;
  recordAudio: boolean;
  selectedVideoSource: SelectedSource | null;
  selectedAudioSource: string | null;
  preferPortrait: boolean;
  mirror: boolean;
  clear: () => void;
}> = ({
  prefix,
  setResolution,
  recordAudio,
  selectedVideoSource,
  selectedAudioSource,
  preferPortrait,
  mirror,
  clear,
}) => {
  const { mediaSources, setMediaStream } = useMediaSources();
  const mediaStream = mediaSources[prefix];

  const sourceRef = useRef<HTMLVideoElement>(null);

  const videoStyle: React.CSSProperties = useMemo(() => {
    return {
      transform: mirror ? "scaleX(-1)" : undefined,
    };
  }, [mirror]);

  useEffect(() => {
    if (mediaStream.streamState.type !== "loaded") {
      return;
    }

    const track = mediaStream.streamState.stream.getVideoTracks()[0];
    if (!track) {
      return;
    }

    track.onended = () => {
      setMediaStream(prefix, { type: "initial" });
    };
  }, [mediaStream, prefix, setMediaStream]);

  useEffect(() => {
    return () => {
      if (mediaStream.streamState.type !== "loaded") {
        return;
      }

      mediaStream.streamState.stream
        .getAudioTracks()
        .forEach((track) => track.stop());

      mediaStream.streamState.stream
        .getVideoTracks()
        .forEach((track) => track.stop());
    };
  }, [mediaStream]);

  useEffect(() => {
    const { current } = sourceRef;
    if (!current) {
      return;
    }

    if (selectedVideoSource === null) {
      setMediaStream(prefix, { type: "initial" });
      return;
    }

    setMediaStream(prefix, { type: "loading" });

    const cleanup: (() => void)[] = [];

    getVideoStream({
      preferPortrait,
      recordAudio,
      selectedAudioSource,
      selectedVideoSource,
    })
      .then((stream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No video track");
        }

        videoTrack.addEventListener(
          "ended",
          () => {
            clear();
            setMediaStream(prefix, { type: "initial" });
          },
          { once: true },
        );

        const settings = videoTrack.getSettings();
        if (!settings) {
          throw new Error("No video settings");
        }

        setResolution({
          width: settings.width as number,
          height: settings.height as number,
          fps: settings.frameRate as number,
        });

        if (current) {
          current.srcObject = stream;
          current.play();
        }

        cleanup.push(() => {
          stream.getVideoTracks().forEach((track) => track.stop());
          stream.getAudioTracks().forEach((track) => track.stop());
          current.srcObject = null;
        });

        setMediaStream(prefix, { type: "loaded", stream });
      })
      .catch((e: Error) => {
        setMediaStream(prefix, {
          type: "error",
          error: streamErrorCode(e),
        });
      });

    return () => {
      cleanup.forEach((f) => f());
    };
  }, [
    clear,
    preferPortrait,
    prefix,
    recordAudio,
    selectedAudioSource,
    selectedVideoSource,
    setMediaStream,
    setResolution,
  ]);

  useEffect(() => {
    const { current } = sourceRef;

    if (!current) {
      return;
    }

    const onResize = () => {
      setResolution((r) => {
        if (r === null) {
          return null;
        }

        return {
          ...r,
          width: current.videoWidth,
          height: current.videoHeight,
        };
      });
    };

    current.addEventListener("resize", onResize);

    return () => {
      current.removeEventListener("resize", onResize);
    };
  }, [setResolution]);

  const onReset = useCallback(() => {
    setMediaStream(prefix, {
      type: "initial",
    });
    clear();
  }, [clear, prefix, setMediaStream]);

  const isScreen =
    selectedVideoSource?.type === "display-with-audio" ||
    selectedVideoSource?.type === "display-without-audio";

  return (
    <AbsoluteFill style={container} id={prefix + "-video-container"}>
      <video
        ref={sourceRef}
        muted
        playsInline
        className="h-full w-full object-contain"
        style={videoStyle}
      />
      {mediaStream.streamState.type === "loading" ? (
        <AbsoluteFill className="items-center justify-center gap-3 text-muted-foreground">
          <Spinner />
        </AbsoluteFill>
      ) : null}
      {mediaStream.streamState.type === "error" ? (
        <StreamError
          error={mediaStream.streamState.error}
          isScreen={isScreen}
          onRetry={onReset}
        />
      ) : null}
    </AbsoluteFill>
  );
};
