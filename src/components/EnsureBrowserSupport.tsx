import { ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { canUseWebFsWriter } from "../helpers/browser-support";
import { useT } from "../i18n";
import { CenteredMessage, RecorderShell } from "../recording/RecorderShell";

type WebFsState = "loading" | "yes" | "no" | "security-error";

export const EnsureBrowserSupport: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const t = useT("recording");
  const [canUseWebFs, setCanUseWebFs] = useState<WebFsState>("loading");
  useEffect(() => {
    canUseWebFsWriter()
      .then((result) => {
        setCanUseWebFs(result ? "yes" : "no");
      })
      .catch((err) => {
        if ((err as Error).message.includes("Security")) {
          setCanUseWebFs("security-error");
        } else {
          setCanUseWebFs("no");
          console.log(err);
        }
      });
  }, []);

  if (canUseWebFs === "loading") {
    return null;
  }

  if (canUseWebFs === "no") {
    return (
      <RecorderShell>
        <CenteredMessage
          tone="destructive"
          icon={<TriangleAlert className="h-6 w-6" aria-hidden />}
          title={t("browser.unsupportedTitle")}
        >
          {t("browser.unsupportedBody")}
        </CenteredMessage>
      </RecorderShell>
    );
  }

  if (canUseWebFs === "security-error") {
    return (
      <RecorderShell>
        <CenteredMessage
          tone="destructive"
          icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
          title={t("browser.securityTitle")}
        >
          {t("browser.securityBody")}
        </CenteredMessage>
      </RecorderShell>
    );
  }

  return children;
};
