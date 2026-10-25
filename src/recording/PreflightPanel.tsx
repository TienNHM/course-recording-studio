import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import React from "react";
import { Button } from "../components/ui/button";
import { Kbd } from "../components/ui/misc";
import { cn } from "../helpers/utils";
import { useFormat, useT } from "../i18n";
import type { LessonLocation } from "../state/current-lesson";
import { PreflightCheck, PreflightState, preflightSummary } from "./preflight";
import { SHORTCUT_LABELS } from "./shortcuts";

const STATE_ICONS: Record<PreflightState, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  warning: <CircleAlert className="h-4 w-4 text-warning" aria-hidden />,
  error: <XCircle className="h-4 w-4 text-destructive" aria-hidden />,
  pending: (
    <Loader2
      className="h-4 w-4 animate-spin text-muted-foreground"
      aria-hidden
    />
  ),
  skipped: (
    <MinusCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
  ),
};

/**
 * Pre-flight checklist + the one big Record button. Everything that can be
 * set up automatically already is (default microphone, remembered devices);
 * the list only asks for what's left.
 */
export const PreflightPanel: React.FC<{
  readonly checks: readonly PreflightCheck[];
  readonly canStart: boolean;
  readonly location: LessonLocation | null;
  readonly freeDiskBytes: number | null;
  readonly micSourceLabel: string;
  readonly autoProcess: boolean;
  readonly onStart: () => void;
  readonly onPickScreen: () => void;
  readonly onChooseLesson: () => void;
  readonly busy: boolean;
}> = ({
  checks,
  canStart,
  location,
  freeDiskBytes,
  micSourceLabel,
  autoProcess,
  onStart,
  onPickScreen,
  onChooseLesson,
  busy,
}) => {
  const t = useT("recording");
  const f = useFormat();
  const summary = preflightSummary(checks, canStart);

  const detail = (check: PreflightCheck): React.ReactNode => {
    switch (check.id) {
      case "lesson":
        if (check.reason === "ok" && location) {
          return (
            <>
              <span className="block truncate font-medium text-foreground">
                {location.lesson.title}
              </span>
              <span className="block truncate">
                {location.course.name} › {location.module.title}
              </span>
            </>
          );
        }

        return check.reason === "noServer"
          ? t("preflight.lesson.noServer")
          : t("preflight.lesson.missing");
      case "mic":
        return check.reason === "missing"
          ? t("preflight.mic.missing", { source: micSourceLabel })
          : check.reason === "listening"
            ? t("preflight.mic.listening")
            : check.reason === "silent"
              ? t("preflight.mic.silent")
              : check.reason === "notRequired"
                ? t("preflight.mic.notRequired")
                : t("preflight.mic.ok");
      case "screen":
        return check.reason === "ok"
          ? t("preflight.screen.ok")
          : check.reason === "loading"
            ? t("preflight.screen.loading")
            : check.reason === "otherVideo"
              ? t("preflight.screen.otherVideo")
              : t("preflight.screen.missing");
      case "webcam":
        return check.reason === "ok"
          ? t("preflight.webcam.ok")
          : check.reason === "loading"
            ? t("preflight.webcam.loading")
            : check.reason === "extra"
              ? t("preflight.webcam.extra")
              : check.reason === "missing"
                ? t("preflight.webcam.missing")
                : t("preflight.webcam.notRequired");
      case "disk": {
        const free = freeDiskBytes === null ? "" : f.formatBytes(freeDiskBytes);
        return check.reason === "ok"
          ? t("preflight.disk.ok", { free })
          : check.reason === "low"
            ? t("preflight.disk.low", { free })
            : check.reason === "loading"
              ? t("preflight.disk.loading")
              : t("preflight.disk.unknown");
      }
      default:
        return null;
    }
  };

  const action = (check: PreflightCheck): React.ReactNode => {
    if (check.id === "lesson" && check.reason === "missing") {
      return (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          onClick={onChooseLesson}
        >
          {t("preflight.lesson.choose")}
        </Button>
      );
    }

    if (
      check.id === "screen" &&
      check.reason !== "ok" &&
      check.reason !== "loading"
    ) {
      return (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          onClick={onPickScreen}
        >
          {t("preflight.screen.action")}
        </Button>
      );
    }

    return null;
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="preflight-title">
      <h2
        id="preflight-title"
        className="text-overline uppercase text-muted-foreground"
      >
        {t("preflight.title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0">
              {STATE_ICONS[check.state]}
              <span className="sr-only">
                {t(`preflight.state.${check.state}`)}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-label">
                {t(`preflight.${check.id}.label`)}
              </div>
              <div
                className={cn(
                  "text-caption",
                  check.state === "error"
                    ? "text-destructive"
                    : check.state === "warning"
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {detail(check)}
              </div>
              {action(check)}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          variant="recording"
          size="lg"
          className="h-14 w-full gap-3 rounded-lg px-4 text-heading shadow-sm"
          onClick={onStart}
          disabled={!canStart || busy}
          aria-keyshortcuts="R"
          aria-describedby="preflight-summary"
        >
          <Circle className="h-5 w-5 fill-current" aria-hidden />
          {t("preflight.start")}
          <Kbd className="ml-1 border-recording-foreground/30 bg-recording-foreground/15 text-recording-foreground">
            {SHORTCUT_LABELS.record}
          </Kbd>
        </Button>
        <p
          id="preflight-summary"
          className={cn(
            "text-center text-caption",
            summary === "ready"
              ? "text-success"
              : summary === "warnings"
                ? "text-warning"
                : "text-muted-foreground",
          )}
        >
          {t(`preflight.${summary}`)}
        </p>
        <p className="text-center text-caption text-muted-foreground">
          {autoProcess
            ? t("preflight.autoProcessOn")
            : t("preflight.autoProcessOff")}
        </p>
      </div>
    </section>
  );
};
