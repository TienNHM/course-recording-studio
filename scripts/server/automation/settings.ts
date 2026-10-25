// Server automation settings: the "drop to publish" inbox folder.
// Stored in public/courses/.studio-settings.json as {inboxDir, enabled}.
// COURSE_STUDIO_INBOX sets the inbox folder (and enables it) unless the
// settings file says otherwise.
import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import { COURSES_DIR } from "../../../config/course";
import { PUBLIC_DIR, writeJsonAtomic } from "../course-store";

export const INBOX_ENV = "COURSE_STUDIO_INBOX";

export const storedSettings = z.object({
  inboxDir: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});
export type StoredSettings = z.infer<typeof storedSettings>;

// Body of PUT /api/automation/settings.
export const settingsPatch = z
  .object({
    // null resets to COURSE_STUDIO_INBOX / the default suggestion.
    inboxDir: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatch>;

export type AutomationSettings = {
  inboxDir: string;
  enabled: boolean;
  inboxDirSource: "settings" | "env" | "default";
  suggestedInboxDir: string;
  settingsFile: string;
};

export const settingsFile = () =>
  path.join(PUBLIC_DIR, COURSES_DIR, ".studio-settings.json");

export const suggestedInboxDir = (
  env: Record<string, string | undefined> = process.env,
) =>
  path.join(
    env.USERPROFILE || env.HOME || os.homedir(),
    "Videos",
    "CourseStudioInbox",
  );

const isInside = (child: string, parent: string) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

// Returns an error message, or null when the folder is acceptable.
export const validateInboxDir = (
  dir: string,
  { publicDir = PUBLIC_DIR }: { publicDir?: string } = {},
): string | null => {
  if (!path.isAbsolute(dir)) {
    return `The inbox folder must be an absolute path, got "${dir}"`;
  }
  const resolved = path.resolve(dir);
  if (path.parse(resolved).root === resolved) {
    return "The inbox folder cannot be the root of a drive";
  }
  if (isInside(resolved, publicDir) || isInside(publicDir, resolved)) {
    return `The inbox folder must be outside the app's public folder (${publicDir})`;
  }
  return null;
};

export const resolveSettings = (
  stored: StoredSettings,
  env: Record<string, string | undefined> = process.env,
): AutomationSettings => {
  const fromEnv = env[INBOX_ENV]?.trim() || null;
  const suggested = suggestedInboxDir(env);
  const inboxDir = stored.inboxDir || fromEnv || suggested;
  return {
    inboxDir: path.resolve(inboxDir),
    enabled: stored.enabled ?? fromEnv !== null,
    inboxDirSource: stored.inboxDir ? "settings" : fromEnv ? "env" : "default",
    suggestedInboxDir: suggested,
    settingsFile: settingsFile(),
  };
};

export const readStoredSettings = (): StoredSettings => {
  try {
    const parsed = storedSettings.safeParse(
      JSON.parse(fs.readFileSync(settingsFile(), "utf-8")),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

export const getSettings = () => resolveSettings(readStoredSettings());

// Merges a patch into the stored settings; throws a message on invalid input.
export const mergeSettings = (
  stored: StoredSettings,
  patch: SettingsPatch,
  env: Record<string, string | undefined> = process.env,
  publicDir = PUBLIC_DIR,
): StoredSettings => {
  const next: StoredSettings = { ...stored };
  if (patch.inboxDir !== undefined) {
    next.inboxDir = patch.inboxDir;
  }
  if (patch.enabled !== undefined) {
    next.enabled = patch.enabled;
  }
  // Validate what was given (resolveSettings would make it absolute).
  const problem = validateInboxDir(
    patch.inboxDir ?? resolveSettings(next, env).inboxDir,
    { publicDir },
  );
  if (problem) {
    throw new Error(problem);
  }
  return next;
};

export const saveSettings = (patch: SettingsPatch): AutomationSettings => {
  const next = mergeSettings(readStoredSettings(), patch);
  writeJsonAtomic(settingsFile(), next);
  return resolveSettings(next);
};
