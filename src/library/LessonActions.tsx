import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  Clapperboard,
  ExternalLink,
  FileText,
  Hand,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { JobState, Lesson } from "../../config/course";
import { lessonPath as getLessonPath, publishedPath } from "../../config/course";
import { fetchPublishedFiles, type PublishedFile } from "../actions/automation";
import { publicUrl } from "../actions/production";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/misc";
import { Progress } from "../components/ui/progress";
import { useFormat, useT } from "../i18n";
import { isJobActive, useLessonJob } from "../review/use-job";
import { LessonStepper } from "./LessonStepper";
import {
  deriveLessonFlow,
  describeNext,
  type LessonAction,
} from "./lesson-flow";
import { ConfirmDialog, SectionLabel } from "./library-ui";
import { usePipelineStatus } from "./use-pipeline-status";

const ACTION_ICONS: Record<LessonAction, LucideIcon> = {
  record: Clapperboard,
  process: Sparkles,
  review: ClipboardCheck,
  export: Upload,
  "open-published": ExternalLink,
};

// The most recent of two observations of the lesson's job.
const latestJob = (a: JobState | null, b: JobState | null) => {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
};

const JobStatusCard: React.FC<{
  readonly job: JobState;
  readonly onCancel: () => void;
  readonly busy: boolean;
}> = ({ job, onCancel, busy }) => {
  const t = useT("library");
  const f = useFormat();
  const kind = t(`job.${job.kind}`);

  if (isJobActive(job)) {
    return (
      <div className="grid gap-2 rounded-lg border bg-card p-3" aria-live="polite">
        <div className="flex items-center gap-2">
          <Badge tone="info" pulse>
            {t(`job.status.${job.status}`)}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-label">{kind}</span>
          <span className="timecode text-caption text-muted-foreground">
            {f.formatPercent(job.progress)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy || job.step === "Cancelling"}
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {t("actions.cancelJob")}
          </Button>
        </div>
        <Progress
          value={job.status === "QUEUED" ? null : job.progress}
          tone="info"
          label={t("job.progress", {
            kind,
            percent: f.formatPercent(job.progress),
          })}
        />
        {job.step ? (
          <p className="truncate text-caption text-muted-foreground" title={job.step}>
            {job.step}
          </p>
        ) : null}
      </div>
    );
  }

  if (job.status === "FAILED") {
    return (
      <Alert tone="destructive" title={t("job.failed", { kind })}>
        <span className="break-words">{job.error ?? t("job.unknownError")}</span>
      </Alert>
    );
  }

  if (job.status === "CANCELLED") {
    return (
      <p className="text-caption text-muted-foreground">
        {t("job.cancelled", { kind })}
      </p>
    );
  }

  return null;
};

const PUBLISHED_LABELS: Record<string, string> = {
  "lesson.mp4": "published.video",
  "lesson.srt": "published.srt",
  "lesson.vtt": "published.vtt",
  "chapters.json": "published.chapters",
  "transcript.md": "published.transcript",
  "thumbnail.jpg": "published.thumbnail",
};

const FILE_ORDER = Object.keys(PUBLISHED_LABELS);
const fileRank = (name: string) => {
  const index = FILE_ORDER.indexOf(name);
  return index === -1 ? FILE_ORDER.length : index;
};

const PublishedList: React.FC<{
  readonly lessonPath: string;
  readonly version: string | null;
}> = ({ lessonPath, version }) => {
  const t = useT("library");
  const f = useFormat();
  const [files, setFiles] = useState<PublishedFile[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedFiles(lessonPath)
      .then((res) => !cancelled && setFiles(res.files))
      .catch(() => !cancelled && setFiles([]));
    return () => {
      cancelled = true;
    };
  }, [lessonPath, version]);

  if (files === null) {
    return null;
  }

  const dir = publishedPath(lessonPath);
  const thumbnail = files.find((file) => file.name === "thumbnail.jpg");
  const video = files.find((file) => file.name === "lesson.mp4");

  return (
    <div className="grid gap-2">
      <SectionLabel>{t("published.title")}</SectionLabel>
      {files.length === 0 ? (
        <p className="text-caption text-muted-foreground">{t("published.none")}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          {thumbnail ? (
            <a
              href={publicUrl(`${dir}/${video ? "lesson.mp4" : "thumbnail.jpg"}`, version)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={publicUrl(`${dir}/thumbnail.jpg`, version)}
                alt={t("published.thumbnail")}
                className="aspect-video h-24 rounded-md border object-cover"
              />
            </a>
          ) : null}
          <ul className="grid min-w-0 content-start gap-1">
            {files
              .filter((file) => file.name !== "thumbnail.jpg")
              .sort((a, b) => fileRank(a.name) - fileRank(b.name))
              .map((file) => {
                const labelKey = PUBLISHED_LABELS[file.name];
                return (
                  <li key={file.name} className="flex min-w-0 items-center gap-2">
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <a
                      href={publicUrl(`${dir}/${file.name}`, version)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-body text-primary underline-offset-4 hover:underline"
                    >
                      {labelKey
                        ? t(labelKey as Parameters<typeof t>[0])
                        : file.name}
                    </a>
                    <span className="timecode shrink-0 text-caption text-muted-foreground">
                      {f.formatBytes(file.sizeBytes)}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
};

// Stepper + the one primary action + live job progress + what happens next.
export const LessonActions: React.FC<{
  readonly lesson: Lesson;
  readonly onRecord: (lessonPath: string) => void;
  readonly onReview: (lessonPath: string) => void;
  readonly onChanged: () => Promise<void>;
}> = ({ lesson, onRecord, onReview, onChanged }) => {
  const t = useT("library");
  const path = getLessonPath(lesson);
  const [retranscribe, setRetranscribe] = useState(false);
  const [confirmReprocess, setConfirmReprocess] = useState(false);

  const onSettled = useCallback(() => {
    onChanged();
  }, [onChanged]);
  const {
    job: ownJob,
    busy,
    error,
    process,
    exportLesson,
    cancel,
  } = useLessonJob(path, onSettled);
  const pipeline = usePipelineStatus(path, onSettled);
  const refreshPipeline = pipeline.refresh;

  const job = latestJob(ownJob, pipeline.status?.job ?? null);
  // Refresh "what's next" right after our own job changes state.
  useEffect(() => {
    refreshPipeline();
  }, [ownJob?.id, ownJob?.status, lesson.status, refreshPipeline]);

  const flow = useMemo(() => deriveLessonFlow({ lesson, job }), [job, lesson]);
  const next = describeNext({
    lessonStatus: lesson.status,
    autoProcess: pipeline.status?.autoProcess ?? lesson.postProduction.autoProcess,
    autoPublish: pipeline.status?.autoPublish ?? lesson.postProduction.autoPublish,
    job,
  });

  const processed = lesson.status === "REVIEW" || lesson.status === "PUBLISHED";
  const startProcessing = useCallback(async () => {
    await process(retranscribe);
    await onChanged();
  }, [onChanged, process, retranscribe]);

  const startExport = useCallback(async () => {
    await exportLesson();
    await onChanged();
  }, [exportLesson, onChanged]);

  const publishedVersion = job?.kind === "render" ? job.finishedAt : null;
  const videoUrl = publicUrl(`${publishedPath(path)}/lesson.mp4`, publishedVersion);

  const actionLabel = (action: LessonAction) => {
    switch (action) {
      case "record":
        return lesson.selectedTake ? t("actions.reRecord") : t("actions.record");
      case "process":
        return processed ? t("actions.reProcess") : t("actions.process");
      case "review":
        return t("actions.review");
      case "export":
        return lesson.status === "PUBLISHED"
          ? t("actions.reExport")
          : t("actions.export");
      default:
        return t("actions.openPublished");
    }
  };

  const renderAction = (action: LessonAction, primary: boolean) => {
    const Icon = ACTION_ICONS[action];
    const content = (
      <>
        <Icon className="h-4 w-4" aria-hidden />
        {actionLabel(action)}
      </>
    );
    const variant = primary ? "default" : "outline";
    const size = primary ? "default" : "sm";
    if (action === "open-published") {
      return (
        <Button key={action} asChild variant={variant} size={size}>
          <a href={videoUrl} target="_blank" rel="noreferrer">
            {content}
          </a>
        </Button>
      );
    }
    const onClick = () => {
      if (action === "record") onRecord(path);
      else if (action === "review") onReview(path);
      else if (action === "export") startExport();
      else if (processed) setConfirmReprocess(true);
      else startProcessing();
    };
    return (
      <Button
        key={action}
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        onClick={onClick}
      >
        {content}
      </Button>
    );
  };

  const canChooseRetranscribe =
    flow.primary === "process" || flow.secondary.includes("process");

  return (
    <div className="grid gap-4" data-testid="lesson-actions">
      <LessonStepper steps={flow.steps} />

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-body">
          {flow.waiting === "job"
            ? t("primaryHint.wait")
            : flow.waiting === "archived"
              ? t("primaryHint.archived")
              : flow.primary
                ? t(`primaryHint.${flow.primary}`)
                : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {flow.primary ? renderAction(flow.primary, true) : null}
          {flow.secondary.map((action) => renderAction(action, false))}
        </div>
        {canChooseRetranscribe && lesson.selectedTake ? (
          <label className="flex w-fit cursor-pointer items-start gap-2">
            <Checkbox
              className="mt-1"
              checked={retranscribe}
              onChange={(e) => setRetranscribe(e.target.checked)}
            />
            <span className="grid">
              <span className="text-label">
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {t("actions.retranscribe")}
              </span>
              <span className="text-caption text-muted-foreground">
                {t("actions.retranscribeHint")}
              </span>
            </span>
          </label>
        ) : null}
      </div>

      {error ? <Alert tone="destructive">{error}</Alert> : null}
      {job ? <JobStatusCard job={job} onCancel={cancel} busy={busy} /> : null}

      <div className="flex items-start gap-3 rounded-lg border p-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {next.automatic ? (
            <Bot className="h-4 w-4" aria-hidden />
          ) : next.automatic === false ? (
            <Hand className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel>{t("next.title")}</SectionLabel>
            {next.automatic === true ? (
              <Badge tone="success" size="sm">
                {t("next.auto")}
              </Badge>
            ) : next.automatic === false ? (
              <Badge tone="warning" size="sm">
                {t("next.manual")}
              </Badge>
            ) : null}
          </div>
          <p className="text-body">{t(`next.${next.key}`)}</p>
          {next.lastError && !(job && job.status === "FAILED") ? (
            <p className="break-words text-caption text-destructive">
              {t("next.lastFailed", { error: next.lastError })}
            </p>
          ) : null}
        </div>
      </div>

      {lesson.status === "PUBLISHED" && !isJobActive(job) ? (
        <PublishedList lessonPath={path} version={publishedVersion} />
      ) : null}

      <ConfirmDialog
        open={confirmReprocess}
        onOpenChange={setConfirmReprocess}
        title={t("confirm.reProcessTitle")}
        description={t("confirm.reProcessBody")}
        confirmLabel={t("confirm.reProcess")}
        onConfirm={startProcessing}
      />
    </div>
  );
};
