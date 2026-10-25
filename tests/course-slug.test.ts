import { expect, test } from "bun:test";
import { slugify, uniqueSlug } from "../scripts/server/course-slug";

test("slugify strips Vietnamese diacritics", () => {
  expect(slugify("Lập trình Cơ bản Đà Nẵng")).toBe("lap-trinh-co-ban-da-nang");
  expect(slugify("Bài 1: Cài đặt môi trường")).toBe("bai-1-cai-dat-moi-truong");
  expect(slugify("Giới thiệu & Tổng quan!!")).toBe("gioi-thieu-tong-quan");
});

test("slugify removes path characters and trims dashes", () => {
  expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  expect(slugify("  --Hello World--  ")).toBe("hello-world");
  expect(slugify("!!!")).toBe("");
});

test("slugify limits length without trailing dash", () => {
  const slug = slugify(`${"a".repeat(59)} b`);
  expect(slug.length).toBeLessThanOrEqual(60);
  expect(slug.endsWith("-")).toBe(false);
});

test("uniqueSlug appends a counter for taken ids", () => {
  expect(uniqueSlug("Intro", [], "module")).toBe("intro");
  expect(uniqueSlug("Intro", ["intro"], "module")).toBe("intro-2");
  expect(uniqueSlug("Intro", ["intro", "intro-2"], "module")).toBe("intro-3");
});

test("uniqueSlug falls back for empty titles and avoids reserved names", () => {
  expect(uniqueSlug("???", [], "lesson")).toBe("lesson");
  expect(uniqueSlug("???", ["lesson"], "lesson")).toBe("lesson-2");
  expect(uniqueSlug("CON", [], "course")).toBe("con-2");
});
