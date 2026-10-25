import { useCallback, useEffect, useState } from "react";

export type View = "library" | "record" | "review";

const VIEWS: View[] = ["library", "record", "review"];

const readView = (): View => {
  const view = new URLSearchParams(window.location.search).get("view");
  return VIEWS.find((v) => v === view) ?? "library";
};

export const useView = () => {
  const [view, setViewState] = useState<View>(readView);

  useEffect(() => {
    const onPopState = () => setViewState(readView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setView = useCallback((next: View) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.pushState({}, "", url);
    setViewState(next);
  }, []);

  return [view, setView] as const;
};
