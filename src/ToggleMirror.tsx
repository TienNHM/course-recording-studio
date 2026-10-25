import { FlipHorizontal2 } from "lucide-react";
import React from "react";
import { Toggle } from "./components/ui/toggle";
import { Tooltip } from "./components/ui/tooltip";
import { useT } from "./i18n";

export const ToggleMirror: React.FC<{
  onPressedChange: (pressed: boolean) => void;
  pressed: boolean;
  disabled: boolean;
}> = ({ onPressedChange, pressed, disabled }) => {
  const t = useT("recording");
  return (
    <Tooltip content={t("sources.mirror")} side="bottom">
      <Toggle
        size="sm"
        className="h-8 w-8 px-0"
        aria-label={t("sources.mirror")}
        disabled={disabled}
        onPressedChange={onPressedChange}
        pressed={pressed}
      >
        <FlipHorizontal2 className="h-4 w-4" aria-hidden />
      </Toggle>
    </Tooltip>
  );
};
