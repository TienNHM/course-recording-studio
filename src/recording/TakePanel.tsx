import {
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  LibraryBig,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { JobState } from "../../config/course";
import { isTerminalJobStatus } from "../../config/course";
import { fetchJobStatus, startProduction } from "../actions/production";
import {
  ProcessingStatus,
  ProcessStatus,
} from "../components/ProcessingStatus";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Progress } from "../components/ui/progress";
import { downloadVideo } from "../helpers/download-video";
import { getExtension } from "../helpers/find-good-supported-codec";
import { useFormat, useT } from "../i18n";
import type { RecordingStatus } from "../RecordButton";
import { findLesson, useCurrentLesson } from "../state/current-lesson";
import { ConfirmDialog } from "./ConfirmDialog";
import { removeTakeManifest } from "./take-manifest";
import { TakeUploadAbortedError, uploadTakeToLesson } from "./upload-take";

type FinishedStatus = Extract<RecordingStatus, { type: "recording-finished" }>;

/** A take that was saved to a lesson in this session. */
export type SavedTake = {
  readonly lessonPath: string;
  readonly takeId: string;
  readonly durationMs: number;
  readonly markerCount: number;
};

const useLessonAt = (lessonPath: string | null) => {
  const { tree } = useCurrentLesson();
  return tree && lessonPath ? findLesson(tree, lessonPath) : null;
};

const PanelTitle: React.FC<{
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
}> = ({ icon, children }) => (
  <div className="flex items-center gap-2 text-heading">
    {icon}
    <h2 className="min-w-0 truncate">{children}</h2>
  </div>
);

/**
 * Right after "Stop": saves the take to its lesson automatically (convert →
 * copy → markers/session → select take), with progress, retry and download
 * fallbacks. On success it hands over to <SavedTakePanel>.
 */
export const SaveTakePanel: React.FC<{
  readonly status: FinishedStatus;
  readonly setRecordingStatus: React.Dispatch<
    React.SetStateAction<RecordingStatus>
  >;
  readonly processing: ProcessStatus | null;
  readonly setProcessing: React.Dispatch<
    React.SetStateAction<ProcessStatus | null>
  >;
  readonly onSaved: (take: SavedTake) => void;
  readonly announce: (message: string) => void;
}> = ({
  status,
  setRecordingStatus,
  processing,
  setProcessing,
  onSaved,
  announce,
}) => {
  const t = useT("recording");
  const { formatDuration } = useFormat();
  const { refresh } = useCurrentLesson();
  const lessonPath = status.lessonPath;
  const location = useLessonAt(lessonPath);
  const serverEnabled = Boolean(window.remotionServerEnabled);
  const canSave = serverEnabled && lessonPath !== null;

  const [state, setState] = useState<
    | { type: "saving" }
    | { type: "error"; message: string }
    | { type: "aborted" }
    | { type: "unsaved" }
  >(() => (canSave ? { type: "saving" } : { type: "unsaved" }));
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const busy = processing !== null;

  const save = useCallback(async () => {
    if (!lessonPath || !serverEnabled) {
      return;
    }

    setState({ type: "saving" });
    try {
      await uploadTakeToLesson({
        lessonPath,
        takeId: String(status.endDate),
        sources: status.blobs.map((blob) => ({
          prefix: blob.prefix,
          mimeType: blob.mimeType,
          getData: () => blob.data(),
        })),
        expectedFrames: status.expectedFrames,
        markers: status.markers,
        startedAt: status.startedAt,
        endedAt: status.endDate,
        durationMs: status.durationMs,
        recovering: false,
        setStatus: setProcessing,
      });

      for (const blob of status.blobs) {
        await blob.releaseData();
      }

      removeTakeManifest(String(status.startDate));
      onSaved({
        lessonPath,
        takeId: String(status.endDate),
        durationMs: status.durationMs,
        markerCount: status.markers.length,
      });
      setRecordingStatus({ type: "idle" });
      announce(t("announce.saved"));
      refresh();
    } catch (err) {
      setProcessing(null);
      if (err instanceof TakeUploadAbortedError) {
        setState({ type: "aborted" });
        return;
      }

      console.error(err);
      setState({ type: "error", message: (err as Error).message });
      announce(t("announce.saveFailed"));
    }
  }, [
    announce,
    lessonPath,
    onSaved,
    refresh,
    serverEnabled,
    setProcessing,
    setRecordingStatus,
    status,
    t,
  ]);

  // Save automatically once per take
  const autoSavedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!canSave || autoSavedRef.current === status.endDate) {
      return;
    }

    autoSavedRef.current = status.endDate;
    save();
  }, [canSave, save, status.endDate]);

  const download = useCallback(async () => {
    setDownloadError(null);
    try {
      for (const blob of status.blobs) {
        await downloadVideo({
          data: await blob.data(),
          endDate: status.endDate,
          prefix: blob.prefix,
          mimeType: blob.mimeType,
          setStatus: setProcessing,
        });
      }
    } catch (err) {
      setProcessing(null);
      setDownloadError(
        t("take.downloadFailed", { message: (err as Error).message }),
      );
    }
  }, [setProcessing, status, t]);

  const downloadRaw = useCallback(async () => {
    for (const blob of status.blobs) {
      const buffer = await blob.data();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: blob.mimeType.includes("webm") ? "video/webm" : "video/mp4",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${blob.prefix}${blob.endDate}-unprocessed.${getExtension(blob.mimeType)}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }, [status.blobs]);

  const preview = useCallback(
    async (prefix: string) => {
      const blob = status.blobs.find((b) => b.prefix === prefix);
      if (!blob) {
        return;
      }

      const url = URL.createObjectURL(
        new Blob([await blob.data()], { type: blob.mimeType }),
      );
      window.open(url, "_blank");
    },
    [status.blobs],
  );

  const discard = useCallback(async () => {
    for (const blob of status.blobs) {
      await blob.releaseData();
    }

    removeTakeManifest(String(status.startDate));
    setRecordingStatus({ type: "idle" });
  }, [setRecordingStatus, status]);

  const summary = t("take.summary", {
    duration: formatDuration(status.durationMs),
    markers: t("live.markerCount", { count: status.markers.length }),
  });

  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("take.moreOptions")}
          disabled={busy}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadRaw}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t("take.downloadRaw")}
        </DropdownMenuItem>
        {status.blobs.map((blob) => (
          <DropdownMenuItem
            key={blob.prefix}
            onClick={() => preview(blob.prefix)}
          >
            <Eye className="mr-2 h-4 w-4" aria-hidden />
            {t("take.preview", {
              source: t(
                `sources.label.${blob.prefix as "webcam" | "display" | "alternative1" | "alternative2"}`,
              ),
            })}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onClick={() => setConfirmDiscard(true)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          {t("take.discard")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      {state.type === "saving" ? (
        <>
          <PanelTitle
            icon={<Upload className="h-4 w-4 text-primary" aria-hidden />}
          >
            {t("take.savingTitle")}
          </PanelTitle>
          <p className="text-caption text-muted-foreground">
            {summary}
            {location ? ` · ${location.lesson.title}` : ""}
          </p>
          {processing ? (
            <ProcessingStatus status={processing} />
          ) : (
            <Progress value={null} label={t("take.savingTitle")} />
          )}
          <p className="text-caption text-muted-foreground">
            {t("take.savingHint")}
          </p>
        </>
      ) : (
        <>
          {state.type === "error" ? (
            <Alert tone="destructive" title={t("take.errorTitle")}>
              {t("take.errorBody", { message: state.message })}
            </Alert>
          ) : (
            <Alert
              tone="warning"
              title={
                state.type === "aborted"
                  ? t("take.abortedTitle")
                  : t("take.unsavedTitle")
              }
            >
              {!serverEnabled
                ? t("take.noServer")
                : lessonPath === null
                  ? t("take.noLesson")
                  : summary}
            </Alert>
          )}
          {processing ? <ProcessingStatus status={processing} /> : null}
          {downloadError ? (
            <p className="text-caption text-destructive" role="alert">
              {downloadError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            {canSave ? (
              <Button onClick={save} disabled={busy}>
                {state.type === "error" ? (
                  <RotateCcw className="h-4 w-4" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden />
                )}
                {state.type === "error" ? t("take.retry") : t("take.save")}
              </Button>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant={canSave ? "outline" : "default"}
                className="flex-1"
                onClick={download}
                disabled={busy}
              >
                <Download className="h-4 w-4" aria-hidden />
                {t("take.download")}
              </Button>
              {moreMenu}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("take.discardConfirm.title")}
        description={t("take.discardConfirm.body")}
        confirmLabel={t("take.discardConfirm.confirm")}
        tone="destructive"
        onConfirm={discard}
      />
    </section>
  );
};

const POLL_MS = 2000;

/**
 * After a take was saved: tells the user post-production started on its own
 * (autoProcess, on by default) or offers "Process now", shows the job's
 * progress and the next steps.
 */
export const SavedTakePanel: React.FC<{
  readonly take: SavedTake;
  readonly onBackToLibrary: () => void;
  readonly onRecordAnother: () => void;
  readonly onReview: () => void;
}> = ({ take, onBackToLibrary, onRecordAnother, onReview }) => {
  const t = useT("recording");
  const { formatDuration } = useFormat();
  const location = useLessonAt(take.lessonPath);
  const autoProcess = location?.lesson.postProduction.autoProcess ?? true;
  const autoPublish = location?.lesson.postProduction.autoPublish ?? false;

  const [job, setJob] = useState<JobState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(autoProcess);

  useEffect(() => {
    if (!polling) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const next = await fetchJobStatus(take.lessonPath);
        if (cancelled) {
          return;
        }

        setJob(next);
        if (next && isTerminalJobStatus(next.status)) {
          return;
        }
      } catch {
        // Server busy or restarting: try again
      }

      if (!cancelled) {
        timeout = setTimeout(poll, POLL_MS);
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [polling, take.lessonPath]);

  const processNow = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      setJob(await startProduction(take.lessonPath));
      setPolling(true);
    } catch (err) {
      setStartError(
        t("take.processFailed", { message: (err as Error).message }),
      );
    } finally {
      setStarting(false);
    }
  }, [t, take.lessonPath]);

  // A job for an older take does not count
  const currentJob =
    job && (job.takeId === null || job.takeId === take.takeId) ? job : null;
  const jobRunning =
    currentJob !== null && !isTerminalJobStatus(currentJob.status);
  const done =
    currentJob?.status === "COMPLETED" && currentJob.kind === "production";
  const failed =
    currentJob?.status === "FAILED" || currentJob?.status === "CANCELLED";
  const showManual = (!autoProcess && currentJob === null) || failed;

  return (
    <section className="flex flex-col gap-3">
      <PanelTitle
        icon={<CheckCircle2 className="h-4 w-4 text-success" aria-hidden />}
      >
        {t("take.savedTitle", {
          lesson: location?.lesson.title ?? take.lessonPath,
        })}
      </PanelTitle>
      <p className="text-caption text-muted-foreground">
        {t("take.summary", {
          duration: formatDuration(take.durationMs),
          markers: t("live.markerCount", { count: take.markerCount }),
        })}
      </p>

      {autoProcess && !failed ? (
        <Alert tone="info" title={t("take.autoProcessTitle")}>
          {t("take.autoProcessBody")}
          {autoPublish ? ` ${t("take.autoPublishNote")}` : ""}
        </Alert>
      ) : null}

      {showManual ? (
        <Alert
          tone={failed ? "destructive" : "neutral"}
          title={
            failed && currentJob
              ? t(`take.jobStatus.${currentJob.status}`)
              : t("take.manualTitle")
          }
          action={
            <Button size="sm" onClick={processNow} disabled={starting}>
              <Wand2 className="h-4 w-4" aria-hidden />
              {starting ? t("take.processStarting") : t("take.processNow")}
            </Button>
          }
        >
          {failed ? (currentJob?.error ?? "") : t("take.manualBody")}
        </Alert>
      ) : null}
      {startError ? (
        <p className="text-caption text-destructive" role="alert">
          {startError}
        </p>
      ) : null}

      {currentJob && !failed ? (
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between gap-2 text-caption">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles
                className={
                  done ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5 text-info"
                }
                aria-hidden
              />
              {t(`take.jobStatus.${currentJob.status}`)}
            </span>
            <span className="timecode text-muted-foreground">
              {Math.round(currentJob.progress * 100)}%
            </span>
          </div>
          <Progress
            className="mt-2"
            value={
              jobRunning && currentJob.progress === 0
                ? null
                : currentJob.progress
            }
            tone={done ? "success" : "info"}
            label={t(`take.jobStatus.${currentJob.status}`)}
          />
          {currentJob.step ? (
            <p className="mt-1.5 truncate text-caption text-muted-foreground">
              {currentJob.step}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button variant={done ? "default" : "outline"} onClick={onReview}>
          <Video className="h-4 w-4" aria-hidden />
          {done ? t("take.reviewNow") : t("take.reviewWhenReady")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onRecordAnother}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span className="truncate">{t("take.recordAnother")}</span>
          </Button>
          <Button variant="ghost" onClick={onBackToLibrary}>
            <LibraryBig className="h-4 w-4" aria-hidden />
            <span className="truncate">{t("take.backToLibrary")}</span>
          </Button>
        </div>
      </div>
    </section>
  );
};
