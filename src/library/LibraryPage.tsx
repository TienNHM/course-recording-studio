import {
  BookOpen,
  CircleHelp,
  Clapperboard,
  ListTodo,
  Loader2,
  Plus,
  Workflow,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { lessonPath as getLessonPath } from "../../config/course";
import type { CourseTree } from "../../scripts/server/course-api";
import { AppHeader } from "../components/AppHeader";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Tooltip } from "../components/ui/tooltip";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { findLesson, useCurrentLesson } from "../state/current-lesson";
import { AutomationDialog } from "./AutomationDialog";
import { CourseOutline, courseStats } from "./CourseOutline";
import { CourseSettingsDialog } from "./CourseSettingsDialog";
import { LessonDetail } from "./LessonDetail";
import { NewCourseDialog } from "./NewCourseDialog";
import {
  OnboardingHint,
  readOnboardingDismissed,
  writeOnboardingDismissed,
} from "./OnboardingHint";
import { NativeSelect } from "./form-fields";
import { EmptyState, SectionLabel } from "./library-ui";

const COURSE_KEY = "crs:library:courseId";
const LESSON_KEY = "crs:library:lessonPath";
const TREE_POLL_MS = 5000;

// Narrow screens: logo without the wordmark so the header never overflows.
const useIsNarrow = () => {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return narrow;
};

const readStored = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const store = (key: string, value: string | null) => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Not persisted: a default selection is used next time.
  }
};

const readStoredCourse = () => readStored(COURSE_KEY);
const storeCourse = (id: string) => store(COURSE_KEY, id);

// First lesson that still needs work, else the first lesson.
const suggestedLesson = (entry: CourseTree[number]) => {
  const lessons = entry.modules.flatMap((m) => m.lessons);
  const open = lessons.find(
    (l) => l.status !== "PUBLISHED" && l.status !== "ARCHIVED",
  );
  const lesson = open ?? lessons[0];
  return lesson ? getLessonPath(lesson) : null;
};

const CourseSidebar: React.FC<{
  readonly tree: CourseTree;
  readonly selectedCourseId: string | null;
  readonly onSelect: (courseId: string) => void;
  readonly onNewCourse: () => void;
}> = ({ tree, selectedCourseId, onSelect, onNewCourse }) => {
  const t = useT("library");
  const tc = useT("common");
  return (
    <nav aria-labelledby="library-courses" className="grid content-start gap-2">
      <div className="flex items-center justify-between px-2">
        <SectionLabel id="library-courses">{t("sidebar.label")}</SectionLabel>
        <Tooltip content={t("newCourse")} side="bottom" align="end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("newCourse")}
            onClick={onNewCourse}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <ul className="grid gap-1">
        {tree.map((entry) => {
          const { course } = entry;
          const stats = courseStats(entry);
          const selected = course.id === selectedCourseId;
          return (
            <li key={course.id}>
              <button
                type="button"
                onClick={() => onSelect(course.id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "grid w-full gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  <BookOpen
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-label">
                    {course.name}
                  </span>
                  <span className="text-2xs uppercase text-muted-foreground">
                    {course.language}
                  </span>
                </span>
                <span className="text-caption text-muted-foreground">
                  {tc("count.lessons", { count: stats.lessons })}
                </span>
                {stats.lessons > 0 ? (
                  <Progress
                    value={stats.published / stats.lessons}
                    tone="success"
                    className="h-1"
                    label={t("sidebar.published", {
                      done: stats.published,
                      total: stats.lessons,
                    })}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export const LibraryPage: React.FC<{
  readonly onRecord: () => void;
  readonly onReview: () => void;
}> = ({ onRecord, onReview }) => {
  const t = useT("library");
  const tc = useT("common");
  const {
    tree,
    error,
    serverOffline,
    loading,
    location,
    lessonPath,
    setCurrentLesson,
    refresh,
  } = useCurrentLesson();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [chosenLessonPath, setChosenLessonPath] = useState<string | null>(
    () => readStored(LESSON_KEY) ?? lessonPath,
  );
  const setSelectedLessonPath = useCallback((path: string | null) => {
    setChosenLessonPath(path);
    store(LESSON_KEY, path);
  }, []);
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const narrow = useIsNarrow();
  const [showOnboarding, setShowOnboarding] = useState(
    () => !readOnboardingDismissed(),
  );

  // Statuses change in the background (automatic jobs, inbox, AI agents).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, TREE_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const selectedCourseId = useMemo(() => {
    if (!tree || tree.length === 0) return null;
    const fromLesson = chosenLessonPath
      ? findLesson(tree, chosenLessonPath)?.course.id
      : undefined;
    const candidates = [
      courseId,
      fromLesson,
      location?.course.id,
      readStoredCourse(),
    ];
    return (
      candidates.find((id) => id && tree.some((e) => e.course.id === id)) ??
      tree[0]?.course.id ??
      null
    );
  }, [chosenLessonPath, courseId, location?.course.id, tree]);

  const entry = tree?.find((e) => e.course.id === selectedCourseId) ?? null;
  // Without a valid choice, open the first lesson that still needs work.
  const chosenValid =
    tree && chosenLessonPath ? findLesson(tree, chosenLessonPath) !== null : false;
  const selectedLessonPath = chosenValid
    ? chosenLessonPath
    : entry
      ? suggestedLesson(entry)
      : null;
  const selected =
    tree && selectedLessonPath ? findLesson(tree, selectedLessonPath) : null;
  const selectedInCourse =
    selected && selected.course.id === selectedCourseId ? selected : null;

  const selectCourse = useCallback(
    (id: string) => {
      setCourseId(id);
      storeCourse(id);
      const next = tree?.find((e) => e.course.id === id);
      setSelectedLessonPath(next ? suggestedLesson(next) : null);
    },
    [setSelectedLessonPath, tree],
  );

  const onRecordLesson = useCallback(
    (path: string) => {
      setCurrentLesson(path);
      onRecord();
    },
    [onRecord, setCurrentLesson],
  );

  const onReviewLesson = useCallback(
    (path: string) => {
      setCurrentLesson(path);
      onReview();
    },
    [onReview, setCurrentLesson],
  );

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    writeOnboardingDismissed(true);
  }, []);

  const hasCourses = Boolean(tree && tree.length > 0);

  const headerActions = (
    <>
      {location ? (
        <Tooltip
          content={t("continueRecording", { lesson: location.lesson.title })}
          side="bottom"
          align="end"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-[16rem]"
            onClick={onRecord}
          >
            <Clapperboard className="h-4 w-4" aria-hidden />
            <span className="hidden truncate xl:inline">
              {t("continueRecording", { lesson: location.lesson.title })}
            </span>
            <span className="hidden md:inline xl:hidden">
              {t("continueRecordingShort")}
            </span>
          </Button>
        </Tooltip>
      ) : null}
      {!showOnboarding ? (
        <Tooltip content={t("onboarding.show")} side="bottom" align="end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("onboarding.show")}
            onClick={() => {
              setShowOnboarding(true);
              writeOnboardingDismissed(false);
            }}
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
          </Button>
        </Tooltip>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t("automation")}
        onClick={() => setAutomationOpen(true)}
        disabled={serverOffline}
      >
        <Workflow className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">{t("automation")}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        aria-label={t("newCourse")}
        onClick={() => setNewCourseOpen(true)}
        disabled={serverOffline}
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">{t("newCourse")}</span>
      </Button>
    </>
  );

  const onboarding = showOnboarding ? (
    <OnboardingHint onDismiss={dismissOnboarding} />
  ) : null;

  let body: React.ReactNode;
  if (loading && !tree) {
    body = (
      <div className="flex flex-1 items-center justify-center gap-2 text-body text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {tc("state.loading")}
      </div>
    );
  } else if (!hasCourses) {
    body = (
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-6">
        <div className="mx-auto grid max-w-4xl gap-6">
          {onboarding}
          {!serverOffline && tree ? (
            <EmptyState
              icon={<BookOpen aria-hidden />}
              title={t("empty.noCourses.title")}
              body={t("empty.noCourses.body")}
              action={
                <Button type="button" onClick={() => setNewCourseOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("empty.noCourses.action")}
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
    );
  } else if (tree && entry) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r p-3 lg:block xl:w-64">
          <CourseSidebar
            tree={tree}
            selectedCourseId={selectedCourseId}
            onSelect={selectCourse}
            onNewCourse={() => setNewCourseOpen(true)}
          />
        </aside>
        <section
          aria-label={entry.course.name}
          className="shrink-0 border-b p-4 lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-[380px]"
        >
          {tree.length > 1 ? (
            <div className="mb-4 lg:hidden">
              <label htmlFor="library-course-select" className="sr-only">
                {t("sidebar.pickCourse")}
              </label>
              <NativeSelect
                id="library-course-select"
                value={selectedCourseId ?? ""}
                onChange={(e) => selectCourse(e.target.value)}
              >
                {tree.map(({ course }) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <CourseOutline
            entry={entry}
            selectedLessonPath={selectedInCourse ? selectedLessonPath : null}
            currentLessonPath={lessonPath}
            onSelectLesson={setSelectedLessonPath}
            onOpenSettings={() => setSettingsOpen(true)}
            refresh={refresh}
          />
        </section>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:overflow-y-auto">
          <div className="mx-auto grid w-full max-w-3xl gap-6">
            {onboarding}
            {selectedInCourse ? (
              <LessonDetail
                key={selectedLessonPath}
                location={selectedInCourse}
                onRecord={onRecordLesson}
                onReview={onReviewLesson}
                refresh={refresh}
              />
            ) : (
              <EmptyState
                icon={<ListTodo aria-hidden />}
                title={t("empty.noSelection.title")}
                body={t("empty.noSelection.body")}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <AppHeader
        title={t("title")}
        actions={headerActions}
        compactBrand={narrow}
      />
      {serverOffline ? (
        <Alert tone="warning" className="m-4 mb-0">
          {t("serverOffline")}
        </Alert>
      ) : error ? (
        <Alert tone="destructive" className="m-4 mb-0">
          {t("loadError", { message: error })}
        </Alert>
      ) : null}
      {body}
      <NewCourseDialog
        open={newCourseOpen}
        onOpenChange={setNewCourseOpen}
        onCreated={async (created) => {
          await refresh();
          setCourseId(created.id);
          storeCourse(created.id);
          setSelectedLessonPath(null);
        }}
      />
      {entry ? (
        <CourseSettingsDialog
          entry={entry}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={refresh}
        />
      ) : null}
      <AutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        course={entry ? { id: entry.course.id, name: entry.course.name } : null}
      />
    </div>
  );
};
