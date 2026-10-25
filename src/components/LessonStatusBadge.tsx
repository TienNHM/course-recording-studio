import React from "react";
import type { LessonStatus } from "../../config/course";
import { useT } from "../i18n";
import { Badge, type BadgeProps, type BadgeTone } from "./ui/badge";

/**
 * The one mapping from lesson status to color. Red is never used here: red
 * means "recording now" or "destructive".
 */
export const LESSON_STATUS_STYLE: Record<
  LessonStatus,
  { tone: BadgeTone; variant: "soft" | "solid" | "outline"; pulse?: boolean }
> = {
  DRAFT: { tone: "neutral", variant: "soft" },
  READY_TO_RECORD: { tone: "primary", variant: "outline" },
  RECORDED: { tone: "primary", variant: "soft" },
  PROCESSING: { tone: "info", variant: "soft", pulse: true },
  REVIEW: { tone: "warning", variant: "soft" },
  PUBLISHED: { tone: "success", variant: "soft" },
  ARCHIVED: { tone: "neutral", variant: "outline" },
};

/** Localized, color-coded lesson status: <LessonStatusBadge status="REVIEW" /> */
export const LessonStatusBadge: React.FC<
  Omit<BadgeProps, "tone" | "variant" | "children"> & {
    readonly status: LessonStatus;
  }
> = ({ status, ...props }) => {
  const t = useT("common");
  const style = LESSON_STATUS_STYLE[status];
  return (
    <Badge
      tone={style.tone}
      variant={style.variant}
      pulse={style.pulse}
      dot
      {...props}
    >
      {t(`lessonStatus.${status}`)}
    </Badge>
  );
};
