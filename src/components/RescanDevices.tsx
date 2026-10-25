import { RefreshCw } from "lucide-react";
import { useContext } from "react";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { DevicesContext } from "../WaitingForDevices";
import { Button } from "./ui/button";

/** Re-reads the device list (e.g. after plugging in a camera). */
export const RescanDevices: React.FC<{ readonly className?: string }> = ({
  className,
}) => {
  const ctx = useContext(DevicesContext);
  const t = useT("recording");
  const scanning = Boolean(ctx?.isRescanning);

  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn("text-muted-foreground", className)}
      onClick={() => ctx?.rescan()}
      disabled={scanning}
    >
      <RefreshCw
        className={cn("h-3.5 w-3.5", scanning && "animate-spin")}
        aria-hidden
      />
      {scanning ? t("sources.rescanning") : t("sources.rescan")}
    </Button>
  );
};
