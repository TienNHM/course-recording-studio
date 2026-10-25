import { ArrowLeft } from "lucide-react";
import React from "react";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { useCurrentLesson } from "../state/current-lesson";
import { useView } from "../state/view";

/** "Course › Module" + lesson title, for the header subtitle. */
export const LessonBreadcrumb: React.FC = () => {
  const t = useT("recording");
  const { location } = useCurrentLesson();
  if (!location) {
    return <span>{t("header.noLesson")}</span>;
  }

  return (
    <span
      title={`${location.course.name} › ${location.module.title} › ${location.lesson.title}`}
    >
      <span className="hidden lg:inline">
        {location.course.name} › {location.module.title} ›{" "}
      </span>
      <span className="font-medium text-foreground">
        {location.lesson.title}
      </span>
    </span>
  );
};

/** Recorder header: back to the library, view title, lesson, actions. */
export const RecorderHeader: React.FC<{
  readonly backDisabled?: boolean;
  readonly actions?: React.ReactNode;
}> = ({ backDisabled, actions }) => {
  const t = useT("recording");
  const [, setView] = useView();
  return (
    <AppHeader
      compactBrand
      leading={
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 px-2"
          onClick={() => setView("library")}
          disabled={backDisabled}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("header.back")}</span>
          <span className="sr-only sm:hidden">{t("header.back")}</span>
        </Button>
      }
      title={t("title")}
      subtitle={<LessonBreadcrumb />}
      actions={actions}
    />
  );
};

/** Full-height page with the recorder header (permission / support screens). */
export const RecorderShell: React.FC<{
  readonly children: React.ReactNode;
}> = ({ children }) => (
  <div className="flex h-full flex-col bg-background text-foreground">
    <RecorderHeader />
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 md:p-6">
      {children}
    </main>
  </div>
);

/** Centered card with an icon, title and text (errors, waiting states). */
export const CenteredMessage: React.FC<{
  readonly icon: React.ReactNode;
  readonly title: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly tone?: "neutral" | "warning" | "destructive";
  readonly action?: React.ReactNode;
  readonly className?: string;
}> = ({ icon, title, children, tone = "neutral", action, className }) => (
  <div
    role={tone === "neutral" ? "status" : "alert"}
    className={cn(
      "flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center text-card-foreground shadow-sm",
      className,
    )}
  >
    <span
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        tone === "neutral" && "bg-primary/10 text-primary",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "destructive" && "bg-destructive/10 text-destructive",
      )}
    >
      {icon}
    </span>
    <h2 className="text-title">{title}</h2>
    {children ? (
      <div className="text-balance text-body text-muted-foreground">
        {children}
      </div>
    ) : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);
