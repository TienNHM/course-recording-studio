import { useCallback, useEffect, useRef, useState } from "react";
import { applyThemeToDocument } from "../theme/preferences";

// Document Picture-in-Picture (Chrome/Edge 116+): an always-on-top window
// that stays visible while the user works in another app.
type DocumentPictureInPicture = {
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }) => Promise<Window>;
  readonly window: Window | null;
};

const getApi = (): DocumentPictureInPicture | null => {
  const api = (
    window as { documentPictureInPicture?: DocumentPictureInPicture }
  ).documentPictureInPicture;
  return api ?? null;
};

export const isDocumentPipSupported = () => getApi() !== null;

// Copies the stylesheets of the main page so Tailwind classes work in the PiP
// window too.
const copyStyles = (target: Window) => {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = target.document.createElement("style");
      style.textContent = css;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin stylesheet: link it instead
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }

  // Mode class, data-palette and lang (live updates: useThemeMirror)
  applyThemeToDocument(target.document);
  target.document.title = "Recording controls";
  target.document.body.className = "bg-background text-foreground";
  target.document.body.style.margin = "0";
  target.document.body.style.height = "auto";
};

export const useDocumentPip = () => {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pendingRef = useRef<Promise<Window | null> | null>(null);

  // Must be called synchronously from a user gesture (click / key press).
  const open = useCallback((): Promise<Window | null> => {
    const api = getApi();
    if (!api) {
      return Promise.resolve(null);
    }

    if (api.window) {
      setPipWindow(api.window);
      return Promise.resolve(api.window);
    }

    if (pendingRef.current) {
      return pendingRef.current;
    }

    const promise = api
      .requestWindow({ width: 360, height: 250 })
      .then((win) => {
        copyStyles(win);
        win.addEventListener(
          "pagehide",
          () => {
            setPipWindow((current) => (current === win ? null : current));
          },
          { once: true },
        );
        setPipWindow(win);
        return win;
      })
      .catch((err) => {
        console.warn("Could not open the floating control panel", err);
        return null;
      })
      .finally(() => {
        pendingRef.current = null;
      });
    pendingRef.current = promise;
    return promise;
  }, []);

  const close = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) {
      pending.then((win) => win?.close());
    }

    getApi()?.window?.close();
    setPipWindow(null);
  }, []);

  // Close the panel when the recorder page goes away
  useEffect(() => {
    return () => {
      getApi()?.window?.close();
    };
  }, []);

  return { pipWindow, open, close, supported: isDocumentPipSupported() };
};
