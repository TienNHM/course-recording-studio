import { useEffect, useState } from "react";
import type { LessonProps } from "../../remotion/lesson/calc-lesson-metadata";
import {
  calcLessonMetadata,
  defaultLessonProps,
} from "../../remotion/lesson/calc-lesson-metadata";

export type LessonMetadata = {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  props: LessonProps;
};

// The Player has no calculateMetadata() support, so the composition's own
// calcLessonMetadata() runs here, in the app. It only uses staticFile() and
// fetch(), which resolve to /<path under public> — exactly what the Vite
// middleware serves — so the preview reads the same files as the renderer.
export const useLessonMetadata = (lessonPath: string, version: number) => {
  const [metadata, setMetadata] = useState<LessonMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    const props = { ...defaultLessonProps, lessonPath };
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
        if (controller.signal.aborted) {
          return;
        }
        if (
          !result.durationInFrames ||
          !result.fps ||
          !result.width ||
          !result.height ||
          !result.props
        ) {
          throw new Error("calcLessonMetadata() returned incomplete metadata");
        }
        setMetadata({
          durationInFrames: result.durationInFrames,
          fps: result.fps,
          width: result.width,
          height: result.height,
          props: result.props as LessonProps,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
        }
      });
    return () => controller.abort();
  }, [lessonPath, version]);

  return { metadata, error };
};
