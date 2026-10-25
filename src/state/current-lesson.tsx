import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Course, CourseModule, Lesson } from "../../config/course";
import { lessonPath as getLessonPath } from "../../config/course";
import type { CourseTree } from "../../scripts/server/course-api";
import { fetchCourseTree } from "../actions/courses";

const STORAGE_KEY = "courserecordingstudio.lessonPath";

const loadLessonPath = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

const persistLessonPath = (value: string | null) => {
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the selection is then per-session.
  }
};

export type LessonLocation = {
  course: Course;
  module: CourseModule;
  lesson: Lesson;
};

export const findLesson = (
  tree: CourseTree,
  path: string,
): LessonLocation | null => {
  for (const { course, modules } of tree) {
    for (const { module, lessons } of modules) {
      const found = lessons.find((l) => getLessonPath(l) === path);
      if (found) {
        return { course, module, lesson: found };
      }
    }
  }

  return null;
};

type CurrentLessonContextType = {
  tree: CourseTree | null;
  // Raw (English) error message of the last load, for logs; UIs should show
  // a localized message based on `serverOffline` / `error !== null`.
  error: string | null;
  // The local server is not running (static build / preview).
  serverOffline: boolean;
  // True until the first load finished (successfully or not).
  loading: boolean;
  lesson: Lesson | null;
  location: LessonLocation | null;
  lessonPath: string | null;
  setCurrentLesson: (lessonPath: string | null) => void;
  refresh: () => Promise<void>;
};

const CurrentLessonContext =
  React.createContext<CurrentLessonContextType | null>(null);

export const CurrentLessonProvider: React.FC<{
  readonly children: React.ReactNode;
}> = ({ children }) => {
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverOffline, setServerOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastTreeJson = useRef<string | null>(null);
  const [lessonPath, setLessonPath] = useState<string | null>(loadLessonPath);

  const refresh = useCallback(async () => {
    if (!window.remotionServerEnabled) {
      setError("The local server is not running.");
      setServerOffline(true);
      setLoading(false);
      return;
    }

    try {
      const next = await fetchCourseTree();
      // Keep the same object when nothing changed (the library polls), so
      // consumers do not re-render for nothing.
      const json = JSON.stringify(next);
      if (json !== lastTreeJson.current) {
        lastTreeJson.current = json;
        setTree(next);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentLesson = useCallback((value: string | null) => {
    setLessonPath(value);
    persistLessonPath(value);
  }, []);

  const value = useMemo((): CurrentLessonContextType => {
    const location = tree && lessonPath ? findLesson(tree, lessonPath) : null;
    return {
      tree,
      error,
      serverOffline,
      loading,
      location,
      lesson: location?.lesson ?? null,
      lessonPath: location ? lessonPath : null,
      setCurrentLesson,
      refresh,
    };
  }, [error, lessonPath, loading, refresh, serverOffline, setCurrentLesson, tree]);

  return (
    <CurrentLessonContext.Provider value={value}>
      {children}
    </CurrentLessonContext.Provider>
  );
};

export const useCurrentLesson = () => {
  const ctx = useContext(CurrentLessonContext);
  if (!ctx) {
    throw new Error(
      "useCurrentLesson() must be used within CurrentLessonProvider",
    );
  }

  return ctx;
};
