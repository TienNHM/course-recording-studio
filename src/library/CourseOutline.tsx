import { FolderPlus, Plus, Settings2, Video } from "lucide-react";
import React, { useState } from "react";
import { lessonPath as getLessonPath } from "../../config/course";
import type { CourseTree } from "../../scripts/server/course-api";
import { createLesson, createModule } from "../actions/courses";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Tooltip } from "../components/ui/tooltip";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { InlineCreate } from "./InlineCreate";
import { EmptyState } from "./library-ui";

type Entry = CourseTree[number];

export const courseStats = (entry: Entry) => {
  const lessons = entry.modules.flatMap((m) => m.lessons);
  return {
    modules: entry.modules.length,
    lessons: lessons.length,
    published: lessons.filter((l) => l.status === "PUBLISHED").length,
  };
};

const ModuleSection: React.FC<{
  readonly entry: Entry;
  readonly item: Entry["modules"][number];
  readonly index: number;
  readonly selectedLessonPath: string | null;
  readonly currentLessonPath: string | null;
  readonly onSelectLesson: (lessonPath: string) => void;
  readonly refresh: () => Promise<void>;
}> = ({
  entry,
  item,
  index,
  selectedLessonPath,
  currentLessonPath,
  onSelectLesson,
  refresh,
}) => {
  const t = useT("library");
  const { module, lessons } = item;
  const [adding, setAdding] = useState(false);
  const done = lessons.filter((l) => l.status === "PUBLISHED").length;
  const headingId = `module-${module.id}`;

  return (
    <section aria-labelledby={headingId} className="grid gap-1">
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-caption font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <h3 id={headingId} className="min-w-0 flex-1 truncate text-heading">
          {module.title}
        </h3>
        <span className="shrink-0 text-caption text-muted-foreground">
          {lessons.length > 0
            ? t("outline.modulePublished", { done, total: lessons.length })
            : t("outline.moduleCount", { count: 0 })}
        </span>
      </div>
      {lessons.length === 0 ? (
        <p className="px-9 py-1 text-caption text-muted-foreground">
          {t("empty.noLessons")}
        </p>
      ) : (
        <ol className="grid gap-0.5">
          {lessons.map((lesson, lessonIndex) => {
            const path = getLessonPath(lesson);
            const selected = path === selectedLessonPath;
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => onSelectLesson(path)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-body transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected &&
                      "bg-accent text-accent-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]",
                  )}
                >
                  <span className="timecode w-7 shrink-0 text-caption text-muted-foreground">
                    {index + 1}.{lessonIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                  {path === currentLessonPath ? (
                    <Tooltip content={t("outline.currentHint")} side="left">
                      <Video
                        className="h-3.5 w-3.5 shrink-0 text-primary"
                        aria-label={t("outline.current")}
                      />
                    </Tooltip>
                  ) : null}
                  <LessonStatusBadge status={lesson.status} size="sm" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="pl-9 pr-1">
        {adding ? (
          <InlineCreate
            autoFocus
            placeholder={t("outline.newLessonPlaceholder")}
            buttonLabel={t("outline.newLesson")}
            onCreate={async (title) => {
              const created = await createLesson(entry.course.id, module.id, title);
              await refresh();
              onSelectLesson(getLessonPath(created));
              setAdding(false);
            }}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("outline.newLesson")}
          </Button>
        )}
      </div>
    </section>
  );
};

export const CourseOutline: React.FC<{
  readonly entry: Entry;
  readonly selectedLessonPath: string | null;
  readonly currentLessonPath: string | null;
  readonly onSelectLesson: (lessonPath: string) => void;
  readonly onOpenSettings: () => void;
  readonly refresh: () => Promise<void>;
}> = ({
  entry,
  selectedLessonPath,
  currentLessonPath,
  onSelectLesson,
  onOpenSettings,
  refresh,
}) => {
  const t = useT("library");
  const tc = useT("common");
  const courseId = entry.course.id;
  const stats = courseStats(entry);

  const createModuleForm = (autoFocus: boolean) => (
    <InlineCreate
      autoFocus={autoFocus}
      placeholder={t("outline.newModulePlaceholder")}
      buttonLabel={t("outline.newModule")}
      onCreate={async (title) => {
        await createModule(courseId, title);
        await refresh();
      }}
    />
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-title">{entry.course.name}</h2>
            {entry.course.description ? (
              <p className="line-clamp-2 text-body text-muted-foreground">
                {entry.course.description}
              </p>
            ) : null}
          </div>
          <Tooltip content={t("outline.settings")} side="bottom" align="end">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("outline.settings")}
              onClick={onOpenSettings}
            >
              <Settings2 className="h-4 w-4" aria-hidden />
            </Button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <Badge size="sm" variant="outline">
            {tc(`language.${entry.course.language}`)}
          </Badge>
          <span>{tc("count.modules", { count: stats.modules })}</span>
          <span aria-hidden>·</span>
          <span>{tc("count.lessons", { count: stats.lessons })}</span>
        </div>
        {stats.lessons > 0 ? (
          <div className="flex items-center gap-2">
            <Progress
              value={stats.published / stats.lessons}
              tone="success"
              className="h-1.5"
              label={t("sidebar.published", {
                done: stats.published,
                total: stats.lessons,
              })}
            />
            <span className="shrink-0 text-caption text-muted-foreground">
              {t("sidebar.published", {
                done: stats.published,
                total: stats.lessons,
              })}
            </span>
          </div>
        ) : null}
      </div>

      {entry.modules.length === 0 ? (
        <EmptyState
          icon={<FolderPlus aria-hidden />}
          title={t("empty.noModules.title")}
          body={t("empty.noModules.body")}
          action={<div className="w-full max-w-sm">{createModuleForm(true)}</div>}
        />
      ) : (
        <>
          {entry.modules.map((item, index) => (
            <ModuleSection
              key={item.module.id}
              entry={entry}
              item={item}
              index={index}
              selectedLessonPath={selectedLessonPath}
              currentLessonPath={currentLessonPath}
              onSelectLesson={onSelectLesson}
              refresh={refresh}
            />
          ))}
          <div className="border-t pt-4">{createModuleForm(false)}</div>
        </>
      )}
    </div>
  );
};
