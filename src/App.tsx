import React, { useCallback } from "react";
import "./App.css";
import { DevicePermission } from "./DevicePermission";
import { WaitingForDevices } from "./WaitingForDevices";
import { EnsureBrowserSupport } from "./components/EnsureBrowserSupport";
import { LibraryPage } from "./library/LibraryPage";
import { Recorder } from "./recording/Recorder";
import { ReviewPage } from "./review/ReviewPage";
import { StyleguidePage } from "./styleguide/StyleguidePage";
import {
  CurrentLessonProvider,
  useCurrentLesson,
} from "./state/current-lesson";
import { MediaSourcesProvider } from "./state/media-sources";
import { useView } from "./state/view";

const RecordView: React.FC<{
  readonly onBackToLibrary: () => void;
  readonly onReview: () => void;
}> = ({ onBackToLibrary, onReview }) => {
  const { lesson, tree, error } = useCurrentLesson();
  // Wait for the lesson to load so we know whether to ask for the camera.
  if (tree === null && error === null) {
    return null;
  }

  return (
    <EnsureBrowserSupport>
      <DevicePermission
        requireCamera={lesson?.recordingProfile.webcam ?? false}
      >
        <WaitingForDevices>
          <MediaSourcesProvider>
            <Recorder onBackToLibrary={onBackToLibrary} onReview={onReview} />
          </MediaSourcesProvider>
        </WaitingForDevices>
      </DevicePermission>
    </EnsureBrowserSupport>
  );
};

const App = () => {
  const [view, setView] = useView();
  const showLibrary = useCallback(() => setView("library"), [setView]);
  const showRecorder = useCallback(() => setView("record"), [setView]);
  const showReview = useCallback(() => setView("review"), [setView]);

  return (
    <CurrentLessonProvider>
      {view === "library" ? (
        <LibraryPage onRecord={showRecorder} onReview={showReview} />
      ) : view === "review" ? (
        <ReviewPage onBack={showLibrary} />
      ) : view === "styleguide" ? (
        <StyleguidePage onBack={showLibrary} />
      ) : (
        <RecordView onBackToLibrary={showLibrary} onReview={showReview} />
      )}
    </CurrentLessonProvider>
  );
};

export default App;
