import React, { useCallback, useState } from "react";
import { RecordingStatus } from "../RecordButton";
import { downloadVideo } from "../helpers/download-video";
import { getExtension } from "../helpers/find-good-supported-codec";
import { Prefix } from "../helpers/prefixes";
import { removeTakeManifest } from "../recording/take-manifest";
import {
  TakeUploadAbortedError,
  uploadTakeToLesson,
} from "../recording/upload-take";
import { ProcessStatus } from "./ProcessingStatus";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export const UseThisTake: React.FC<{
  // Relative to public/, e.g. courses/<course>/<module>/<lesson>
  readonly lessonPath: string | null;
  recordingStatus: RecordingStatus;
  setRecordingStatus: React.Dispatch<React.SetStateAction<RecordingStatus>>;
  setStatus: React.Dispatch<React.SetStateAction<ProcessStatus | null>>;
}> = ({ lessonPath, recordingStatus, setRecordingStatus, setStatus }) => {
  const [busy, setBusy] = useState(false);

  // Converts and uploads the take into the lesson, then selects it.
  // Transcription is left to post-production.
  const keepVideoOnServer = useCallback(async () => {
    if (recordingStatus.type !== "recording-finished") {
      throw new Error("Recording not finished");
    }

    if (lessonPath === null) {
      alert("Pick a lesson in the Library first.");
      return;
    }

    setBusy(true);
    try {
      await uploadTakeToLesson({
        lessonPath,
        takeId: String(recordingStatus.endDate),
        sources: recordingStatus.blobs.map((blob) => ({
          prefix: blob.prefix,
          mimeType: blob.mimeType,
          getData: () => blob.data(),
        })),
        expectedFrames: recordingStatus.expectedFrames,
        markers: recordingStatus.markers,
        startedAt: recordingStatus.startedAt,
        endedAt: recordingStatus.endDate,
        durationMs: recordingStatus.durationMs,
        recovering: false,
        setStatus,
      });

      for (const blob of recordingStatus.blobs) {
        await blob.releaseData();
      }

      removeTakeManifest(String(recordingStatus.startDate));
      setRecordingStatus({ type: "idle" });
    } catch (err) {
      setStatus(null);
      if (err instanceof TakeUploadAbortedError) {
        return;
      }

      console.error(err);
      alert(
        `Saving the take failed: ${(err as Error).message}\nThe recording is kept, you can retry or download it.`,
      );
    } finally {
      setBusy(false);
    }
  }, [lessonPath, recordingStatus, setRecordingStatus, setStatus]);

  const keepVideosWithoutConverting = useCallback(async () => {
    if (recordingStatus.type !== "recording-finished") {
      throw new Error("Recording not finished");
    }

    for (const blob of recordingStatus.blobs) {
      const buffer = await blob.data();
      const extension = getExtension(blob.mimeType);

      const blobToDownload = new Blob([buffer], {
        type: blob.mimeType.includes("webm") ? "video/webm" : "video/mp4",
      });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blobToDownload);
      a.href = url;
      a.download = `${blob.prefix}${blob.endDate}-unprocessed.${extension}`;
      a.click();
    }
  }, [recordingStatus]);

  const keepVideoOnClient = useCallback(async () => {
    if (recordingStatus.type !== "recording-finished") {
      throw new Error("Recording not finished");
    }

    for (const blob of recordingStatus.blobs) {
      await downloadVideo({
        data: await blob.data(),
        endDate: recordingStatus.endDate,
        prefix: blob.prefix,
        mimeType: blob.mimeType,
        setStatus,
      });
    }
  }, [recordingStatus, setStatus]);

  const previewWebcam = useCallback(
    async (prefix: Prefix) => {
      if (recordingStatus.type !== "recording-finished") {
        throw new Error("Recording not finished");
      }

      const webcamBlob = recordingStatus.blobs.find((b) => b.prefix === prefix);
      if (!webcamBlob) {
        throw new Error("No webcam blob");
      }

      // turn into blob url and open in new tab
      const blob = new Blob([await webcamBlob.data()], {
        type: webcamBlob.mimeType,
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    },
    [recordingStatus],
  );

  return (
    <>
      <div className="flex items-center">
        {window.remotionServerEnabled ? (
          <Button
            variant="default"
            className={"rounded-r-none"}
            onClick={keepVideoOnServer}
            disabled={busy || lessonPath === null}
            title={lessonPath ? `public/${lessonPath}` : undefined}
          >
            {lessonPath === null
              ? "Pick a lesson in the Library first"
              : "Save take to lesson"}
          </Button>
        ) : (
          <Button
            variant="default"
            className={"rounded-r-none"}
            onClick={keepVideoOnClient}
          >
            {`Download files`}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              className={"rounded-l-none border-l-2 px-2"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
                style={{ width: 12 }}
              >
                <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {window.remotionServerEnabled ? (
              <DropdownMenuItem onClick={keepVideoOnClient}>
                Download as file
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={keepVideosWithoutConverting}>
              Download without conversion
            </DropdownMenuItem>
            {recordingStatus.type === "recording-finished" &&
              recordingStatus.blobs.map((blob) => (
                <DropdownMenuItem
                  key={blob.prefix}
                  onClick={() => {
                    previewWebcam(blob.prefix as Prefix);
                  }}
                >
                  Preview {blob.prefix}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};
