import { useMemo } from "react";
import { useFormat, useT } from "../i18n";

/** useFormat() plus short durations: "4,2 giây" below a minute, else "01:05". */
export const useReviewFormat = () => {
  const f = useFormat();
  const t = useT("review");
  return useMemo(
    () => ({
      ...f,
      formatShortDuration: (ms: number) =>
        ms < 60_000
          ? t("units.seconds", {
              value: f.formatNumber(ms / 1000, { maximumFractionDigits: 1 }),
            })
          : f.formatDuration(ms),
    }),
    [f, t],
  );
};
