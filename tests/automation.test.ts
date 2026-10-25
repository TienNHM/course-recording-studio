import { describe, expect, test } from "bun:test";
import path from "path";
import type { JobState, Lesson } from "../config/course";
import { lesson as lessonSchema } from "../config/course";
import { appendEvent } from "../scripts/server/automation/activity-log";
import type { ActivityEvent } from "../scripts/server/automation/activity-log";
import {
  decideAfterJob,
  decideAutoProcess,
  describePipeline,
  pendingAction,
} from "../scripts/server/automation/decisions";
import {
  parseInboxPath,
  processedName,
} from "../scripts/server/automation/inbox-path";
import {
  mergeSettings,
  resolveSettings,
  settingsPatch,
  validateInboxDir,
} from "../scripts/server/automation/settings";
import { StableFileTracker } from "../scripts/server/automation/stable-file";
import { matchByTitle } from "../scripts/server/course-match";

const makeLesson = (
  overrides: Omit<Partial<Lesson>, "postProduction"> & {
    postProduction?: Partial<Lesson["postProduction"]>;
  } = {},
): Lesson => {
  const { postProduction, ...rest } = overrides;
  return lessonSchema.parse({
    id: "intro",
    courseId: "c",
    moduleId: "m",
    title: "Intro",
    order: 0,
    status: "RECORDED",
    selectedTake: "1700000000000",
    ...rest,
    postProduction: postProduction ?? {},
  });
};

const job = (kind: JobState["kind"], status: JobState["status"]): JobState => ({
  id: `${kind}-1`,
  kind,
  lessonPath: "courses/c/m/intro",
  takeId: "1",
  status,
  step: "",
  progress: 0,
  error: status === "FAILED" ? "boom" : null,
  createdAt: "",
  updatedAt: "",
  finishedAt: null,
});

describe("decideAutoProcess", () => {
  test("starts by default (autoProcess defaults to on)", () => {
    expect(
      decideAutoProcess({ lesson: makeLesson(), hasActiveJob: false }),
    ).toEqual({ start: true });
  });

  test("respects autoProcess off, unless the request overrides it", () => {
    const lesson = makeLesson({ postProduction: { autoProcess: false } });
    expect(decideAutoProcess({ lesson, hasActiveJob: false }).start).toBe(
      false,
    );
    expect(
      decideAutoProcess({ lesson, hasActiveJob: false, override: true }).start,
    ).toBe(true);
  });

  test("override false always wins", () => {
    expect(
      decideAutoProcess({
        lesson: makeLesson(),
        hasActiveJob: false,
        override: false,
      }).start,
    ).toBe(false);
  });

  test("never starts with an active job, without a take or when archived", () => {
    expect(
      decideAutoProcess({ lesson: makeLesson(), hasActiveJob: true }).start,
    ).toBe(false);
    expect(
      decideAutoProcess({
        lesson: makeLesson({ selectedTake: null }),
        hasActiveJob: false,
      }).start,
    ).toBe(false);
    expect(
      decideAutoProcess({
        lesson: makeLesson({ status: "ARCHIVED" }),
        hasActiveJob: false,
      }).start,
    ).toBe(false);
  });
});

describe("decideAfterJob", () => {
  const publishing = makeLesson({
    status: "REVIEW",
    postProduction: { autoPublish: true },
  });

  test("renders after a completed production when autoPublish is on", () => {
    expect(
      decideAfterJob({
        state: job("production", "COMPLETED"),
        lesson: publishing,
        hasEditPlan: true,
      }),
    ).toEqual({ start: true });
  });

  test("never renders after FAILED or CANCELLED production", () => {
    for (const status of ["FAILED", "CANCELLED"] as const) {
      expect(
        decideAfterJob({
          state: job("production", status),
          lesson: publishing,
          hasEditPlan: true,
          autoPublishOverride: true,
        }).start,
      ).toBe(false);
    }
  });

  test("waits for review when autoPublish is off (default)", () => {
    const d = decideAfterJob({
      state: job("production", "COMPLETED"),
      lesson: makeLesson({ status: "REVIEW" }),
      hasEditPlan: true,
    });
    expect(d).toMatchObject({ start: false });
  });

  test("per-job override beats the lesson flag", () => {
    expect(
      decideAfterJob({
        state: job("production", "COMPLETED"),
        lesson: publishing,
        hasEditPlan: true,
        autoPublishOverride: false,
      }).start,
    ).toBe(false);
  });

  test("nothing follows a render, a missing plan or an unreadable lesson", () => {
    expect(
      decideAfterJob({
        state: job("render", "COMPLETED"),
        lesson: publishing,
        hasEditPlan: true,
      }).start,
    ).toBe(false);
    expect(
      decideAfterJob({
        state: job("production", "COMPLETED"),
        lesson: publishing,
        hasEditPlan: false,
      }).start,
    ).toBe(false);
    expect(
      decideAfterJob({
        state: job("production", "COMPLETED"),
        lesson: null,
        hasEditPlan: true,
      }).start,
    ).toBe(false);
  });
});

describe("describePipeline", () => {
  const lessonPath = "courses/c/m/intro";

  test("running production → render next (automatic) with autoPublish", () => {
    const s = describePipeline({
      lessonPath,
      lesson: makeLesson({
        status: "PROCESSING",
        postProduction: { autoPublish: true },
      }),
      job: job("production", "TRANSCRIBING"),
    });
    expect(s).toMatchObject({
      running: true,
      next: "render",
      nextIsAutomatic: true,
    });
  });

  test("running production → review without autoPublish", () => {
    const s = describePipeline({
      lessonPath,
      lesson: makeLesson({ status: "PROCESSING" }),
      job: job("production", "ANALYZING"),
    });
    expect(s).toMatchObject({ next: "review", nextIsAutomatic: false });
  });

  test("failed production is reported on a RECORDED lesson", () => {
    const s = describePipeline({
      lessonPath,
      lesson: makeLesson(),
      job: job("production", "FAILED"),
    });
    expect(s.next).toBe("production");
    expect(s.message).toContain("boom");
  });

  test("published lesson has nothing next", () => {
    expect(
      describePipeline({
        lessonPath,
        lesson: makeLesson({ status: "PUBLISHED" }),
        job: job("render", "COMPLETED"),
      }).next,
    ).toBeNull();
  });
});

describe("pendingAction", () => {
  test("RECORDED → production, REVIEW+autoPublish → render", () => {
    expect(
      pendingAction({
        lesson: makeLesson(),
        hasActiveJob: false,
        hasEditPlan: false,
      }),
    ).toEqual({ action: "production" });
    expect(
      pendingAction({
        lesson: makeLesson({
          status: "REVIEW",
          postProduction: { autoPublish: true },
        }),
        hasActiveJob: false,
        hasEditPlan: true,
      }),
    ).toEqual({ action: "render" });
  });

  test("skips REVIEW without autoPublish, active jobs and other statuses", () => {
    expect(
      pendingAction({
        lesson: makeLesson({ status: "REVIEW" }),
        hasActiveJob: false,
        hasEditPlan: true,
      }).action,
    ).toBeNull();
    expect(
      pendingAction({
        lesson: makeLesson(),
        hasActiveJob: true,
        hasEditPlan: false,
      }).action,
    ).toBeNull();
    expect(
      pendingAction({
        lesson: makeLesson({ status: "PUBLISHED" }),
        hasActiveJob: false,
        hasEditPlan: true,
      }).action,
    ).toBeNull();
  });
});

describe("StableFileTracker", () => {
  test("a file is stable once size and mtime are unchanged for 5 s", () => {
    let now = 0;
    const tracker = new StableFileTracker(5000, () => now);
    const snap = { size: 100, mtimeMs: 1 };
    expect(tracker.observe("a", snap).stable).toBe(false);
    now = 4999;
    expect(tracker.observe("a", snap)).toEqual({
      stable: false,
      stableForMs: 4999,
    });
    now = 5000;
    expect(tracker.observe("a", snap).stable).toBe(true);
  });

  test("growth (OBS still writing) restarts the wait", () => {
    let now = 0;
    const tracker = new StableFileTracker(5000, () => now);
    tracker.observe("a", { size: 100, mtimeMs: 1 });
    now = 4000;
    expect(tracker.observe("a", { size: 200, mtimeMs: 2 }).stable).toBe(false);
    now = 8000;
    expect(tracker.observe("a", { size: 200, mtimeMs: 2 }).stable).toBe(false);
    now = 9000;
    expect(tracker.observe("a", { size: 200, mtimeMs: 2 }).stable).toBe(true);
  });

  test("an empty file is never stable; forget/retain drop state", () => {
    let now = 0;
    const tracker = new StableFileTracker(5000, () => now);
    tracker.observe("empty", { size: 0, mtimeMs: 1 });
    now = 60000;
    expect(tracker.observe("empty", { size: 0, mtimeMs: 1 }).stable).toBe(
      false,
    );
    tracker.observe("b", { size: 1, mtimeMs: 1 });
    tracker.retain(new Set(["b"]));
    expect(tracker.pending().map((p) => p.file)).toEqual(["b"]);
    tracker.forget("b");
    expect(tracker.pending()).toEqual([]);
  });
});

describe("parseInboxPath", () => {
  const inbox = path.resolve("inbox");
  const at = (...parts: string[]) => path.join(inbox, ...parts);

  test("course/module/lesson titles with Vietnamese diacritics", () => {
    const r = parseInboxPath(
      inbox,
      at("Lập trình .NET", "Chương 1: Cơ bản", "Bài tự động.mp4"),
    );
    expect(r).toEqual({
      kind: "video",
      entry: {
        course: "Lập trình .NET",
        module: "Chương 1: Cơ bản",
        lesson: "Bài tự động",
        extension: "mp4",
        markersFile: at(
          "Lập trình .NET",
          "Chương 1: Cơ bản",
          "Bài tự động.markers.json",
        ),
      },
    });
  });

  test("decomposed (NFD) names are normalized to NFC", () => {
    const r = parseInboxPath(
      inbox,
      at("Khóa".normalize("NFD"), "M", "Bài  học .MKV"),
    );
    expect(r.kind).toBe("video");
    if (r.kind === "video") {
      expect(r.entry.course).toBe("Khóa".normalize("NFC"));
      expect(r.entry.lesson).toBe("Bài học");
      expect(r.entry.extension).toBe("mkv");
    }
  });

  test("videos in the wrong place are invalid", () => {
    expect(parseInboxPath(inbox, at("video.mp4")).kind).toBe("invalid");
    expect(parseInboxPath(inbox, at("Course", "video.mp4")).kind).toBe(
      "invalid",
    );
    expect(
      parseInboxPath(inbox, at("C", "M", "extra", "video.webm")).kind,
    ).toBe("invalid");
    expect(parseInboxPath(inbox, at("C", "M", " .mp4")).kind).toBe("invalid");
  });

  test("sidecars, temp files, processed folders and non-videos are ignored", () => {
    for (const file of [
      at("C", "M", "Intro.markers.json"),
      at("C", "M", "Intro.mp4.part"),
      at("C", "M", "Intro.crdownload"),
      at("C", "M", "display.importing.mp4"),
      at("C", "M", ".hidden.mp4"),
      at("C", "M", "~$lock.mp4"),
      at("C", "M", "notes.txt"),
      at("_imported", "2026-x-Intro.mp4"),
      at("_failed", "C", "M", "Intro.mp4"),
      path.resolve("elsewhere", "C", "M", "Intro.mp4"),
    ]) {
      expect(parseInboxPath(inbox, file).kind).toBe("ignore");
    }
  });

  test("processed names are sortable and contain no colons", () => {
    const name = processedName(
      "Bài 1.mp4",
      new Date("2026-10-25T10:11:12.345Z"),
    );
    expect(name).toBe("2026-10-25T10-11-12-345Z-Bài 1.mp4");
  });
});

describe("automation settings", () => {
  const home = path.resolve("home");
  const env = { USERPROFILE: home };
  const publicDir = path.resolve("app", "public");

  test("defaults: suggested folder, disabled", () => {
    const s = resolveSettings({}, env);
    expect(s.inboxDir).toBe(path.join(home, "Videos", "CourseStudioInbox"));
    expect(s.enabled).toBe(false);
    expect(s.inboxDirSource).toBe("default");
  });

  test("COURSE_STUDIO_INBOX sets the folder and enables it", () => {
    const dir = path.resolve("drop");
    const s = resolveSettings({}, { ...env, COURSE_STUDIO_INBOX: dir });
    expect(s).toMatchObject({
      inboxDir: dir,
      enabled: true,
      inboxDirSource: "env",
    });
    expect(
      resolveSettings({ enabled: false }, { ...env, COURSE_STUDIO_INBOX: dir })
        .enabled,
    ).toBe(false);
  });

  test("the settings file beats the environment", () => {
    const stored = path.resolve("stored");
    const s = resolveSettings(
      { inboxDir: stored, enabled: true },
      { ...env, COURSE_STUDIO_INBOX: path.resolve("drop") },
    );
    expect(s).toMatchObject({ inboxDir: stored, inboxDirSource: "settings" });
  });

  test("folder validation", () => {
    expect(validateInboxDir("relative/inbox", { publicDir })).toContain(
      "absolute",
    );
    expect(
      validateInboxDir(path.join(publicDir, "courses", "in"), { publicDir }),
    ).toContain("outside");
    expect(validateInboxDir(path.dirname(publicDir), { publicDir })).toContain(
      "outside",
    );
    expect(
      validateInboxDir(path.parse(publicDir).root, { publicDir }),
    ).toContain("root");
    expect(validateInboxDir(path.resolve("inbox"), { publicDir })).toBeNull();
  });

  test("patch schema and merge", () => {
    expect(settingsPatch.safeParse({ enabled: "yes" }).success).toBe(false);
    expect(settingsPatch.safeParse({ other: 1 }).success).toBe(false);
    expect(settingsPatch.safeParse({ inboxDir: "" }).success).toBe(false);
    const dir = path.resolve("inbox");
    expect(
      mergeSettings({}, { inboxDir: dir, enabled: true }, env, publicDir),
    ).toEqual({ inboxDir: dir, enabled: true });
    expect(
      mergeSettings({ inboxDir: dir }, { inboxDir: null }, env, publicDir),
    ).toEqual({ inboxDir: null });
    expect(() =>
      mergeSettings({}, { inboxDir: "not/absolute" }, env, publicDir),
    ).toThrow("absolute");
  });
});

describe("activity log", () => {
  test("keeps only the newest events", () => {
    let list: ActivityEvent[] = [];
    for (let i = 0; i < 60; i++) {
      list = appendEvent(list, {
        id: String(i),
        at: "",
        level: "info",
        type: "detected",
        message: "",
      });
    }
    expect(list).toHaveLength(50);
    expect(list[0]?.id).toBe("10");
    expect(list[49]?.id).toBe("59");
  });
});

describe("matchByTitle (shared by server and client)", () => {
  const items = [
    { id: "lap-trinh-net", title: "Lập trình .NET" },
    { id: "bai-tu-dong", title: "Bài tự động" },
  ];
  test("matches id, exact title and slug of the title", () => {
    const get = (w: string) =>
      matchByTitle(
        items,
        w,
        (i) => i.id,
        (i) => i.title,
      )?.id;
    expect(get("lap-trinh-net")).toBe("lap-trinh-net");
    expect(get("Bài tự động")).toBe("bai-tu-dong");
    expect(get("bai tu dong")).toBe("bai-tu-dong");
    expect(get("other")).toBeUndefined();
  });
});
