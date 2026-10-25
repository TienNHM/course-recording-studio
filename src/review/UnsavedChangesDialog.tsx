import React from "react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useT } from "../i18n";

/** In-app replacement for confirm(): leave with unsaved drafts? */
export const UnsavedChangesDialog: React.FC<{
  readonly open: boolean;
  /** Localized names of the tabs with unsaved drafts. */
  readonly panels: string[];
  readonly onStay: () => void;
  readonly onDiscard: () => void;
}> = ({ open, panels, onStay, onDiscard }) => {
  const t = useT("review");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStay()}>
      <DialogContent data-testid="unsaved-dialog">
        <DialogHeader>
          <DialogTitle>{t("unsaved.title")}</DialogTitle>
          <DialogDescription>
            {t("unsaved.description", { panels: panels.join(", ") })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onStay}>
            {t("unsaved.stay")}
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            {t("unsaved.discard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
