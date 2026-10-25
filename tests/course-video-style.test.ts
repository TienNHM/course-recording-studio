import { expect, test } from "bun:test";
import { course } from "../config/course";
import { coursePatch } from "../scripts/server/course-api";
import { applyCoursePatch } from "../scripts/server/course-tree";

const base = course.parse({
  id: "c",
  name: "C",
  createdAt: "2026-10-25T00:00:00.000Z",
});

test("courses without videoStyle get the default style", () => {
  expect(base.videoStyle.palette).toBe("dotnet");
  expect(base.videoStyle.progressBar).toBe(true);
});

test("videoStyle patches merge field by field", () => {
  const patch = coursePatch.parse({ videoStyle: { palette: "ocean" } });
  const next = applyCoursePatch(base, patch);
  expect(next.videoStyle.palette).toBe("ocean");
  expect(next.videoStyle.intro).toBe(base.videoStyle.intro);
  expect(next.videoStyle.chapterCards).toBe(true);
});

test("unknown videoStyle keys are rejected", () => {
  expect(() => coursePatch.parse({ videoStyle: { sparkle: true } })).toThrow();
});
