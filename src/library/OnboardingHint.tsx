import { ClipboardCheck, Clapperboard, Sparkles, Upload, X } from "lucide-react";
import React from "react";
import { Button } from "../components/ui/button";
import { useT } from "../i18n";

const STORAGE_KEY = "crs:library:onboardingDismissed";

export const readOnboardingDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeOnboardingDismissed = (dismissed: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(dismissed));
  } catch {
    // Storage unavailable: the hint simply shows again next time.
  }
};

const STEPS = [
  { id: "record", icon: Clapperboard },
  { id: "process", icon: Sparkles },
  { id: "review", icon: ClipboardCheck },
  { id: "publish", icon: Upload },
] as const;

/** First-run explanation of Record → Process → Review → Publish. */
export const OnboardingHint: React.FC<{
  readonly onDismiss: () => void;
}> = ({ onDismiss }) => {
  const t = useT("library");
  const tc = useT("common");
  return (
    <section
      aria-labelledby="onboarding-title"
      className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient"
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-title" className="text-heading">
            {t("onboarding.title")}
          </h2>
          <p className="text-body text-muted-foreground">{t("onboarding.intro")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={tc("actions.close")}
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(({ id, icon: Icon }, i) => (
          <li key={id} className="flex gap-3 rounded-lg bg-muted/50 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-label">
                {i + 1}. {t(`onboarding.steps.${id}.title`)}
              </div>
              <p className="text-caption text-muted-foreground">
                {t(`onboarding.steps.${id}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
          {t("onboarding.dismiss")}
        </Button>
      </div>
    </section>
  );
};
