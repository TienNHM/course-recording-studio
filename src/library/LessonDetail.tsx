import { ChevronRight, Clock, Scissors } from "lucide-react";
import React, { useEffect, useState } from "react";
import { lessonPath as getLessonPath } from "../../config/course";
import { fetchEditPlan } from "../actions/production";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Separator } from "../components/ui/misc";
import { useFormat, useT } from "../i18n";
import type { LessonLocation } from "../state/current-lesson";
import { LessonActions } from "./LessonActions";
import { LessonForm } from "./LessonForm";

type Durations = { takeMs: number | null; keptMs: number };

// Take / kept duration from the edit plan, when post-production ran.
const useDurations = (lessonPath: string, enabled: boolean, version: string) => {
  const [durations, setDurations] = useState<Durations | null>(null);
  useEffect(() => {
    if (!enabled) {
      setDurations(null);
      return;
    }
    let cancelled = false;
    fetchEditPlan(lessonPath)
      .then((plan) => {
        if (cancelled) return;
        setDurations({
          takeMs: plan.durationMs ?? null,
          keptMs: plan.segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0),
        });
      })
      .catch(() => !cancelled && setDurations(null));
    return () => {
      cancelled = true;
    };
  }, [enabled, lessonPath, version]);
  return durations;
};

export const LessonDetail: React.FC<{
  readonly location: LessonLocation;
  readonly onRecord: (lessonPath: string) => void;
  readonly onReview: (lessonPath: string) => void;
  readonly refresh: () => Promise<void>;
}> = ({ location, onRecord, onReview, refresh }) => {
  const t = useT("library");
  const f = useFormat();
  const { course, module, lesson } = location;
  const path = getLessonPath(lesson);
  const durations = useDurations(
    path,
    lesson.status === "REVIEW" || lesson.status === "PUBLISHED",
    `${lesson.status}:${lesson.selectedTake}`,
  );

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6" aria-labelledby="lesson-heading">
      <header className="grid gap-2">
        <nav
          aria-label="breadcrumb"
          className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground"
        >
          <span className="truncate">{course.name}</span>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{module.title}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="lesson-heading" className="min-w-0 break-words text-title">
            {lesson.title}
          </h2>
          <LessonStatusBadge status={lesson.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          {lesson.selectedTake === null ? (
            <span>{t("detail.noTake")}</span>
          ) : null}
          {durations?.takeMs ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {t("detail.takeDuration", {
                duration: f.formatDuration(durations.takeMs),
              })}
            </span>
          ) : null}
          {durations && durations.keptMs > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              {t("detail.keptDuration", {
                duration: f.formatDuration(durations.keptMs),
              })}
            </span>
          ) : null}
        </div>
      </header>

      <LessonActions
        lesson={lesson}
        onRecord={onRecord}
        onReview={onReview}
        onChanged={refresh}
      />

      <Separator />

      <LessonForm lesson={lesson} onSaved={refresh} />
    </article>
  );
};
