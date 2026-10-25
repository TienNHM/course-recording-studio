import type { Caption } from "@remotion/captions";
import { SettingsButton } from "../components/settings/SettingsDialog";
import { ArrowLeft } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EditPlan, JobState } from "../../config/course";
import { productionPath } from "../../config/course";
import {
  mapOriginalToOutputSnapped,
  mapOutputToOriginal,
  normalizeSegments,
} from "../../remotion/lesson/timeline";
import type { EditPlanPatch } from "../../scripts/server/production/edit-plan";
import { Logo } from "../Logo";
import {
  fetchCaptions,
  fetchEditPlan,
  fetchPublicJson,
  updateCaptions,
  updateEditPlan,
} from "../actions/production";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../library/StatusBadge";
import { useCurrentLesson } from "../state/current-lesson";
import { ChaptersPanel } from "./ChaptersPanel";
import { CutsPanel } from "./CutsPanel";
import { JobProgress } from "./JobProgress";
import type { LessonPreviewHandle } from "./LessonPreview";
import { LessonPreview } from "./LessonPreview";
import { SettingsPanel } from "./SettingsPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { useLessonJob } from "./use-job";
import { useLessonMetadata } from "./use-lesson-metadata";

// Subset of production/analysis.json the review page needs.
type Analysis = { takeId: string; webcam: string | null };

const ReviewContent: React.FC<{
  readonly lessonPath: string;
  readonly lessonTitle: string;
  readonly onBack: () => void;
  readonly refresh: () => Promise<void>;
}> = ({ lessonPath, lessonTitle, onBack, refresh }) => {
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const preview = useRef<LessonPreviewHandle>(null);
  const { metadata, error: previewError } = useLessonMetadata(
    lessonPath,
    previewVersion,
  );

  useEffect(() => {
    fetchEditPlan(lessonPath)
      .then(setPlan)
      .catch((e) => setError((e as Error).message));
    fetchPublicJson<Analysis>(`${productionPath(lessonPath)}/analysis.json`)
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
    fetchCaptions(lessonPath)
      .then(setCaptions)
      .catch(() => setCaptions(null));
  }, [lessonPath]);

  const onJobSettled = useCallback(
    async (job: JobState) => {
      await refresh();
      if (job.kind === "render" && job.status === "COMPLETED") {
        onBack();
      }
    },
    [onBack, refresh],
  );
  const job = useLessonJob(lessonPath, onJobSettled);
  const locked = saving || job.active;

  const segments = useMemo(
    () =>
      plan ? normalizeSegments(plan.segments, plan.durationMs ?? null) : [],
    [plan],
  );

  const seekOriginal = useCallback(
    (ms: number) => {
      const output = mapOriginalToOutputSnapped(ms, segments);
      if (output !== null) {
        preview.current?.seekToOutputMs(output);
      }
    },
    [segments],
  );

  const getPlayheadMs = useCallback(() => {
    if (!preview.current) {
      return null;
    }

    return mapOutputToOriginal(preview.current.getOutputMs(), segments);
  }, [segments]);

  const save = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      setPreviewVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  const savePlan = useCallback(
    (patch: EditPlanPatch) =>
      save(async () => {
        setPlan(await updateEditPlan(lessonPath, patch));
      }),
    [lessonPath, save],
  );

  const saveCaptions = useCallback(
    (next: Caption[]) =>
      save(async () => {
        setCaptions(await updateCaptions(lessonPath, next));
      }),
    [lessonPath, save],
  );

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-4">
        <div className="overflow-hidden rounded-md border bg-black">
          {metadata ? (
            <LessonPreview ref={preview} metadata={metadata} />
          ) : (
            <div className="flex aspect-video items-center justify-center p-4 text-sm text-muted-foreground">
              {previewError ?? "Loading preview…"}
            </div>
          )}
        </div>
        {metadata && previewError ? (
          <p className="text-sm text-red-400">Preview: {previewError}</p>
        ) : null}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={locked || !plan}
            onClick={job.exportLesson}
          >
            Approve and export
          </Button>
          {saving ? (
            <span className="text-sm text-muted-foreground">Saving…</span>
          ) : null}
          {(error ?? job.error) ? (
            <span className="text-sm text-red-400">{error ?? job.error}</span>
          ) : null}
        </div>
        <JobProgress job={job.job} onCancel={job.cancel} busy={job.busy} />
        {plan ? (
          <CutsPanel
            cuts={plan.cuts}
            disabled={locked}
            onSeek={seekOriginal}
            onToggle={(cuts) => {
              if (cuts.length > 0) {
                savePlan({ cuts });
              }
            }}
          />
        ) : null}
      </div>
      {plan ? (
        <div className="grid content-start gap-4">
          <ChaptersPanel
            chapters={plan.chapters}
            disabled={locked}
            getPlayheadMs={getPlayheadMs}
            onSeek={seekOriginal}
            onSave={(chapters) => savePlan({ chapters })}
          />
          <SettingsPanel
            plan={plan}
            lessonTitle={lessonTitle}
            hasWebcam={
              analysis?.takeId === plan.takeId && analysis.webcam !== null
            }
            disabled={locked}
            onSave={savePlan}
          />
          <TranscriptPanel
            captions={captions}
            disabled={locked}
            onSeek={seekOriginal}
            onSave={saveCaptions}
          />
        </div>
      ) : null}
    </div>
  );
};

export const ReviewPage: React.FC<{
  readonly onBack: () => void;
}> = ({ onBack }) => {
  const { lesson, location, lessonPath, refresh, tree } = useCurrentLesson();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <Logo />
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Library
        </Button>
        <span className="text-sm text-muted-foreground">Review</span>
        {location ? (
          <span className="truncate text-sm">
            {location.course.name} › {location.module.title} ›{" "}
            <b>{location.lesson.title}</b>
          </span>
        ) : null}
        {lesson ? <StatusBadge status={lesson.status} /> : null}
        <div className="flex-1" />
        <SettingsButton />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lesson && lessonPath ? (
          <ReviewContent
            key={lessonPath}
            lessonPath={lessonPath}
            lessonTitle={lesson.title}
            onBack={onBack}
            refresh={refresh}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {tree ? "Select a lesson in the library first." : "Loading…"}
          </p>
        )}
      </div>
    </div>
  );
};
