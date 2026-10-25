import { useCallback, useEffect, useState } from "react";

export type View = "library" | "record" | "review" | "styleguide";

const VIEWS: View[] = ["library", "record", "review", "styleguide"];

// Fired after pushState so every useView() instance (App, AppHeader,
// Settings dialog...) sees the change, not only the caller.
const VIEW_CHANGE_EVENT = "crs:viewchange";

const readView = (): View => {
  const view = new URLSearchParams(window.location.search).get("view");
  return VIEWS.find((v) => v === view) ?? "library";
};

export const useView = () => {
  const [view, setViewState] = useState<View>(readView);

  useEffect(() => {
    const onChange = () => setViewState(readView());
    window.addEventListener("popstate", onChange);
    window.addEventListener(VIEW_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(VIEW_CHANGE_EVENT, onChange);
    };
  }, []);

  const setView = useCallback((next: View) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.pushState({}, "", url);
    setViewState(next);
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
  }, []);

  return [view, setView] as const;
};
