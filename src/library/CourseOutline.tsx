import React from "react";
import { lessonPath as getLessonPath } from "../../config/course";
import type { CourseTree } from "../../scripts/server/course-api";
import { createLesson, createModule } from "../actions/courses";
import { cn } from "../helpers/utils";
import { InlineCreate } from "./InlineCreate";
import { StatusBadge } from "./StatusBadge";

export const CourseOutline: React.FC<{
  readonly entry: CourseTree[number];
  readonly selectedLessonPath: string | null;
  readonly currentLessonPath: string | null;
  readonly onSelectLesson: (lessonPath: string) => void;
  readonly refresh: () => Promise<void>;
}> = ({
  entry,
  selectedLessonPath,
  currentLessonPath,
  onSelectLesson,
  refresh,
}) => {
  const courseId = entry.course.id;

  return (
    <div className="grid gap-5">
      {entry.modules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No modules yet. Create the first one below.
        </p>
      ) : null}
      {entry.modules.map(({ module, lessons }, moduleIndex) => (
        <section key={module.id} className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {moduleIndex + 1}. {module.title}
          </h3>
          <ul className="grid gap-1">
            {lessons.map((lesson, lessonIndex) => {
              const path = getLessonPath(lesson);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLesson(path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      path === selectedLessonPath && "bg-accent",
                    )}
                  >
                    <span className="w-8 text-muted-foreground">
                      {moduleIndex + 1}.{lessonIndex + 1}
                    </span>
                    <span className="flex-1 truncate">{lesson.title}</span>
                    {path === currentLessonPath ? (
                      <span className="text-[10px] text-sky-400">CURRENT</span>
                    ) : null}
                    <StatusBadge status={lesson.status} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="pl-10">
            <InlineCreate
              placeholder="New lesson title"
              onCreate={async (title) => {
                const created = await createLesson(courseId, module.id, title);
                await refresh();
                onSelectLesson(getLessonPath(created));
              }}
            />
          </div>
        </section>
      ))}
      <InlineCreate
        placeholder="New module title"
        onCreate={async (title) => {
          await createModule(courseId, title);
          await refresh();
        }}
      />
    </div>
  );
};
