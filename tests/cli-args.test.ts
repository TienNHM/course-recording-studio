import { describe, expect, test } from "bun:test";
import {
  UsageError,
  getBool,
  getIndices,
  getList,
  getNumber,
  getString,
  parseArgs,
  parseReplacement,
  requireString,
} from "../scripts/cli/args";

describe("parseArgs", () => {
  test("command, positionals and flags", () => {
    const a = parseArgs([
      "process",
      "courses/a/b/c",
      "--file",
      "D:\rec 1.mp4",
      "--render",
      "--json",
    ]);
    expect(a.command).toBe("process");
    expect(a.positionals).toEqual(["courses/a/b/c"]);
    expect(getString(a, "file")).toBe("D:\rec 1.mp4");
    expect(getBool(a, "render")).toBe(true);
    expect(getBool(a, "json")).toBe(true);
  });

  test("--key=value, --no-flag and boolean literals", () => {
    const a = parseArgs([
      "x",
      "--course=My Course",
      "--no-wait",
      "--intro",
      "false",
      "--outro",
      "true",
      "--transcribe",
    ]);
    expect(getString(a, "course")).toBe("My Course");
    expect(getBool(a, "wait")).toBe(false);
    expect(getBool(a, "intro")).toBe(false);
    expect(getBool(a, "outro")).toBe(true);
    expect(getBool(a, "transcribe")).toBe(true);
    expect(a.positionals).toEqual([]);
  });

  test("boolean flags do not swallow positionals", () => {
    const a = parseArgs(["plan", "--raw", "courses/a/b/c"]);
    expect(a.positionals).toEqual(["courses/a/b/c"]);
  });

  test("repeated flags collect and lists split on commas", () => {
    const a = parseArgs([
      "x",
      "--replace",
      "a=b",
      "--replace",
      "c,d=e",
      "--accept",
      "0,2",
      "--accept",
      "5",
    ]);
    expect(a.flags.replace).toEqual(["a=b", "c,d=e"]);
    expect(getIndices(a, "accept")).toEqual([0, 2, 5]);
    expect(getList(a, "accept")).toEqual(["0", "2", "5"]);
  });

  test("everything after -- is positional", () => {
    const a = parseArgs(["x", "--", "--not-a-flag"]);
    expect(a.positionals).toEqual(["--not-a-flag"]);
  });

  test("validation helpers", () => {
    const a = parseArgs(["x", "--timeout", "abc", "--accept", "-1", "--title"]);
    expect(() => getNumber(a, "timeout")).toThrow(UsageError);
    expect(() => getIndices(a, "accept")).toThrow(UsageError);
    expect(() => getString(a, "title")).toThrow(/needs a value/);
    expect(() => requireString(a, "missing")).toThrow(/Missing --missing/);
    expect(parseArgs([]).command).toBeNull();
  });

  test("replacements", () => {
    expect(parseReplacement("dot net=.NET")).toEqual({
      find: "dot net",
      replace: ".NET",
    });
    expect(parseReplacement("a==b")).toEqual({ find: "a", replace: "=b" });
    expect(() => parseReplacement("=x")).toThrow(UsageError);
  });
});
