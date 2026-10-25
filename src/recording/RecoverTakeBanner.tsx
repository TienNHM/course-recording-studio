import { History } from "lucide-react";
import React, { useCallback, useState } from "react";
import { FPS } from "../../config/fps";
import {
  ProcessingStatus,
  ProcessStatus,
} from "../components/ProcessingStatus";
import { Button } from "../components/ui/button";
import { deleteStoredFile, readStoredFile } from "../helpers/store-file";
import { useFormat, useT } from "../i18n";
import { findLesson, useCurrentLesson } from "../state/current-lesson";
import { ConfirmDialog } from "./ConfirmDialog";
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
  const t = useT("recording");
  const f = useFormat();
  const { tree } = useCurrentLesson();
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const manifest = manifests[0];

  const targetLesson = manifest?.lessonPath ?? lessonPath;
  const targetTitle =
    tree && targetLesson
      ? (findLesson(tree, targetLesson)?.lesson.title ?? targetLesson)
      : targetLesson;
  const serverEnabled = Boolean(window.remotionServerEnabled);

  const recover = useCallback(async () => {
    if (!manifest || !targetLesson) {
      return;
    }

    setBusy(true);
    setError(null);
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
        setError(t("recover.noData"));
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
        setError(t("recover.failed", { message: (err as Error).message }));
      }
    } finally {
      setBusy(false);
    }
  }, [manifest, onHandled, t, targetLesson]);

  const discard = useCallback(async () => {
    if (!manifest) {
      return;
    }

    await deleteManifestData(manifest);
    onHandled(manifest.id);
  }, [manifest, onHandled]);

  if (!manifest) {
    return null;
  }

  const { durationMs } = resolveRecoveredTiming(manifest);

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-body md:flex-row md:items-center"
    >
      <History
        className="hidden h-4 w-4 shrink-0 text-warning md:block"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{t("recover.title")}</div>
        <div className="text-caption text-muted-foreground">
          {t("recover.meta", {
            date: f.formatDateTime(manifest.startDate),
            duration: f.formatDuration(durationMs),
            markers: t("live.markerCount", { count: manifest.markers.length }),
          })}
          {" · "}
          {!serverEnabled
            ? t("recover.noServer")
            : targetTitle
              ? t("recover.target", { lesson: targetTitle })
              : t("recover.noTarget")}
          {manifests.length > 1
            ? ` · ${t("recover.more", { count: manifests.length - 1 })}`
            : ""}
        </div>
        {status ? <ProcessingStatus className="mt-2" status={status} /> : null}
        {error ? (
          <div className="mt-1 text-caption text-destructive" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          onClick={recover}
          disabled={busy || disabled || !targetLesson || !serverEnabled}
        >
          {t("recover.recover")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          {t("recover.discard")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("recover.discardConfirm.title")}
        description={t("recover.discardConfirm.body")}
        confirmLabel={t("recover.discardConfirm.confirm")}
        tone="destructive"
        onConfirm={discard}
      />
    </div>
  );
};
