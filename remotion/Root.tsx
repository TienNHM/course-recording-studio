import { Composition } from "remotion";
import { videoConf } from "../config/scenes";
import { GoToRecorder } from "./GoToRecorder";
import { Main } from "./Main";
import { calcMetadata } from "./calculate-metadata/calc-metadata";
import { LessonMain } from "./lesson/LessonMain";
import type { LessonProps } from "./lesson/calc-lesson-metadata";
import {
  calcLessonMetadata,
  calcLessonStylePreviewMetadata,
  defaultLessonProps,
  defaultLessonStylePreviewProps,
  lessonCompositionSchema,
  lessonStylePreviewSchema,
} from "./lesson/calc-lesson-metadata";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        component={Main}
        id="welcome"
        schema={videoConf}
        defaultProps={{
          theme: "light" as const,
          canvasLayout: "square" as const,
          scenes: [
            {
              type: "recorder" as const,
              durationInFrames: 80,
              music: "epic" as const,
              transitionToNextScene: true,
            },
            {
              type: "videoscene" as const,
              webcamPosition: "previous" as const,
              endOffset: 0,
              transitionToNextScene: true,
              newChapter: "",
              stopChapteringAfterThis: false,
              music: "previous" as const,
              startOffset: 0,
              bRolls: [],
            },
            {
              type: "videoscene" as const,
              webcamPosition: "previous" as const,
              endOffset: 0,
              transitionToNextScene: true,
              newChapter: "",
              stopChapteringAfterThis: false,
              music: "previous" as const,
              startOffset: 0,
              bRolls: [],
            },
            {
              type: "videoscene" as const,
              webcamPosition: "previous" as const,
              endOffset: 0,
              transitionToNextScene: true,
              newChapter: "",
              stopChapteringAfterThis: false,
              music: "previous" as const,
              startOffset: 0,
              bRolls: [],
            },
            {
              type: "videoscene" as const,
              webcamPosition: "previous" as const,
              endOffset: 0,
              transitionToNextScene: true,
              newChapter: "",
              stopChapteringAfterThis: false,
              music: "previous" as const,
              startOffset: 0,
              bRolls: [],
            },
            {
              music: "previous" as const,
              transitionToNextScene: true,
              type: "endcard" as const,
              durationInFrames: 200,
              channel: "remotion" as const,
              links: [
                { link: "remotion.dev/recorder" },
                { link: "remotion.dev/discord" },
              ],
            },
          ],
          scenesAndMetadata: [],
          platform: "x" as const,
        }}
        calculateMetadata={calcMetadata}
      />
      {/* Course Recording Studio: renders one lesson from public/<lessonPath> */}
      <Composition
        component={LessonMain}
        id="lesson"
        schema={lessonCompositionSchema}
        defaultProps={defaultLessonProps}
        calculateMetadata={calcLessonMetadata}
      />
      {/* Preview every course.videoStyle option without editing course.json:
          edit lessonPath / language / style in the props panel. */}
      <Composition
        component={
          LessonMain as React.FC<
            LessonProps & typeof defaultLessonStylePreviewProps
          >
        }
        id="lesson-style-preview"
        schema={lessonStylePreviewSchema}
        defaultProps={{
          ...defaultLessonProps,
          ...defaultLessonStylePreviewProps,
        }}
        calculateMetadata={calcLessonStylePreviewMetadata}
      />
      <Composition
        component={GoToRecorder}
        id="record"
        width={1080}
        height={1080}
        fps={30}
        durationInFrames={100}
      />
      <Composition
        component={Main}
        id="empty"
        schema={videoConf}
        defaultProps={{
          theme: "light" as const,
          canvasLayout: "square" as const,
          platform: "youtube",
          scenes: [],
          scenesAndMetadata: [],
        }}
        calculateMetadata={calcMetadata}
      />
    </>
  );
};
