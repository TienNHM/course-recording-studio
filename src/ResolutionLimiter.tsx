import React, { useCallback, useMemo } from "react";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { MaxResolution } from "./helpers/get-max-resolution-of-device";
import {
  FPS_AVAILABLE,
  SizeConstraint,
  VIDEO_SIZES,
  VideoSize,
} from "./helpers/get-selected-video-source";
import { useFormat, useT } from "./i18n";
import { setPreferredResolutionForDevice } from "./preferred-resolution";

export const ResolutionLimiter: React.FC<{
  maxResolution: MaxResolution;
  sizeConstraint: SizeConstraint;
  setSizeConstraint: React.Dispatch<React.SetStateAction<SizeConstraint>>;
  deviceName: string;
  deviceId: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({
  deviceName,
  maxResolution,
  sizeConstraint,
  setSizeConstraint: setActiveVideoSize,
  deviceId,
  open,
  setOpen,
}) => {
  const t = useT("recording");
  const { formatNumber } = useFormat();
  const availableLowerResolutions = useMemo(() => {
    return Object.entries(VIDEO_SIZES).filter(([, value]) => {
      if (maxResolution === null) {
        return true;
      }
      return (
        (maxResolution.width === null || value.width <= maxResolution.width) &&
        (maxResolution.height === null || value.height <= maxResolution.height)
      );
    });
  }, [maxResolution]);

  const availableHigherFps = useMemo(() => {
    return FPS_AVAILABLE.filter((fps) => {
      if (maxResolution === null || maxResolution.frameRate === null) {
        return true;
      }
      return fps <= maxResolution.frameRate;
    }).reverse();
  }, [maxResolution]);

  const onResolutionChange = useCallback(
    (value: VideoSize | "full") => {
      if (value === "full") {
        setActiveVideoSize((v) => {
          const newSize = {
            ...v,
            maxSize: null,
          };
          setPreferredResolutionForDevice(deviceId, newSize);
          return newSize;
        });
        setPreferredResolutionForDevice(deviceId, null);
        return;
      }

      setActiveVideoSize((v) => {
        const newSize = {
          ...v,
          maxSize: value,
        };
        setPreferredResolutionForDevice(deviceId, newSize);
        return newSize;
      });
    },
    [deviceId, setActiveVideoSize],
  );

  const onFpsChange = useCallback(
    (value: string | "any") => {
      if (value === "any") {
        setActiveVideoSize((v) => {
          const newState: SizeConstraint = {
            ...v,
            minimumFps: null,
          };
          setPreferredResolutionForDevice(deviceId, newState);

          return newState;
        });
        return;
      }

      setActiveVideoSize((v) => {
        const newSize: SizeConstraint = {
          ...v,
          minimumFps: Number(value),
        };
        setPreferredResolutionForDevice(deviceId, newSize);

        return newSize;
      });
    },
    [deviceId, setActiveVideoSize],
  );

  const handleSubmit = useCallback(async () => {
    setOpen(false);
  }, [setOpen]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
    },
    [setOpen],
  );

  const fullResolutionLabel = useMemo(() => {
    if (maxResolution === null) {
      return t("resolution.full");
    }
    const { width, height } = maxResolution;
    if (width && !height) {
      return t("resolution.fullWithHeight", { height: width });
    }

    return t("resolution.full");
  }, [maxResolution, t]);

  const labelForFps = useCallback(
    (fps: number | null) => {
      return fps === null
        ? t("resolution.fpsDefault")
        : t("resolution.fpsAtLeast", { fps });
    },
    [t],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t("resolution.title")}</DialogTitle>
            <DialogDescription>
              {t("resolution.description", { device: deviceName })}
            </DialogDescription>
          </DialogHeader>
          <Select onValueChange={onResolutionChange}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  sizeConstraint.maxSize
                    ? t("resolution.limitTo", { size: sizeConstraint.maxSize })
                    : fullResolutionLabel
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={"full"} value={"full"}>
                <span className="whitespace-nowrap">{fullResolutionLabel}</span>
              </SelectItem>
              {availableLowerResolutions.map(([key]) => (
                <SelectItem key={key} value={key}>
                  <span className="whitespace-nowrap">
                    {t("resolution.limitTo", { size: key })}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogHeader className="pt-2">
            <DialogTitle>{t("resolution.fpsTitle")}</DialogTitle>
            {maxResolution.frameRate === null ? (
              <DialogDescription>
                {t("resolution.fpsUnknown", { device: deviceName })}
              </DialogDescription>
            ) : (
              <DialogDescription>
                {t("resolution.fpsKnown", {
                  device: deviceName,
                  fps: formatNumber(
                    Math.floor(maxResolution.frameRate * 100) / 100,
                  ),
                })}
              </DialogDescription>
            )}
          </DialogHeader>
          <Select onValueChange={onFpsChange}>
            <SelectTrigger>
              <SelectValue
                placeholder={labelForFps(sizeConstraint.minimumFps ?? null)}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={"any"} value={"any"}>
                <span className="whitespace-nowrap">
                  {t("resolution.fpsDefault")}
                </span>
              </SelectItem>
              {availableHigherFps.map((key) => (
                <SelectItem key={key} value={String(key)}>
                  <span className="whitespace-nowrap">{labelForFps(key)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="submit" onClick={handleSubmit}>
              {t("resolution.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
