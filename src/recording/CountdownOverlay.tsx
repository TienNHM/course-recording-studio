import React from "react";
import { Button } from "../components/ui/button";
import { Kbd } from "../components/ui/misc";
import { useT } from "../i18n";
import { SHORTCUT_LABELS } from "./shortcuts";

/** Full-page 3-2-1 before the recorders start. Esc / R / Cancel aborts. */
export const CountdownOverlay: React.FC<{
  readonly secondsLeft: number;
  readonly onCancel: () => void;
}> = ({ secondsLeft, onCancel }) => {
  const t = useT("recording");
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="countdown-title"
      aria-describedby="countdown-hint"
    >
      <h2
        id="countdown-title"
        className="text-overline uppercase tracking-widest text-muted-foreground"
      >
        {t("countdown.title")}
      </h2>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-recording/15"
        />
        <span
          key={secondsLeft}
          className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-recording bg-background text-[5rem] font-bold leading-none text-recording shadow-lg timecode animate-in zoom-in-50 fade-in-0 duration-300"
          aria-hidden
        >
          {secondsLeft}
        </span>
      </div>
      <p id="countdown-hint" className="text-body text-muted-foreground">
        {t("countdown.hint", { seconds: secondsLeft })}
      </p>
      <Button variant="outline" onClick={onCancel} autoFocus>
        {t("countdown.cancel")}
        <Kbd>{SHORTCUT_LABELS.cancel}</Kbd>
      </Button>
    </div>
  );
};
