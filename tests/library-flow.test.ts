import { describe, expect, test } from "bun:test";
import type { JobState, Lesson, LessonStatus } from "../config/course";
import {
  deriveLessonFlow,
  describeNext,
  draftSignature,
  duplicateIndices,
  glossaryToRows,
  isAbsolutePath,
  isDraftValid,
  lessonDraftToPatch,
  rowsToGlossary,
  validateLessonDraft,
  validateTitle,
  type LessonDraft,
} from "../src/library/lesson-flow";

const lesson = (
  status: LessonStatus,
  { take = true, autoPublish = false } = {},
) => ({
  status,
  selectedTake: take ? "1711527012951" : null,
  postProduction: { autoPublish },
});

const job = (
  kind: JobState["kind"],
  status: JobState["status"],
  error: string | null = null,
) => ({ kind, status, error });

const states = (flow: ReturnType<typeof deriveLessonFlow>) =>
  flow.steps.map((s) => s.state);

describe("deriveLessonFlow", () => {
  test("draft and ready lessons start with Record", () => {
    for (const status of ["DRAFT", "READY_TO_RECORD"] as const) {
      const flow = deriveLessonFlow({
        lesson: lesson(status, { take: false }),
        job: null,
      });
      expect(flow.primary).toBe("record");
      expect(states(flow)).toEqual([
        "current",
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
      expect(flow.secondary).toEqual([]);
    }
  });

  test("recorded lesson: Process is primary", () => {
    const flow = deriveLessonFlow({ lesson: lesson("RECORDED"), job: null });
    expect(flow.primary).toBe("process");
    expect(states(flow)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(flow.secondary).toContain("record");
  });

  test("recorded lesson without take falls back to Record", () => {
    const flow = deriveLessonFlow({
      lesson: lesson("RECORDED", { take: false }),
      job: null,
    });
    expect(flow.primary).toBe("record");
  });

  test("failed post-production marks the process step failed", () => {
    const flow = deriveLessonFlow({
      lesson: lesson("RECORDED"),
      job: job("production", "FAILED"),
    });
    expect(states(flow)[1]).toBe("failed");
    expect(flow.primary).toBe("process");
  });

  test("running jobs: no primary action, active step", () => {
    const production = deriveLessonFlow({
      lesson: lesson("PROCESSING"),
      job: job("production", "TRANSCRIBING"),
    });
    expect(production.primary).toBeNull();
    expect(production.waiting).toBe("job");
    expect(states(production)).toEqual([
      "done",
      "active",
      "upcoming",
      "upcoming",
    ]);

    const render = deriveLessonFlow({
      lesson: lesson("REVIEW"),
      job: job("render", "RENDERING"),
    });
    expect(states(render)).toEqual(["done", "done", "done", "active"]);
  });

  test("review lesson: Review is primary, or Export with autoPublish", () => {
    const review = deriveLessonFlow({ lesson: lesson("REVIEW"), job: null });
    expect(review.primary).toBe("review");
    expect(states(review)).toEqual(["done", "done", "current", "upcoming"]);
    expect(review.secondary[0]).toBe("export");

    const auto = deriveLessonFlow({
      lesson: lesson("REVIEW", { autoPublish: true }),
      job: job("production", "COMPLETED"),
    });
    expect(auto.primary).toBe("export");
    expect(states(auto)).toEqual(["done", "done", "done", "current"]);
  });

  test("failed render puts Export first and marks publish failed", () => {
    const flow = deriveLessonFlow({
      lesson: lesson("REVIEW"),
      job: job("render", "FAILED"),
    });
    expect(flow.primary).toBe("export");
    expect(states(flow)[3]).toBe("failed");
  });

  test("published lesson: everything done, open published", () => {
    const flow = deriveLessonFlow({
      lesson: lesson("PUBLISHED"),
      job: job("render", "COMPLETED"),
    });
    expect(flow.primary).toBe("open-published");
    expect(states(flow)).toEqual(["done", "done", "done", "done"]);
  });

  test("archived lesson has no actions", () => {
    const flow = deriveLessonFlow({ lesson: lesson("ARCHIVED"), job: null });
    expect(flow.primary).toBeNull();
    expect(flow.waiting).toBe("archived");
  });
});

describe("describeNext", () => {
  const base = { autoProcess: true, autoPublish: false, job: null };

  test("waiting for a recording mentions automatic processing", () => {
    expect(describeNext({ ...base, lessonStatus: "DRAFT" }).key).toBe(
      "waitingRecordAuto",
    );
    expect(
      describeNext({ ...base, autoProcess: false, lessonStatus: "DRAFT" }).key,
    ).toBe("waitingRecord");
  });

  test("running post-production with and without autoPublish", () => {
    const running = job("production", "EDITING");
    expect(
      describeNext({
        ...base,
        autoPublish: true,
        lessonStatus: "PROCESSING",
        job: running,
      }),
    ).toEqual({
      key: "processingThenPublish",
      automatic: true,
      lastError: null,
    });
    expect(
      describeNext({ ...base, lessonStatus: "PROCESSING", job: running }).key,
    ).toBe("processingThenReview");
  });

  test("rendering and published", () => {
    expect(
      describeNext({
        ...base,
        lessonStatus: "REVIEW",
        job: job("render", "QUEUED"),
      }).key,
    ).toBe("rendering");
    expect(
      describeNext({ ...base, lessonStatus: "PUBLISHED" }).automatic,
    ).toBeNull();
  });

  test("reports the last error", () => {
    const next = describeNext({
      ...base,
      lessonStatus: "RECORDED",
      job: job("production", "FAILED", "ffmpeg crashed"),
    });
    expect(next.key).toBe("recorded");
    expect(next.lastError).toBe("ffmpeg crashed");
  });

  test("review with autoPublish suggests exporting", () => {
    expect(
      describeNext({ ...base, autoPublish: true, lessonStatus: "REVIEW" }).key,
    ).toBe("reviewAutoPublish");
  });
});

describe("validation", () => {
  test("validateTitle", () => {
    expect(validateTitle("")).toBe("required");
    expect(validateTitle("   ")).toBe("required");
    expect(validateTitle("Bài 1")).toBeNull();
    expect(validateTitle("x".repeat(121))).toBe("tooLong");
    expect(validateTitle("abcd", 3)).toBe("tooLong");
  });

  test("duplicateIndices ignores case, whitespace and blanks", () => {
    expect(duplicateIndices(["A", " a ", "", "", "b", "B"])).toEqual([1, 5]);
    expect(duplicateIndices([])).toEqual([]);
  });

  const draft: LessonDraft = {
    title: "  Giới thiệu  ",
    description: "",
    objectives: ["Hiểu .NET", "", " hiểu .net "],
    notes: "",
    recordingProfile: { webcam: false, microphone: true },
    postProduction: {
      autoTranscribe: true,
      autoDetectSilence: true,
      autoRemoveSilence: false,
      silencePreset: "conservative",
      generateChapters: true,
      intro: true,
      outro: true,
      autoProcess: true,
      autoPublish: false,
    } satisfies Lesson["postProduction"],
  };

  test("validateLessonDraft flags duplicate objectives", () => {
    const errors = validateLessonDraft(draft);
    expect(errors).toEqual({ title: null, duplicateObjectives: [2] });
    expect(isDraftValid(errors)).toBe(false);
    expect(
      isDraftValid(validateLessonDraft({ ...draft, objectives: ["a"] })),
    ).toBe(true);
  });

  test("lessonDraftToPatch trims and promotes DRAFT", () => {
    const patch = lessonDraftToPatch(draft, "DRAFT");
    expect(patch.title).toBe("Giới thiệu");
    expect(patch.objectives).toEqual(["Hiểu .NET", "hiểu .net"]);
    expect(patch.status).toBe("READY_TO_RECORD");
    expect("status" in lessonDraftToPatch(draft, "REVIEW")).toBe(false);
  });

  test("draftSignature ignores blank objectives and title whitespace", () => {
    expect(draftSignature(draft)).toBe(
      draftSignature({
        ...draft,
        title: "Giới thiệu",
        objectives: ["Hiểu .NET", "hiểu .net"],
      }),
    );
  });
});

describe("glossary rows", () => {
  test("round trip, trimming and de-duplicating aliases", () => {
    const rows = glossaryToRows([
      { term: "ASP.NET Core", aliases: ["asp dot net", "a s p"] },
    ]);
    expect(rows).toEqual([
      { term: "ASP.NET Core", aliases: "asp dot net, a s p" },
    ]);
    expect(
      rowsToGlossary([
        { term: " C# ", aliases: "c sharp, , c sharp ,xi sáp" },
        { term: "  ", aliases: "ignored" },
      ]),
    ).toEqual([{ term: "C#", aliases: ["c sharp", "xi sáp"] }]);
  });
});

test("isAbsolutePath", () => {
  expect(isAbsolutePath("C:\\Users\\me\\Videos")).toBe(true);
  expect(isAbsolutePath("d:/inbox")).toBe(true);
  expect(isAbsolutePath("\\\\nas\\share")).toBe(true);
  expect(isAbsolutePath("/home/me/inbox")).toBe(true);
  expect(isAbsolutePath("Videos\\inbox")).toBe(false);
  expect(isAbsolutePath("")).toBe(false);
});
