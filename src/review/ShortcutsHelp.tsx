import { Keyboard } from "lucide-react";
import React from "react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Kbd } from "../components/ui/misc";
import { useT } from "../i18n";

const ROWS = [
  { keys: ["Space"], label: "playPause" },
  { keys: ["J"], label: "back" },
  { keys: ["K"], label: "playPause" },
  { keys: ["L"], label: "forward" },
  { keys: ["←", "→"], label: "prevNext" },
  { keys: ["A"], label: "toggleCut" },
  { keys: ["?"], label: "help" },
] as const;

/** Keyboard shortcut cheat sheet (popover from the header). */
export const ShortcutsHelp: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const t = useT("review");
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("shortcuts.button")}
          title={t("shortcuts.button")}
        >
          <Keyboard className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel className="px-1">{t("shortcuts.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <dl className="grid gap-1.5 px-1 py-1" data-testid="shortcuts-help">
          {ROWS.map((row) => (
            <div key={row.keys.join("+")} className="flex items-center gap-3">
              <dt className="flex w-16 shrink-0 gap-1">
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dt>
              <dd className="text-caption">{t(`shortcuts.${row.label}`)}</dd>
            </div>
          ))}
        </dl>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
