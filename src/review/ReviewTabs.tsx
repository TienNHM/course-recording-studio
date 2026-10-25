import React, { useRef } from "react";
import { cn } from "../helpers/utils";

export type ReviewTab = {
  readonly id: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Small counter next to the label. */
  readonly count?: number | null;
  readonly countTone?: "neutral" | "warning";
  /** Unsaved drafts in this tab. */
  readonly dirty?: boolean;
};

/** Tab strip for the side panels (arrow keys move between tabs). */
export const ReviewTabs: React.FC<{
  readonly tabs: readonly ReviewTab[];
  readonly value: string;
  readonly onValueChange: (id: string) => void;
  readonly label: string;
  readonly unsavedLabel: string;
}> = ({ tabs, value, onValueChange, label, unsavedLabel }) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-0.5 overflow-x-auto overflow-y-hidden border-b px-1.5 pt-1.5 [scrollbar-width:none]"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={`review-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`review-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(tab.id)}
            onKeyDown={(e) => {
              const delta =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!delta) {
                return;
              }
              e.preventDefault();
              const next = (index + delta + tabs.length) % tabs.length;
              const nextTab = tabs[next];
              if (nextTab) {
                onValueChange(nextTab.id);
                refs.current[next]?.focus();
              }
            }}
            className={cn(
              "relative -mb-px inline-flex min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-1.5 py-2 text-label text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              selected && "border-primary text-foreground",
            )}
          >
            <span className="hidden shrink-0 sm:inline-flex lg:max-xl:hidden">
              {tab.icon}
            </span>
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && tab.count !== null ? (
              <span
                className={cn(
                  "timecode shrink-0 rounded-full px-1.5 text-2xs",
                  tab.countTone === "warning"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {tab.dirty ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                title={unsavedLabel}
                aria-label={unsavedLabel}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
