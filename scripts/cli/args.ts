// Minimal argv parser for the studio CLI (pure, unit-tested).
//   --key value | --key=value | --flag | --no-flag ; repeated keys collect.
export type ParsedArgs = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean | string[]>;
};

// Flags that never take a value.
export const BOOLEAN_FLAGS = new Set([
  "json",
  "help",
  "wait",
  "render",
  "accept-silence",
  "retranscribe",
  "timed",
  "captions",
  "transcribe",
  "intro",
  "outro",
  "raw",
  "whole-word",
]);

const BOOL_LITERALS = new Set(["true", "false"]);

export const parseArgs = (
  argv: string[],
  booleanFlags: Set<string> = BOOLEAN_FLAGS,
): ParsedArgs => {
  const positionals: string[] = [];
  const flags: ParsedArgs["flags"] = {};
  const set = (key: string, value: string | boolean) => {
    const prev = flags[key];
    if (prev === undefined || typeof value === "boolean") {
      flags[key] = value;
    } else if (Array.isArray(prev)) {
      prev.push(value as string);
    } else if (typeof prev === "string") {
      flags[key] = [prev, value];
    } else {
      flags[key] = value;
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--") || arg === "--") {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    if (body.startsWith("no-") && booleanFlags.has(body.slice(3))) {
      set(body.slice(3), false);
      continue;
    }
    if (booleanFlags.has(body)) {
      // `--intro false` is accepted as well as `--no-intro`.
      const literal = argv[i + 1];
      if (literal !== undefined && BOOL_LITERALS.has(literal)) {
        set(body, literal === "true");
        i++;
      } else {
        set(body, true);
      }
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      set(body, true);
      continue;
    }
    set(body, next);
    i++;
  }

  return {
    command: positionals.shift() ?? null,
    positionals,
    flags,
  };
};

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export const getString = (
  args: ParsedArgs,
  key: string,
): string | undefined => {
  const value = args.flags[key];
  if (value === undefined || typeof value === "boolean") {
    if (value === true) {
      throw new UsageError(`--${key} needs a value`);
    }
    return undefined;
  }
  return Array.isArray(value) ? value[value.length - 1] : value;
};

export const requireString = (args: ParsedArgs, key: string): string => {
  const value = getString(args, key);
  if (value === undefined || value === "") {
    throw new UsageError(`Missing --${key}`);
  }
  return value;
};

export const getList = (args: ParsedArgs, key: string): string[] => {
  const value = args.flags[key];
  if (value === undefined || typeof value === "boolean") {
    return [];
  }
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
};

export const getBool = (args: ParsedArgs, key: string): boolean | undefined => {
  const value = args.flags[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const last = Array.isArray(value) ? value[value.length - 1] : value;
  if (last === "true" || last === "1" || last === "yes") {
    return true;
  }
  if (last === "false" || last === "0" || last === "no") {
    return false;
  }
  throw new UsageError(`--${key} must be true or false`);
};

export const getNumber = (
  args: ParsedArgs,
  key: string,
): number | undefined => {
  const value = getString(args, key);
  if (value === undefined) {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new UsageError(`--${key} must be a number`);
  }
  return n;
};

export const getIndices = (args: ParsedArgs, key: string): number[] =>
  getList(args, key).map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      throw new UsageError(`--${key} takes cut indices like 0,3,4`);
    }
    return n;
  });

// "find=replace" pairs for transcript fixes.
export const parseReplacement = (value: string) => {
  const eq = value.indexOf("=");
  if (eq <= 0) {
    throw new UsageError(`--replace takes "find=replace", got "${value}"`);
  }
  return { find: value.slice(0, eq), replace: value.slice(eq + 1) };
};
