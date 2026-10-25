import { describe, expect, test } from "bun:test";
import { DICTIONARIES } from "../src/i18n/dictionaries";
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatRelativeTime,
} from "../src/i18n/format";
import { interpolate, translate } from "../src/i18n/translate";
import { isPlural, type MessageTree } from "../src/i18n/types";

const leafKeys = (tree: MessageTree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" || isPlural(value)
      ? [prefix + key]
      : leafKeys(value, `${prefix}${key}.`),
  );

describe("dictionaries", () => {
  test("en has exactly the same keys as vi in every namespace", () => {
    for (const ns of Object.keys(
      DICTIONARIES.vi,
    ) as (keyof typeof DICTIONARIES.vi)[]) {
      expect(leafKeys(DICTIONARIES.en[ns]).sort()).toEqual(
        leafKeys(DICTIONARIES.vi[ns]).sort(),
      );
    }
  });
  test("no empty messages", () => {
    const empty: string[] = [];
    const walk = (tree: MessageTree, prefix: string) => {
      for (const [key, value] of Object.entries(tree)) {
        if (typeof value === "string") {
          if (value.trim() === "") empty.push(prefix + key);
        } else if (isPlural(value)) {
          if (value.other.trim() === "") empty.push(prefix + key);
        } else {
          walk(value, `${prefix}${key}.`);
        }
      }
    };
    for (const locale of ["vi", "en"] as const) {
      for (const [ns, tree] of Object.entries(DICTIONARIES[locale])) {
        walk(tree, `${locale}:${ns}:`);
      }
    }
    expect(empty).toEqual([]);
  });
});

describe("translate", () => {
  test("nested keys and both locales", () => {
    expect(translate("vi", "common", "actions.save")).toBe("Lưu");
    expect(translate("en", "common", "actions.save")).toBe("Save");
  });
  test("interpolation", () => {
    expect(
      translate("en", "common", "state.errorWithMessage", { message: "boom" }),
    ).toBe("Something went wrong: boom");
    expect(interpolate("{a} and {b}", { a: "x" }, "en")).toBe("x and {b}");
  });
  test("plurals", () => {
    expect(translate("en", "common", "count.lessons", { count: 1 })).toBe(
      "1 lesson",
    );
    expect(translate("en", "common", "count.lessons", { count: 3 })).toBe(
      "3 lessons",
    );
    expect(translate("en", "common", "count.lessons", { count: 0 })).toBe(
      "No lessons yet",
    );
    expect(translate("vi", "common", "count.lessons", { count: 1 })).toBe(
      "1 bài học",
    );
    expect(translate("vi", "common", "count.lessons", { count: 1200 })).toBe(
      "1.200 bài học",
    );
  });
  test("missing key returns the key", () => {
    expect(translate("en", "common", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("formatters", () => {
  test("formatDuration", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(59 * 60_000 + 59_999)).toBe("59:59");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });
  test("formatBytes", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(512, "en")).toBe("512 B");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(1536, "vi")).toBe("1,5 KB");
    expect(formatBytes(1024 ** 3 * 12, "en")).toBe("12 GB");
  });
  test("formatNumber uses locale separators", () => {
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(formatNumber(1234.5, "vi")).toBe("1.234,5");
  });
  test("formatRelativeTime", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(
      formatRelativeTime(new Date("2026-10-22T12:00:00Z"), "en", now),
    ).toBe("3 days ago");
    expect(
      formatRelativeTime(new Date("2026-10-22T12:00:00Z"), "vi", now),
    ).toBe("3 ngày trước");
  });
});
