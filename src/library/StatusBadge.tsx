import React from "react";
import type { LessonStatus } from "../../config/course";
import { cn } from "../helpers/utils";

const STATUS_STYLES: Record<LessonStatus, string> = {
  DRAFT: "bg-slate-700 text-slate-200",
  READY_TO_RECORD: "bg-sky-900 text-sky-200",
  RECORDED: "bg-amber-900 text-amber-200",
  PROCESSING: "bg-violet-900 text-violet-200",
  REVIEW: "bg-orange-900 text-orange-200",
  PUBLISHED: "bg-emerald-900 text-emerald-200",
  ARCHIVED: "bg-zinc-800 text-zinc-400",
};

export const StatusBadge: React.FC<{ readonly status: LessonStatus }> = ({
  status,
}) => {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
};
