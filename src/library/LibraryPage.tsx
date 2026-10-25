import React, { useCallback, useState } from "react";
import { Logo } from "../Logo";
import { SettingsButton } from "../components/settings/SettingsDialog";
import { cn } from "../helpers/utils";
import { findLesson, useCurrentLesson } from "../state/current-lesson";
import { CourseOutline } from "./CourseOutline";
import { CourseSettingsDialog } from "./CourseSettingsDialog";
import { LessonActions } from "./LessonActions";
import { LessonForm } from "./LessonForm";
import { NewCourseDialog } from "./NewCourseDialog";

export const LibraryPage: React.FC<{
  readonly onRecord: () => void;
  readonly onReview: () => void;
}> = ({ onRecord, onReview }) => {
  const { tree, error, location, lessonPath, setCurrentLesson, refresh } =
    useCurrentLesson();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [selectedLessonPath, setSelectedLessonPath] = useState<string | null>(
    lessonPath,
  );

  const selectedCourseId =
    courseId ?? location?.course.id ?? tree?.[0]?.course.id ?? null;
  const entry = tree?.find((e) => e.course.id === selectedCourseId) ?? null;
  const selected =
    tree && selectedLessonPath ? findLesson(tree, selectedLessonPath) : null;

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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <Logo />
        <span className="text-sm text-muted-foreground">Course Library</span>
        <div className="flex-1" />
        {location ? (
          <button
            type="button"
            className="text-sm text-sky-400 hover:underline"
            onClick={onRecord}
          >
            Continue recording: {location.lesson.title}
          </button>
        ) : null}
        <NewCourseDialog
          onCreated={async (created) => {
            await refresh();
            setCourseId(created.id);
          }}
        />
        <SettingsButton />
      </header>
      {error ? <div className="p-4 text-sm text-red-400">{error}</div> : null}
      <div className="flex min-h-0 flex-1">
        <nav className="w-60 shrink-0 overflow-y-auto border-r p-3">
          {tree?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No courses yet. Create one to get started.
            </p>
          ) : null}
          {tree?.map(({ course }) => (
            <button
              key={course.id}
              type="button"
              onClick={() => setCourseId(course.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                course.id === selectedCourseId && "bg-accent",
              )}
            >
              <span className="flex-1 truncate">{course.name}</span>
              <span className="text-xs uppercase text-muted-foreground">
                {course.language}
              </span>
            </button>
          ))}
        </nav>
        <main className="w-[420px] shrink-0 overflow-y-auto border-r p-4">
          {entry ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-2">
                <h1 className="flex-1 truncate text-lg font-semibold">
                  {entry.course.name}
                </h1>
                <CourseSettingsDialog
                  key={entry.course.id}
                  course={entry.course}
                  onSaved={refresh}
                />
              </div>
              <CourseOutline
                entry={entry}
                selectedLessonPath={selectedLessonPath}
                currentLessonPath={lessonPath}
                onSelectLesson={setSelectedLessonPath}
                refresh={refresh}
              />
            </div>
          ) : null}
        </main>
        <section className="min-w-0 flex-1 overflow-y-auto p-4">
          {selected ? (
            <div className="max-w-2xl">
              <p className="mb-2 text-xs text-muted-foreground">
                {selected.course.name} › {selected.module.title}
              </p>
              <div className="mb-5">
                <LessonActions
                  key={selectedLessonPath}
                  lesson={selected.lesson}
                  onRecord={onRecordLesson}
                  onReview={onReviewLesson}
                  onChanged={refresh}
                />
              </div>
              <LessonForm
                key={selectedLessonPath}
                lesson={selected.lesson}
                onSaved={refresh}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a lesson to edit it.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
