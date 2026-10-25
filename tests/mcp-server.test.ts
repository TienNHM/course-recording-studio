import type { Caption } from "@remotion/captions";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import type { EditPlan } from "../config/course";
import { summarizeEditPlan } from "../mcp/edit-plan-tools";
import { createStudioMcpServer, toolSchemas } from "../mcp/server";
import {
  StudioClient,
  StudioUnavailableError,
  matchByTitle,
  studioUrl,
  toEditPlanPatch,
} from "../mcp/studio-client";
import {
  buildTranscript,
  editCaptionTexts,
  replaceInCaptions,
} from "../mcp/transcript";

const cap = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: startMs,
  confidence: 1,
});

const plan: EditPlan = {
  takeId: "1",
  durationMs: 10000,
  segments: [
    { startMs: 0, endMs: 2000 },
    { startMs: 3000, endMs: 10000 },
  ],
  cuts: [
    { startMs: 2000, endMs: 3000, reason: "marker", accepted: true },
    { startMs: 5000, endMs: 6500, reason: "silence", accepted: false },
    { startMs: 8000, endMs: 9000, reason: "silence", accepted: false },
  ],
  chapters: [{ timeMs: 0, title: "Start" }],
  layout: "screen-only",
  intro: { title: "T", subtitle: null },
  outro: true,
};

const textOf = (r: unknown) =>
  (r as { content: { text: string }[] }).content[0]?.text ?? "";

describe("transcript helpers", () => {
  const captions = [
    cap("Xin", 0, 200),
    cap(" chào", 200, 400),
    cap(" dot", 400, 600),
    cap(" net.", 600, 800),
    cap(" Bắt", 2000, 2200),
    cap(" đầu", 2200, 2400),
  ];

  test("builds text and timed lines", () => {
    const t = buildTranscript(captions);
    expect(t.text).toBe("Xin chào dot net. Bắt đầu");
    expect(t.lines.map((l) => [l.fromCaption, l.toCaption, l.text])).toEqual([
      [0, 3, "Xin chào dot net."],
      [4, 5, "Bắt đầu"],
    ]);
  });

  test("replaces phrases across captions without changing timing", () => {
    const r = replaceInCaptions(captions, [
      { find: "dot net", replace: ".NET" },
    ]);
    expect(r.replaced).toBe(1);
    expect(r.captions.map((c) => c.text)).toEqual([
      "Xin",
      " chào",
      " .NET",
      ".",
      " Bắt",
      " đầu",
    ]);
    expect(r.captions.map((c) => c.startMs)).toEqual(
      captions.map((c) => c.startMs),
    );
  });

  test("whole-word matching is Unicode-aware", () => {
    const partial = replaceInCaptions(captions, [
      { find: "chà", replace: "X", wholeWord: true },
    ]);
    expect(partial.replaced).toBe(0);
    const caseInsensitive = replaceInCaptions(captions, [
      { find: "BẮT", replace: "bắt", wholeWord: true },
    ]);
    expect(caseInsensitive.replaced).toBe(1);
  });

  test("per-caption edits", () => {
    expect(
      editCaptionTexts(captions, [{ index: 0, text: "Chào" }])[0]?.text,
    ).toBe("Chào");
    expect(() =>
      editCaptionTexts(captions, [{ index: 99, text: "x" }]),
    ).toThrow(/No caption/);
  });
});

describe("edit plan helpers", () => {
  test("summary", () => {
    const s = summarizeEditPlan(plan);
    expect(s.keptDurationMs).toBe(9000);
    expect(s.removedDurationMs).toBe(1000);
    expect(s.acceptedCuts).toBe(1);
    expect(s.suggestedCuts).toBe(2);
    expect(s.suggestedDurationMs).toBe(2500);
    expect(s.byReason.silence).toEqual({ accepted: 0, suggested: 2 });
  });

  test("reason and index decisions become an index patch (indices win)", () => {
    expect(
      toEditPlanPatch(plan, { acceptReasons: ["silence"], rejectCuts: [2] }),
    ).toEqual({ cuts: [{ index: 1, accepted: true }] });
    expect(
      toEditPlanPatch(plan, { rejectReasons: ["marker"], outro: false }),
    ).toEqual({ cuts: [{ index: 0, accepted: false }], outro: false });
    expect(toEditPlanPatch(plan, { intro: null })).toEqual({ intro: null });
    expect(() => toEditPlanPatch(plan, { acceptCuts: [7] })).toThrow(
      /No cut with index 7/,
    );
  });
});

describe("studio client", () => {
  test("matchByTitle finds by id, title or slug", () => {
    const items = [{ id: "lap-trinh-net", name: "Lập trình .NET" }];
    const find = (q: string) =>
      matchByTitle(
        items,
        q,
        (i) => i.id,
        (i) => i.name,
      );
    expect(find("lap-trinh-net")).toBeDefined();
    expect(find("Lập trình .NET")).toBeDefined();
    expect(find("lập trình NET")).toBeDefined();
    expect(find("Other")).toBeUndefined();
  });

  test("studioUrl", () => {
    expect(studioUrl({})).toBe("http://localhost:4000");
    expect(studioUrl({ COURSE_STUDIO_URL: "http://x:1/" })).toBe("http://x:1");
  });

  test("a stopped app gives an actionable error", async () => {
    const client = new StudioClient("http://127.0.0.1:9");
    const err = await client.health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StudioUnavailableError);
    expect((err as Error).message).toContain("npm run dev");
  });
});

describe("MCP server", () => {
  const tree = [
    {
      course: {
        id: "c",
        name: "Course",
        description: "",
        language: "vi",
        outputProfile: "course-standard",
        glossary: [],
        createdAt: "2026-01-01",
      },
      modules: [
        {
          module: { id: "m", courseId: "c", title: "Module", order: 0 },
          lessons: [
            {
              id: "l",
              courseId: "c",
              moduleId: "m",
              title: "Lesson",
              status: "DRAFT",
              order: 0,
              selectedTake: null,
            },
          ],
        },
      ],
    },
  ];
  let fake: ReturnType<typeof Bun.serve>;
  let client: Client;

  beforeAll(async () => {
    fake = Bun.serve({
      port: 0,
      fetch: (req) =>
        new URL(req.url).pathname === "/api/courses"
          ? Response.json(tree)
          : Response.json({ error: "not found" }, { status: 404 }),
    });
    const server = createStudioMcpServer(
      new StudioClient(`http://localhost:${fake.port}`),
    );
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterAll(async () => {
    await client.close();
    fake.stop(true);
  });

  test("lists every tool with an input schema", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      Object.keys(toolSchemas).sort(),
    );
    for (const t of tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.description?.length ?? 0).toBeGreaterThan(10);
    }
    const imp = tools.find((t) => t.name === "import_recording");
    expect(imp?.inputSchema.required).toEqual(["lessonPath", "displayPath"]);
  });

  test("lists prompts and resources", async () => {
    expect(
      (await client.listPrompts()).prompts.map((p) => p.name).sort(),
    ).toEqual(["produce-lesson", "review-edit-plan"]);
    const templates = (
      await client.listResourceTemplates()
    ).resourceTemplates.map((t) => t.uriTemplate);
    expect(templates).toContain("lesson://{+lessonPath}");
    const resources = (await client.listResources()).resources.map(
      (r) => r.uri,
    );
    expect(resources).toContain("courses://tree");
    expect(resources).toContain("lesson://courses/c/m/l");
  });

  test("calls tools through the HTTP client", async () => {
    const r = await client.callTool({ name: "list_courses", arguments: {} });
    expect(JSON.parse(textOf(r))).toEqual([
      {
        id: "c",
        name: "Course",
        language: "vi",
        outputProfile: "course-standard",
        modules: 1,
        lessons: 1,
      },
    ]);
    const lesson = await client.readResource({ uri: "lesson://courses/c/m/l" });
    expect(JSON.stringify(lesson.contents[0])).toContain("DRAFT");
  });

  test("API errors become tool errors", async () => {
    const r = await client.callTool({
      name: "get_job_status",
      arguments: { lessonPath: "courses/c/m/l" },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("not found");
  });

  test("schemas reject bad input", () => {
    const importSchema = z.object(toolSchemas.import_recording);
    expect(
      importSchema.safeParse({ lessonPath: "x", displayPath: "D:/a.mp4" })
        .success,
    ).toBe(false);
    const planSchema = z.object(toolSchemas.update_edit_plan);
    expect(
      planSchema.safeParse({
        lessonPath: "courses/a/b/c",
        acceptReasons: ["silence"],
      }).success,
    ).toBe(true);
    expect(
      planSchema.safeParse({
        lessonPath: "courses/a/b/c",
        acceptReasons: ["noise"],
      }).success,
    ).toBe(false);
    expect(
      z
        .object(toolSchemas.render_lesson)
        .parse({ lessonPath: "courses/a/b/c" }),
    ).toEqual({ lessonPath: "courses/a/b/c", wait: true, timeoutSec: 1800 });
  });
});
