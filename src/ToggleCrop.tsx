import { Crop } from "lucide-react";
import React from "react";
import { Toggle } from "./components/ui/toggle";
import { Tooltip } from "./components/ui/tooltip";
import { useT } from "./i18n";

export const ToggleCrop: React.FC<{
  onPressedChange: (pressed: boolean) => void;
  pressed: boolean;
}> = ({ onPressedChange, pressed }) => {
  const t = useT("recording");
  return (
    <Tooltip content={t("sources.crop")} side="bottom">
      <Toggle
        size="sm"
        className="h-8 w-8 px-0"
        aria-label={t("sources.crop")}
        pressed={pressed}
        onPressedChange={onPressedChange}
      >
        <Crop className="h-4 w-4" aria-hidden />
      </Toggle>
    </Tooltip>
  );
};
