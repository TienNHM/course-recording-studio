import { Keyboard } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Kbd } from "../components/ui/misc";
import { Tooltip } from "../components/ui/tooltip";
import { useT } from "../i18n";
import { RECORDER_SHORTCUTS } from "./shortcuts";

/** "?" button in the header: a small popover listing the shortcuts. */
export const ShortcutsHelp: React.FC = () => {
  const t = useT("recording");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // "?" opens the list from anywhere (Shift + / on most layouts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey) {
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Tooltip content={`${t("shortcuts.open")} (?)`} side="bottom" align="end">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("shortcuts.open")}
          aria-expanded={open}
          aria-controls={panelId}
          aria-keyshortcuts="?"
          onClick={() => setOpen((o) => !o)}
        >
          <Keyboard className="h-4 w-4" aria-hidden />
        </Button>
      </Tooltip>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={t("shortcuts.title")}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <h2 className="text-overline uppercase text-muted-foreground">
            {t("shortcuts.title")}
          </h2>
          <dl className="mt-2 flex flex-col gap-1.5">
            {RECORDER_SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 text-body"
              >
                <dt className="min-w-0 truncate">
                  {t(`shortcuts.${s.description}`)}
                </dt>
                <dd>
                  <Kbd>{s.label}</Kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-caption text-muted-foreground">
            {t("shortcuts.note")}
          </p>
        </div>
      ) : null}
    </div>
  );
};
