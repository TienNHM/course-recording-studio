// "m:ss" / "h:mm:ss" timecodes for the Review UI (whole seconds, floored).
export const formatTimecode = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

// Duration like "4.2 s" or "1:05".
export const formatDuration = (ms: number): string => {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : formatTimecode(ms);
};

// Parses "ss", "m:ss", "h:mm:ss" (seconds may have decimals). Null if invalid.
export const parseTimecode = (value: string): number | null => {
  const parts = value.trim().split(":");
  if (parts.length === 0 || parts.length > 3) {
    return null;
  }
  let seconds = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) {
      return null;
    }
    seconds = seconds * 60 + Number(part);
  }
  return Math.round(seconds * 1000);
};
