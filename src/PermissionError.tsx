import { MicOff } from "lucide-react";
import React from "react";
import { Button } from "./components/ui/button";
import { useT } from "./i18n";
import { CenteredMessage, RecorderShell } from "./recording/RecorderShell";

export const PermissionError: React.FC = () => {
  const t = useT("recording");
  return (
    <RecorderShell>
      <CenteredMessage
        tone="warning"
        icon={<MicOff className="h-6 w-6" aria-hidden />}
        title={t("permission.noDeviceTitle")}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("permission.reload")}
          </Button>
        }
      >
        {t("permission.noDeviceBody")}
      </CenteredMessage>
    </RecorderShell>
  );
};
