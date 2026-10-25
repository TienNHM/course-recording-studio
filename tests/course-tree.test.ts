import { afterAll, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import type { Lesson } from "../config/course";
import { lesson } from "../config/course";
import { lessonPathParam, takeIdParam } from "../scripts/server/course-api";
import { resolvePublicPath } from "../scripts/server/course-store";
import {
  applyLessonPatch,
  buildCourseTree,
  nextOrder,
} from "../scripts/server/course-tree";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "course-tree-"));

const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const makeLesson = (id: string, order: number): Lesson =>
  lesson.parse({ id, courseId: "c", moduleId: "m1", title: id, order });

test("buildCourseTree sorts by order and skips invalid entries", () => {
  write("c/course.json", { id: "c", name: "C", createdAt: "2026-01-01" });
  write("c/m2/module.json", { id: "m2", courseId: "c", title: "B", order: 1 });
  write("c/m1/module.json", { id: "m1", courseId: "c", title: "A", order: 0 });
  write("c/m1/l2/lesson.json", makeLesson("l2", 5));
  write("c/m1/l1/lesson.json", makeLesson("l1", 2));
  write("c/m1/broken/lesson.json", { id: "Not A Slug" });
  write("c/m1/no-json/recordings/1/display.webm", "");
  write("orphan/readme.json", {});

  const tree = buildCourseTree(root);
  expect(tree).toHaveLength(1);
  expect(tree[0]?.course.language).toBe("vi");
  expect(tree[0]?.modules.map((m) => m.module.id)).toEqual(["m1", "m2"]);
  expect(tree[0]?.modules[0]?.lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
  expect(tree[0]?.modules[1]?.lessons).toEqual([]);
});

test("buildCourseTree returns empty for a missing directory", () => {
  expect(buildCourseTree(path.join(root, "missing"))).toEqual([]);
});

test("nextOrder", () => {
  expect(nextOrder([])).toBe(0);
  expect(nextOrder([{ order: 3 }, { order: 1 }])).toBe(4);
});

test("applyLessonPatch merges nested objects", () => {
  const base = makeLesson("l1", 0);
  const next = applyLessonPatch(base, {
    title: "New",
    recordingProfile: { webcam: true },
    postProduction: { silencePreset: "aggressive" },
  });
  expect(next.title).toBe("New");
  expect(next.recordingProfile).toEqual({ webcam: true, microphone: true });
  expect(next.postProduction.silencePreset).toBe("aggressive");
  expect(next.postProduction.autoTranscribe).toBe(true);
  expect(next.id).toBe("l1");
});

test("resolvePublicPath refuses paths outside public/courses", () => {
  expect(() => resolvePublicPath("courses/a/b/c")).not.toThrow();
  expect(() => resolvePublicPath("courses/../secret")).toThrow();
  expect(() => resolvePublicPath("../package.json")).toThrow();
  expect(() => resolvePublicPath("courses-evil/x")).toThrow();
});

test("lesson path and take id params", () => {
  expect(lessonPathParam.safeParse("courses/a/b/c").success).toBe(true);
  expect(lessonPathParam.safeParse("courses/../b/c").success).toBe(false);
  expect(lessonPathParam.safeParse("courses/a/b").success).toBe(false);
  expect(takeIdParam.safeParse("1729850000000").success).toBe(true);
  expect(takeIdParam.safeParse("12/..").success).toBe(false);
});
