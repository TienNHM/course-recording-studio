import { AlertTriangle, Check, Loader2 } from "lucide-react";
import React from "react";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import type { LessonFlow, StepState } from "./lesson-flow";

const CIRCLE: Record<StepState, string> = {
  done: "bg-success text-success-foreground border-transparent",
  current: "border-primary bg-primary text-primary-foreground",
  active: "border-info bg-info/10 text-info",
  failed: "border-destructive bg-destructive/10 text-destructive",
  upcoming: "border-border bg-background text-muted-foreground",
};

const LINE: Record<StepState, string> = {
  done: "bg-success",
  current: "bg-border",
  active: "bg-border",
  failed: "bg-border",
  upcoming: "bg-border",
};

/** Record → Process → Review → Publish, with the lesson's position. */
export const LessonStepper: React.FC<{
  readonly steps: LessonFlow["steps"];
}> = ({ steps }) => {
  const t = useT("library");
  return (
    <ol aria-label={t("steps.label")} className="flex items-start">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.id}
            className={cn("relative flex min-w-0 flex-1 flex-col items-center")}
            aria-current={
              step.state === "current" || step.state === "active"
                ? "step"
                : undefined
            }
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-1/2 top-4 h-0.5 w-full",
                  LINE[step.state],
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-caption font-semibold",
                CIRCLE[step.state],
              )}
            >
              {step.state === "done" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : step.state === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : step.state === "failed" ? (
                <AlertTriangle className="h-4 w-4" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "mt-1.5 max-w-full truncate px-1 text-center text-caption",
                step.state === "current" || step.state === "active"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t(`steps.${step.id}`)}
            </span>
            <span className="sr-only">{t(`steps.state.${step.state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
};
