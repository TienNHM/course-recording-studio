import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { FPS } from "../../config/fps";
import {
  ProcessingStatus,
  ProcessStatus,
} from "../components/ProcessingStatus";
import { Button } from "../components/ui/button";
import { formatMilliseconds } from "../helpers/format-time";
import { deleteStoredFile, readStoredFile } from "../helpers/store-file";
import { expectedFramesForDuration } from "./pause-clock";
import {
  removeTakeManifest,
  resolveRecoveredTiming,
  TakeManifest,
} from "./take-manifest";
import {
  TakeSource,
  TakeUploadAbortedError,
  uploadTakeToLesson,
} from "./upload-take";

const deleteManifestData = async (manifest: TakeManifest) => {
  for (const source of manifest.sources) {
    await deleteStoredFile(source.filename);
  }

  removeTakeManifest(manifest.id);
};

// Offers to upload (or discard) takes that were left in OPFS by a crash or a
// reload before they were saved to their lesson.
export const RecoverTakeBanner: React.FC<{
  readonly manifests: TakeManifest[];
  readonly lessonPath: string | null;
  readonly onHandled: (id: string) => void;
  readonly disabled: boolean;
}> = ({ manifests, lessonPath, onHandled, disabled }) => {
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const manifest = manifests[0];

  const targetLesson = manifest?.lessonPath ?? lessonPath;

  const recover = useCallback(async () => {
    if (!manifest || !targetLesson) {
      return;
    }

    setBusy(true);
    try {
      const sources: TakeSource[] = [];
      for (const source of manifest.sources) {
        const file = await readStoredFile(source.filename, source.mimeType);
        if (file && file.size > 0) {
          sources.push({
            prefix: source.prefix,
            mimeType: source.mimeType,
            getData: () => Promise.resolve(file),
          });
        }
      }

      if (sources.length === 0) {
        alert(
          "No recorded data was found for this take. It can only be discarded.",
        );
        return;
      }

      const { takeId, endedAt, durationMs } = resolveRecoveredTiming(manifest);
      await uploadTakeToLesson({
        lessonPath: targetLesson,
        takeId,
        sources,
        expectedFrames: expectedFramesForDuration(durationMs, FPS),
        markers: manifest.markers,
        startedAt: manifest.clock.startedAt,
        endedAt,
        durationMs,
        recovering: true,
        setStatus,
      });
      await deleteManifestData(manifest);
      onHandled(manifest.id);
    } catch (err) {
      setStatus(null);
      if (!(err instanceof TakeUploadAbortedError)) {
        console.error(err);
        alert(`Recovering the take failed: ${(err as Error).message}`);
      }
    } finally {
      setBusy(false);
    }
  }, [manifest, onHandled, targetLesson]);

  const discard = useCallback(async () => {
    if (!manifest) {
      return;
    }

    if (
      !window.confirm("Discard this unfinished take? This cannot be undone.")
    ) {
      return;
    }

    await deleteManifestData(manifest);
    onHandled(manifest.id);
  }, [manifest, onHandled]);

  if (!manifest) {
    return null;
  }

  const { durationMs } = resolveRecoveredTiming(manifest);

  return createPortal(
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-row items-center gap-3 rounded-md border border-input bg-background px-4 py-3 shadow-lg text-sm"
      role="status"
    >
      <div>
        <div className="font-semibold">Recover unfinished take</div>
        <div className="text-muted-foreground">
          {new Date(manifest.startDate).toLocaleString()} ·{" "}
          {formatMilliseconds(durationMs)} · {manifest.markers.length} markers
          {targetLesson
            ? ` → ${targetLesson}`
            : " · Pick a lesson in the Library first"}
          {manifests.length > 1 ? ` · ${manifests.length - 1} more` : ""}
        </div>
        {status ? <ProcessingStatus status={status} /> : null}
      </div>
      <Button
        size="sm"
        onClick={recover}
        disabled={
          busy || disabled || !targetLesson || !window.remotionServerEnabled
        }
      >
        Recover
      </Button>
      <Button size="sm" variant="outline" onClick={discard} disabled={busy}>
        Discard
      </Button>
    </div>,
    document.body,
  );
};
