import React, { useCallback, useState } from "react";
import type { Lesson } from "../../config/course";
import { lessonPath as getLessonPath } from "../../config/course";
import { Button } from "../components/ui/button";
import { JobProgress } from "../review/JobProgress";
import { PublishedFiles } from "../review/PublishedFiles";
import { useLessonJob } from "../review/use-job";
import { Checkbox } from "./form-fields";

const PROCESSED = ["REVIEW", "PUBLISHED"];

// Record → Process → Review → Export, depending on the lesson status.
export const LessonActions: React.FC<{
  readonly lesson: Lesson;
  readonly onRecord: (lessonPath: string) => void;
  readonly onReview: (lessonPath: string) => void;
  readonly onChanged: () => Promise<void>;
}> = ({ lesson, onRecord, onReview, onChanged }) => {
  const path = getLessonPath(lesson);
  const [retranscribe, setRetranscribe] = useState(false);
  const onSettled = useCallback(() => {
    onChanged();
  }, [onChanged]);
  const { job, active, busy, error, process, exportLesson, cancel } =
    useLessonJob(path, onSettled);

  const processed = PROCESSED.includes(lesson.status);
  const canProcess = lesson.selectedTake !== null && !active;

  const startProcessing = useCallback(async () => {
    await process(retranscribe);
    await onChanged();
  }, [onChanged, process, retranscribe]);

  return (
    <div className="grid gap-3" data-testid="lesson-actions">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => onRecord(path)}>
          Record
        </Button>
        {lesson.selectedTake !== null ? (
          <>
            <Button
              type="button"
              variant={processed ? "outline" : "default"}
              disabled={!canProcess || busy}
              onClick={startProcessing}
            >
              {processed ? "Re-process" : "Process"}
            </Button>
            <Checkbox
              label="Re-transcribe"
              checked={retranscribe}
              onChange={setRetranscribe}
            />
          </>
        ) : null}
        {processed ? (
          <>
            <div className="flex-1" />
            <Button
              type="button"
              disabled={active}
              onClick={() => onReview(path)}
            >
              Review
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={active || busy}
              onClick={exportLesson}
            >
              Export
            </Button>
          </>
        ) : null}
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      <JobProgress job={job} onCancel={cancel} busy={busy} />
      {lesson.status === "PUBLISHED" && !active ? (
        <PublishedFiles
          lessonPath={path}
          version={job?.kind === "render" ? job.finishedAt : null}
        />
      ) : null}
    </div>
  );
};
