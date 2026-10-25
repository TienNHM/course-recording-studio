import { formatDeviceLabel, Label } from "../helpers/format-device-label";

const readCustomLabels = (): Label[] => {
  try {
    return JSON.parse(localStorage.getItem("labels") ?? "[]") as Label[];
  } catch {
    return [];
  }
};

/**
 * Human name of a device: user-defined label, then the cleaned-up browser
 * label, then `fallback` (browsers hide labels until permission is granted).
 */
export const getDeviceLabel = (
  device: Pick<MediaDeviceInfo, "deviceId" | "label">,
  fallback: string,
): string => {
  const custom = readCustomLabels().find((l) => l.id === device.deviceId);
  if (custom) {
    return custom.label;
  }

  const formatted = device.label ? formatDeviceLabel(device.label) : "";
  return formatted.trim() ? formatted : fallback;
};

/**
 * Microphone to use when a slot that records audio has none selected yet:
 * the slot's own preference, the other slot's preference, the system
 * default, then the first microphone.
 */
export const pickDefaultMicrophone = (
  devices: readonly Pick<MediaDeviceInfo, "deviceId" | "kind">[],
  preferred: readonly (string | null)[],
): string | null => {
  const mics = devices.filter((d) => d.kind === "audioinput" && d.deviceId);
  for (const id of preferred) {
    if (id && mics.some((m) => m.deviceId === id)) {
      return id;
    }
  }

  return (
    mics.find((m) => m.deviceId === "default")?.deviceId ??
    mics[0]?.deviceId ??
    null
  );
};
