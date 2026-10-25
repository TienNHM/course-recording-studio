import { ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import { BlinkingCircle } from "./BlinkingCircle";
import { Logo } from "./Logo";
import type { RecordingStatus } from "./RecordButton";
import { RecordButton } from "./RecordButton";
import { Timer } from "./Timer";
import { ProcessStatus, ProcessingStatus } from "./components/ProcessingStatus";
import { UseThisTake } from "./components/UseThisTake";
import { Button } from "./components/ui/button";
import { useCurrentLesson } from "./state/current-lesson";

const topBarContainer: React.CSSProperties = {
  display: "flex",
  gap: 10,
  margin: 10,
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "center",
};

const recordWrapper: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
};

export const TopBar: React.FC<{
  recordingStatus: RecordingStatus;
  setRecordingStatus: React.Dispatch<React.SetStateAction<RecordingStatus>>;
  showAllViews: boolean;
  onBackToLibrary: () => void;
}> = ({
  recordingStatus,
  setRecordingStatus,
  showAllViews,
  onBackToLibrary,
}) => {
  const { location, lessonPath } = useCurrentLesson();
  const [processingStatus, setProcessingStatus] =
    useState<ProcessStatus | null>(null);

  return (
    <div style={topBarContainer}>
      <Logo></Logo>
      <div style={recordWrapper}>
        <RecordButton
          recordingStatus={recordingStatus}
          processingStatus={processingStatus}
          setRecordingStatus={setRecordingStatus}
          showAllViews={showAllViews}
          lessonPath={lessonPath}
        />
        {recordingStatus.type === "recording" ? (
          <>
            <BlinkingCircle />
            <Timer startDate={recordingStatus.ongoing.startDate} />
          </>
        ) : null}
        {recordingStatus.type === "recording-finished" ? (
          <UseThisTake
            selectedFolder={lessonPath}
            recordingStatus={recordingStatus}
            setRecordingStatus={setRecordingStatus}
            setStatus={setProcessingStatus}
          />
        ) : null}
        {processingStatus && (
          <ProcessingStatus status={processingStatus}></ProcessingStatus>
        )}
      </div>

      <div style={{ flex: 1 }} />
      <div className="min-w-0 truncate text-sm">
        {location ? (
          <>
            <span className="text-muted-foreground">
              {location.course.name} › {location.module.title} ›{" "}
            </span>
            <span className="font-medium">{location.lesson.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No lesson selected</span>
        )}
      </div>
      <Button
        variant="outline"
        onClick={onBackToLibrary}
        disabled={recordingStatus.type !== "idle"}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Library
      </Button>
    </div>
  );
};
