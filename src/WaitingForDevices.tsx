import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "./components/ui/button";
import { getDevices } from "./helpers/get-devices";
import { useT } from "./i18n";
import { CenteredMessage, RecorderShell } from "./recording/RecorderShell";

export type DevicesContext = {
  devices: MediaDeviceInfo[] | null;
  rescan: () => Promise<void>;
  isRescanning: boolean;
};

export const DevicesContext = createContext<DevicesContext | null>(null);

export const WaitingForDevices: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT("recording");

  const checkDeviceLabels = useCallback(async () => {
    try {
      const fetchedDevices = await getDevices();
      setDevices(fetchedDevices);
      setError(null);
    } catch (err) {
      console.log(err);
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    checkDeviceLabels();
  }, [checkDeviceLabels]);

  const value: DevicesContext = useMemo(
    () => ({
      devices,
      rescan: async () => {
        try {
          setIsRescanning(true);
          // Show scanning label for at least 250ms
          // to indicate that rescanning was successful
          await Promise.all([
            checkDeviceLabels(),
            new Promise((resolve) => setTimeout(resolve, 250)),
          ]);
        } finally {
          setIsRescanning(false);
        }
      },
      isRescanning,
    }),
    [devices, checkDeviceLabels, isRescanning],
  );

  if (devices === null) {
    return (
      <RecorderShell>
        {error ? (
          <CenteredMessage
            tone="destructive"
            icon={<TriangleAlert className="h-6 w-6" aria-hidden />}
            title={t("devices.failedTitle")}
            action={
              <Button variant="outline" onClick={checkDeviceLabels}>
                {t("sources.rescan")}
              </Button>
            }
          >
            {t("errors.devices", { message: error })}
          </CenteredMessage>
        ) : (
          <CenteredMessage
            icon={<Loader2 className="h-6 w-6 animate-spin" aria-hidden />}
            title={t("devices.loading")}
          />
        )}
      </RecorderShell>
    );
  }

  return (
    <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>
  );
};

export const useDevices = (): MediaDeviceInfo[] => {
  const context = useContext(DevicesContext);
  if (!context?.devices) {
    throw new Error("useDevices must be used within a DevicesContextProvider");
  }

  return context.devices;
};
