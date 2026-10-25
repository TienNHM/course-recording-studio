// Live preview of a course's video style on the intro of a real lesson.
// Loaded lazily (React.lazy) so @remotion/player and the lesson composition
// stay out of the library bundle until the settings dialog shows it.
import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import { Play } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { CourseLanguage, VideoStyle } from "../../config/course";
import { LessonMain } from "../../remotion/lesson/LessonMain";
import {
  calcLessonMetadata,
  defaultLessonProps,
  type LessonProps,
} from "../../remotion/lesson/calc-lesson-metadata";
import { Alert } from "../components/ui/alert";
import { useT } from "../i18n";

const DEBOUNCE_MS = 400;
// Seconds of the lesson body shown after the intro card.
const BODY_SECONDS = 2;
const POSTER_SECONDS = 1.5;

type Metadata = {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  props: LessonProps;
};

const VideoStylePreview: React.FC<{
  readonly lessonPath: string;
  readonly style: VideoStyle;
  readonly language: CourseLanguage;
}> = ({ lessonPath, style, language }) => {
  const t = useT("library");
  const player = useRef<PlayerRef>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const styleKey = JSON.stringify(style);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const props: LessonProps = {
        ...defaultLessonProps,
        lessonPath,
        styleOverride: JSON.parse(styleKey) as VideoStyle,
        languageOverride: language,
      };
      Promise.resolve(
        calcLessonMetadata({
          props,
          defaultProps: defaultLessonProps,
          abortSignal: controller.signal,
          compositionId: "lesson",
          isRendering: false,
        }),
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          if (
            !result.durationInFrames ||
            !result.fps ||
            !result.width ||
            !result.height ||
            !result.props
          ) {
            throw new Error("incomplete metadata");
          }
          setError(null);
          setMetadata({
            durationInFrames: result.durationInFrames,
            fps: result.fps,
            width: result.width,
            height: result.height,
            props: result.props as LessonProps,
          });
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError((e as Error).message);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [language, lessonPath, styleKey]);

  if (error) {
    return (
      <Alert tone="warning">{t("videoStyle.previewError", { message: error })}</Alert>
    );
  }

  if (!metadata) {
    return (
      <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded-lg border bg-muted text-caption text-muted-foreground">
        {t("videoStyle.previewLoading")}
      </div>
    );
  }

  const bodyStart = metadata.props.timeline?.bodyStartFrame ?? 0;
  const outFrame = Math.max(
    1,
    Math.min(
      metadata.durationInFrames - 1,
      bodyStart + Math.round(BODY_SECONDS * metadata.fps),
    ),
  );

  return (
    <div
      className="group relative overflow-hidden rounded-lg border bg-muted"
      onMouseEnter={() => player.current?.play()}
      onMouseLeave={() => player.current?.pause()}
    >
      <Player
        ref={player}
        component={LessonMain}
        inputProps={metadata.props}
        durationInFrames={metadata.durationInFrames}
        fps={metadata.fps}
        compositionWidth={metadata.width}
        compositionHeight={metadata.height}
        inFrame={0}
        outFrame={outFrame}
        // Paused on a frame where the intro title is already visible.
        initialFrame={Math.min(outFrame, Math.round(POSTER_SECONDS * metadata.fps))}
        loop
        initiallyMuted
        clickToPlay
        controls
        acknowledgeRemotionLicense
        style={{
          width: "100%",
          aspectRatio: `${metadata.width} / ${metadata.height}`,
        }}
      />
      <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-caption text-foreground opacity-100 transition-opacity group-hover:opacity-0">
        <Play className="h-3 w-3" aria-hidden />
        {t("videoStyle.previewPlay")}
      </span>
    </div>
  );
};

export default VideoStylePreview;
