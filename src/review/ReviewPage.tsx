import type { Caption } from "@remotion/captions";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Flag,
  Loader2,
  Rocket,
  Scissors,
  SlidersHorizontal,
  Subtitles,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EditPlan, JobState } from "../../config/course";
import { productionPath } from "../../config/course";
import { normalizeSegments } from "../../remotion/lesson/timeline";
import {
  applyEditPlanPatch,
  type EditPlanPatch,
} from "../../scripts/server/production/edit-plan";
import {
  fetchCaptions,
  fetchEditPlan,
  fetchPublicJson,
  updateCaptions,
  updateEditPlan,
} from "../actions/production";
import { AppHeader } from "../components/AppHeader";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { useCurrentLesson } from "../state/current-lesson";
import { ChaptersPanel } from "./ChaptersPanel";
import { CutsPanel } from "./CutsPanel";
import { JobProgress } from "./JobProgress";
import type { LessonPreviewHandle } from "./LessonPreview";
import { LessonPreview } from "./LessonPreview";
import { usePlayerMs, usePlayheadStore, type PlayheadStore } from "./playhead";
import { PublishedFiles } from "./PublishedFiles";
import { fetchPipelineStatus, type PipelineStatus } from "../actions/automation";
import {
  computeReviewSummary,
  originalMsToPlayerMs,
  planDurationMs,
  playerMsToOriginalMs,
  stepCut,
  type Chapter,
  type CutChange,
} from "./review-helpers";
import { ReviewTabs } from "./ReviewTabs";
import { ReviewTimeline } from "./ReviewTimeline";
import { SettingsPanel } from "./SettingsPanel";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { SummaryBar } from "./SummaryBar";
import { TranscriptPanel } from "./TranscriptPanel";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { isJobActive, useLessonJob } from "./use-job";
import { useLessonMetadata } from "./use-lesson-metadata";

// Subset of production/analysis.json the review page needs.
type Analysis = { takeId: string; webcam: string | null };

type TabId = "cuts" | "chapters" | "transcript" | "settings";
type DirtyKey = "chapters" | "transcript" | "settings";

const TAB_STORAGE_KEY = "crs:review-tab";
const SEEK_STEP_MS = 5000;
// Seek a little before a cut so its context is visible.
const CUT_PREROLL_MS = 1000;

const loadTab = (): TabId => {
  try {
    const value = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (
      value === "cuts" ||
      value === "chapters" ||
      value === "transcript" ||
      value === "settings"
    ) {
      return value;
    }
  } catch {
    // storage unavailable
  }
  return "cuts";
};

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable ||
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT")
  );
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
};

/** Timeline wrapper that follows the playhead without re-rendering the page. */
const LiveTimeline: React.FC<
  Omit<React.ComponentProps<typeof ReviewTimeline>, "playheadMs"> & {
    readonly playhead: PlayheadStore;
    readonly toOriginalMs: (playerMs: number) => number | null;
  }
> = ({ playhead, toOriginalMs, ...props }) => {
  const playerMs = usePlayerMs(playhead);
  return <ReviewTimeline {...props} playheadMs={toOriginalMs(playerMs)} />;
};

const SaveIndicator: React.FC<{
  readonly pending: boolean;
  readonly failed: boolean;
  readonly dirty: boolean;
  readonly saved: boolean;
}> = ({ pending, failed, dirty, saved }) => {
  const t = useT("review");
  const state = pending
    ? { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: t("save.saving"), tone: "text-muted-foreground" }
    : failed
      ? { icon: <AlertCircle className="h-4 w-4" />, text: t("save.failed"), tone: "text-destructive" }
      : dirty
        ? { icon: <span className="h-2 w-2 rounded-full bg-warning" />, text: t("save.unsaved"), tone: "text-warning" }
        : saved
          ? { icon: <Check className="h-4 w-4" />, text: t("save.saved"), tone: "text-success" }
          : null;
  if (!state) {
    return null;
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-caption", state.tone)}
      role="status"
      title={state.text}
      data-testid="save-indicator"
    >
      <span aria-hidden className="flex items-center">
        {state.icon}
      </span>
      <span className="hidden xl:inline">{state.text}</span>
    </span>
  );
};

const ReviewContent: React.FC<{
  readonly lessonPath: string;
  readonly onBack: () => void;
}> = ({ lessonPath, onBack }) => {
  const t = useT("review");
  const { location, refresh } = useCurrentLesson();
  const lesson = location?.lesson ?? null;
  const course = location?.course ?? null;
  const wideHeader = useMediaQuery("(min-width: 1280px)");

  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [focusedCut, setFocusedCut] = useState<number | null>(null);
  const [tab, setTabState] = useState<TabId>(loadTab);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dirty, setDirty] = useState<Record<DirtyKey, boolean>>({
    chapters: false,
    transcript: false,
    settings: false,
  });
  const [resetToken, setResetToken] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(
    null,
  );

  const preview = useRef<LessonPreviewHandle>(null);
  const playhead = usePlayheadStore();
  const { metadata, error: previewError } = useLessonMetadata(
    lessonPath,
    previewVersion,
  );

  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  // --- Loading -------------------------------------------------------------

  const loadPlan = useCallback(
    () =>
      fetchEditPlan(lessonPath)
        .then((p) => {
          setPlan(p);
          setPlanError(null);
          return p;
        })
        .catch((e) => {
          setPlanError((e as Error).message);
          return null;
        }),
    [lessonPath],
  );
  const loadCaptions = useCallback(
    () =>
      fetchCaptions(lessonPath)
        .then(setCaptions)
        .catch(() => setCaptions(null)),
    [lessonPath],
  );
  const loadPipeline = useCallback(
    () =>
      fetchPipelineStatus(lessonPath)
        .then(setPipeline)
        .catch(() => setPipeline(null)),
    [lessonPath],
  );

  useEffect(() => {
    loadPlan();
    loadCaptions();
    loadPipeline();
    fetchPublicJson<Analysis>(`${productionPath(lessonPath)}/analysis.json`)
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
  }, [lessonPath, loadCaptions, loadPipeline, loadPlan]);

  // --- Jobs ----------------------------------------------------------------

  const onJobSettled = useCallback(
    async (settled: JobState) => {
      await refresh();
      loadPipeline();
      if (settled.kind === "production" && settled.status === "COMPLETED") {
        loadPlan();
        loadCaptions();
        setPreviewVersion((v) => v + 1);
      }
    },
    [loadCaptions, loadPipeline, loadPlan, refresh],
  );
  const job = useLessonJob(lessonPath, onJobSettled);
  const locked = job.active;
  const rendering = job.active && job.job?.kind === "render";

  // Keep the status/next step current while a job runs.
  const jobStatus = job.job?.status;
  useEffect(() => {
    if (jobStatus) {
      loadPipeline();
    }
  }, [jobStatus, loadPipeline]);

  // --- Optimistic saving -------------------------------------------------------

  const queue = useRef<Promise<void>>(Promise.resolve());
  const inflight = useRef({ plan: 0, captions: 0 });
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveFailed, setSaveFailed] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const planRef = useRef(plan);
  planRef.current = plan;
  const captionsRef = useRef(captions);
  captionsRef.current = captions;

  const enqueue = useCallback(
    (kind: "plan" | "captions", task: (last: boolean) => Promise<void>) => {
      inflight.current[kind]++;
      setPendingSaves((n) => n + 1);
      return new Promise<boolean>((resolve) => {
        queue.current = queue.current.then(async () => {
          inflight.current[kind]--;
          const last = inflight.current[kind] === 0;
          try {
            await task(last);
            setSaveFailed(null);
            setSavedOnce(true);
            resolve(true);
          } catch (e) {
            setSaveFailed((e as Error).message);
            resolve(false);
          } finally {
            setPendingSaves((n) => n - 1);
          }
        });
      });
    },
    [],
  );

  const patchPlan = useCallback(
    (patch: EditPlanPatch): Promise<boolean> => {
      const before = planRef.current;
      if (!before) {
        return Promise.resolve(false);
      }
      try {
        setPlan(applyEditPlanPatch(before, patch, planDurationMs(before)));
      } catch {
        // Invalid locally (stale index) — let the server decide.
      }
      return enqueue("plan", async (last) => {
        try {
          const saved = await updateEditPlan(lessonPath, patch);
          if (last) {
            setPlan(saved);
            setPreviewVersion((v) => v + 1);
          }
        } catch (e) {
          // Roll back to what the server has.
          const server = await fetchEditPlan(lessonPath).catch(() => before);
          setPlan(server);
          throw e;
        }
      });
    },
    [enqueue, lessonPath],
  );

  const saveCaptions = useCallback(
    (next: Caption[]): Promise<boolean> => {
      const before = captionsRef.current;
      setCaptions(next);
      return enqueue("captions", async (last) => {
        try {
          const saved = await updateCaptions(lessonPath, next);
          if (last) {
            setCaptions(saved);
            setPreviewVersion((v) => v + 1);
          }
        } catch (e) {
          const server = await fetchCaptions(lessonPath).catch(() => before);
          setCaptions(server);
          throw e;
        }
      });
    },
    [enqueue, lessonPath],
  );

  const changeCuts = useCallback(
    (changes: CutChange[]) => {
      if (changes.length > 0 && !locked) {
        patchPlan({ cuts: changes });
      }
    },
    [locked, patchPlan],
  );

  // --- Unsaved-changes guard -------------------------------------------------

  const setDirtyFor = useMemo(
    () =>
      Object.fromEntries(
        (["chapters", "transcript", "settings"] as const).map((key) => [
          key,
          (value: boolean) =>
            setDirty((d) => (d[key] === value ? d : { ...d, [key]: value })),
        ]),
      ) as Record<DirtyKey, (value: boolean) => void>,
    [],
  );
  const dirtyKeys = (Object.keys(dirty) as DirtyKey[]).filter((k) => dirty[k]);
  const anyDirty = dirtyKeys.length > 0;

  useEffect(() => {
    if (!anyDirty && pendingSaves === 0) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty, pendingSaves]);

  const guard = useCallback(
    (action: () => void) => {
      if (anyDirty) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [anyDirty],
  );

  const discardAndContinue = () => {
    const action = pendingAction;
    setPendingAction(null);
    setResetToken((n) => n + 1);
    setDirty({ chapters: false, transcript: false, settings: false });
    action?.();
  };

  const startExport = useCallback(() => {
    guard(async () => {
      // Let optimistic saves land before the renderer reads the plan.
      await queue.current;
      job.exportLesson();
    });
  }, [guard, job]);

  // --- Preview ↔ original take ------------------------------------------------

  const durationMs = plan ? planDurationMs(plan) : 0;
  const segments = useMemo(
    () => (plan ? normalizeSegments(plan.segments, durationMs) : []),
    [durationMs, plan],
  );
  const introMs = metadata?.props.info?.introDurationInMs ?? 0;

  const toOriginalMs = useCallback(
    (playerMs: number) => playerMsToOriginalMs(playerMs, introMs, segments),
    [introMs, segments],
  );

  const seekOriginal = useCallback(
    (ms: number) => {
      const playerMs = originalMsToPlayerMs(ms, introMs, segments);
      if (playerMs !== null) {
        preview.current?.seekToPlayerMs(playerMs);
        playhead.set(playerMs);
      }
    },
    [introMs, playhead, segments],
  );

  const getPlayheadOriginal = useCallback(
    () => toOriginalMs(playhead.get()),
    [playhead, toOriginalMs],
  );

  const focusCut = useCallback(
    (index: number) => {
      const cut = planRef.current?.cuts[index];
      if (!cut) {
        return;
      }
      setFocusedCut(index);
      seekOriginal(Math.max(0, cut.startMs - CUT_PREROLL_MS));
    },
    [seekOriginal],
  );

  const toggleCut = useCallback(
    (index: number) => {
      const cut = planRef.current?.cuts[index];
      if (!cut) {
        return;
      }
      setFocusedCut(index);
      changeCuts([{ index, accepted: !cut.accepted }]);
    },
    [changeCuts],
  );

  // --- Keyboard shortcuts -----------------------------------------------------

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    if (isTyping(e.target)) {
      return;
    }
    if (document.querySelector('[role="dialog"], [role="menu"]')) {
      return;
    }
    const target = e.target as HTMLElement | null;
    const role = target?.getAttribute?.("role");
    const key = e.key;
    const lower = key.toLowerCase();

    if (key === " " || lower === "k") {
      e.preventDefault();
      preview.current?.toggle();
    } else if (lower === "j") {
      e.preventDefault();
      preview.current?.seekBy(-SEEK_STEP_MS);
    } else if (lower === "l") {
      e.preventDefault();
      preview.current?.seekBy(SEEK_STEP_MS);
    } else if (lower === "a") {
      if (focusedCut !== null) {
        e.preventDefault();
        toggleCut(focusedCut);
      }
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
      if (role === "tab" || role === "radio" || role === "slider") {
        return;
      }
      const cuts = planRef.current?.cuts ?? [];
      const next = stepCut(
        cuts,
        focusedCut,
        getPlayheadOriginal() ?? 0,
        key === "ArrowRight" ? 1 : -1,
      );
      if (next !== null) {
        e.preventDefault();
        setTab("cuts");
        focusCut(next);
      }
    } else if (key === "?") {
      e.preventDefault();
      setHelpOpen(true);
    }
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // --- Derived ---------------------------------------------------------------

  const summary = useMemo(
    () => (plan ? computeReviewSummary(plan, captions) : null),
    [captions, plan],
  );
  const outputChapters: Chapter[] | null = metadata?.props.info
    ? metadata.props.chapters
    : null;
  const totalMs = metadata
    ? Math.round((metadata.durationInFrames / metadata.fps) * 1000)
    : null;
  const lastRender = job.job?.kind === "render" ? job.job : null;
  const renderDone = lastRender?.status === "COMPLETED";
  const published = renderDone || lesson?.status === "PUBLISHED";
  const publishedVersion = lastRender?.finishedAt ?? null;
  const showExportCard =
    published || (job.job !== null && (isJobActive(job.job) || job.job.status !== "COMPLETED"));

  const tabNames: Record<DirtyKey, string> = {
    chapters: t("tabs.chapters"),
    transcript: t("tabs.transcript"),
    settings: t("tabs.settings"),
  };

  const header = (
    <AppHeader
      compactBrand={!wideHeader}
      leading={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => guard(onBack)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("backToLibrary")}</span>
        </Button>
      }
      title={t("title")}
      subtitle={
        location ? (
          <span title={`${location.course.name} › ${location.module.title} › ${location.lesson.title}`}>
            {location.course.name} › {location.module.title} ›{" "}
            <span className="text-foreground">{location.lesson.title}</span>
          </span>
        ) : null
      }
      actions={
        <>
          <SaveIndicator
            pending={pendingSaves > 0}
            failed={saveFailed !== null}
            dirty={anyDirty}
            saved={savedOnce}
          />
          <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
          <Button
            type="button"
            size="sm"
            disabled={locked || job.busy || !plan}
            title={t("export.approveHint")}
            onClick={startExport}
            data-testid="approve-export"
          >
            {rendering ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="h-4 w-4" aria-hidden />
            )}
            {t("export.approve")}
          </Button>
        </>
      }
    />
  );

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {header}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 md:px-6">
          {planError && !plan ? (
            <Alert
              tone="warning"
              title={t("noPlan.title")}
              action={
                <Button type="button" size="sm" variant="outline" onClick={onBack}>
                  {t("openLibrary")}
                </Button>
              }
            >
              {t("noPlan.description")}
              <span className="block text-caption">
                {t("loadError", { message: planError })}
              </span>
            </Alert>
          ) : null}

          {summary ? (
            <SummaryBar
              summary={summary}
              totalMs={totalMs}
              status={lesson?.status ?? null}
              pipeline={pipeline}
              rendering={rendering}
            />
          ) : null}

          {saveFailed ? (
            <Alert tone="destructive" title={t("save.failed")}>
              {saveFailed}
            </Alert>
          ) : null}
          {locked ? (
            <Alert tone="info">{t("export.locked")}</Alert>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-start xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
            {/* Preview, timeline, export */}
            <div className="grid min-w-0 gap-4">
              <div
                className="overflow-hidden rounded-lg border bg-muted"
                aria-label={t("preview.label")}
                role="region"
              >
                {metadata ? (
                  <LessonPreview
                    ref={preview}
                    metadata={metadata}
                    onFrame={playhead.set}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center gap-2 p-4 text-body text-muted-foreground">
                    {previewError ? (
                      t("preview.error", { message: previewError })
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {t("preview.loading")}
                      </>
                    )}
                  </div>
                )}
              </div>
              {metadata && previewError ? (
                <Alert tone="destructive">
                  {t("preview.error", { message: previewError })}
                </Alert>
              ) : null}

              {plan ? (
                <Card className="p-4">
                  <LiveTimeline
                    playhead={playhead}
                    toOriginalMs={toOriginalMs}
                    durationMs={durationMs}
                    segments={segments}
                    cuts={plan.cuts}
                    chapters={plan.chapters}
                    focusedCut={focusedCut}
                    disabled={locked}
                    onSeek={seekOriginal}
                    onToggleCut={toggleCut}
                  />
                </Card>
              ) : null}

              {showExportCard ? (
                <Card className="grid gap-3 p-4" data-testid="export-card">
                  <h2 className="text-heading">{t("export.title")}</h2>
                  <JobProgress
                    job={job.job}
                    busy={job.busy}
                    onCancel={job.cancel}
                    onRetry={startExport}
                  />
                  {job.error ? <Alert tone="destructive">{job.error}</Alert> : null}
                  {renderDone ? (
                    <Alert tone="success" title={t("export.success")}>
                      {t("export.successHint")}
                    </Alert>
                  ) : null}
                  {published && !rendering ? (
                    <PublishedFiles
                      lessonPath={lessonPath}
                      version={publishedVersion}
                    />
                  ) : null}
                </Card>
              ) : job.error ? (
                <Alert tone="destructive">{job.error}</Alert>
              ) : null}
            </div>

            {/* Side panels as tabs */}
            {plan ? (
              <aside
                className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground lg:sticky lg:top-0 lg:max-h-[calc(100dvh-3.5rem-2rem)]"
                aria-label={t("tabs.label")}
              >
                <ReviewTabs
                  label={t("tabs.label")}
                  unsavedLabel={t("tabs.unsaved")}
                  value={tab}
                  onValueChange={(id) => setTab(id as TabId)}
                  tabs={[
                    {
                      id: "cuts",
                      label: t("tabs.cuts"),
                      icon: <Scissors className="h-4 w-4" aria-hidden />,
                      count: summary?.pendingSuggestions || null,
                      countTone: "warning",
                    },
                    {
                      id: "chapters",
                      label: t("tabs.chapters"),
                      icon: <Flag className="h-4 w-4" aria-hidden />,
                      count: plan.chapters.length,
                      dirty: dirty.chapters,
                    },
                    {
                      id: "transcript",
                      label: t("tabs.transcript"),
                      icon: <Subtitles className="h-4 w-4" aria-hidden />,
                      dirty: dirty.transcript,
                    },
                    {
                      id: "settings",
                      label: t("tabs.settings"),
                      icon: <SlidersHorizontal className="h-4 w-4" aria-hidden />,
                      dirty: dirty.settings,
                    },
                  ]}
                />
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div
                    role="tabpanel"
                    id="review-panel-cuts"
                    aria-labelledby="review-tab-cuts"
                    hidden={tab !== "cuts"}
                  >
                    <CutsPanel
                      cuts={plan.cuts}
                      focusedCut={focusedCut}
                      disabled={locked}
                      autoRemoveSilence={
                        lesson?.postProduction.autoRemoveSilence ?? null
                      }
                      onChange={changeCuts}
                      onFocusCut={focusCut}
                    />
                  </div>
                  <div
                    role="tabpanel"
                    id="review-panel-chapters"
                    aria-labelledby="review-tab-chapters"
                    hidden={tab !== "chapters"}
                  >
                    <ChaptersPanel
                      chapters={plan.chapters}
                      segments={segments}
                      durationMs={durationMs}
                      outputChapters={outputChapters}
                      firstTitle={plan.intro?.title ?? lesson?.title ?? ""}
                      disabled={locked}
                      resetToken={resetToken}
                      getPlayheadMs={getPlayheadOriginal}
                      onSeek={seekOriginal}
                      onSave={(chapters) => patchPlan({ chapters })}
                      onDirtyChange={setDirtyFor.chapters}
                    />
                  </div>
                  <div
                    role="tabpanel"
                    id="review-panel-transcript"
                    aria-labelledby="review-tab-transcript"
                    hidden={tab !== "transcript"}
                  >
                    <TranscriptPanel
                      captions={captions}
                      glossary={course?.glossary ?? []}
                      disabled={locked}
                      resetToken={resetToken}
                      playhead={playhead}
                      toOriginalMs={toOriginalMs}
                      onSeek={seekOriginal}
                      onSave={saveCaptions}
                      onDirtyChange={setDirtyFor.transcript}
                    />
                  </div>
                  <div
                    role="tabpanel"
                    id="review-panel-settings"
                    aria-labelledby="review-tab-settings"
                    hidden={tab !== "settings"}
                  >
                    <SettingsPanel
                      plan={plan}
                      lessonTitle={lesson?.title ?? ""}
                      hasWebcam={
                        analysis?.takeId === plan.takeId && analysis.webcam !== null
                      }
                      videoStyle={course?.videoStyle ?? null}
                      disabled={locked}
                      resetToken={resetToken}
                      onSave={patchPlan}
                      onDirtyChange={setDirtyFor.settings}
                      onOpenLibrary={() => guard(onBack)}
                    />
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </main>

      <UnsavedChangesDialog
        open={pendingAction !== null}
        panels={dirtyKeys.map((k) => tabNames[k])}
        onStay={() => setPendingAction(null)}
        onDiscard={discardAndContinue}
      />
    </div>
  );
};

export const ReviewPage: React.FC<{
  readonly onBack: () => void;
}> = ({ onBack }) => {
  const t = useT("review");
  const tc = useT("common");
  const { lesson, lessonPath, tree } = useCurrentLesson();

  if (lesson && lessonPath) {
    return <ReviewContent key={lessonPath} lessonPath={lessonPath} onBack={onBack} />;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <AppHeader
        leading={
          <Button type="button" variant="ghost" size="sm" className="px-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t("backToLibrary")}</span>
          </Button>
        }
        title={t("title")}
      />
      <main className="flex flex-1 items-center justify-center p-6">
        {tree ? (
          <div className="grid max-w-md justify-items-center gap-3 text-center">
            <p className="text-body text-muted-foreground">{t("noLesson")}</p>
            <Button type="button" onClick={onBack}>
              {t("openLibrary")}
            </Button>
          </div>
        ) : (
          <p className="inline-flex items-center gap-2 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {tc("state.loading")}
          </p>
        )}
      </main>
    </div>
  );
};
