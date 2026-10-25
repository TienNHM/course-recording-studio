// MCP server for Course Recording Studio. Every tool calls the running app
// over HTTP (see studio-client.ts), so the app must be running (`npm run dev`).
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { JobState } from "../config/course";
import {
  courseLanguage,
  cutReason,
  editPlan,
  glossaryTerm,
  lessonStatus,
  marker,
  outputProfile,
  silencePreset,
  lessonPath as toLessonPath,
} from "../config/course";
import { describeEditPlan, summarizeEditPlan } from "./edit-plan-tools";
import { StudioClient } from "./studio-client";
import {
  buildTranscript,
  editCaptionTexts,
  formatTimedLines,
  replaceInCaptions,
} from "./transcript";
import { processLesson } from "./workflow";

export const SERVER_NAME = "course-studio";
export const SERVER_VERSION = "1.0.0";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ---- Input schemas (exported for tests) ------------------------------------

const lessonPathArg = z
  .string()
  .regex(
    /^courses\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/,
    "lessonPath looks like courses/<course>/<module>/<lesson>",
  )
  .describe(
    "Lesson path as returned by get_course_tree, e.g. courses/net-basics/module-1/intro",
  );

const waitArgs = {
  wait: z
    .boolean()
    .default(true)
    .describe(
      "Wait until the job is COMPLETED/FAILED/CANCELLED (progress is reported)",
    ),
  timeoutSec: z
    .number()
    .positive()
    .max(6 * 3600)
    .default(1800)
    .describe("Stop waiting after this many seconds (the job keeps running)"),
};

const postProductionPatch = z
  .object({
    autoTranscribe: z.boolean(),
    autoDetectSilence: z.boolean(),
    autoRemoveSilence: z.boolean(),
    silencePreset,
    generateChapters: z.boolean(),
    intro: z.boolean(),
    outro: z.boolean(),
  })
  .partial();

export const toolSchemas = {
  list_courses: {},
  get_course_tree: {
    courseId: z.string().optional().describe("Only this course (id)"),
  },
  create_course: {
    name: z.string().trim().min(1),
    description: z.string().optional(),
    language: courseLanguage
      .optional()
      .describe("Spoken language: vi (default) or en"),
  },
  create_module: {
    courseId: z.string().describe("Course id (slug)"),
    title: z.string().trim().min(1),
  },
  create_lesson: {
    courseId: z.string(),
    moduleId: z.string(),
    title: z.string().trim().min(1),
    description: z.string().optional(),
    objectives: z.array(z.string()).optional(),
    notes: z.string().optional(),
    webcam: z.boolean().optional().describe("The lesson records a webcam"),
    postProduction: postProductionPatch.optional(),
  },
  update_lesson: {
    lessonPath: lessonPathArg,
    title: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    objectives: z.array(z.string()).optional(),
    notes: z.string().optional(),
    status: lessonStatus.optional(),
    recordingProfile: z
      .object({ webcam: z.boolean(), microphone: z.boolean() })
      .partial()
      .optional(),
    postProduction: postProductionPatch.optional(),
  },
  update_course: {
    courseId: z.string(),
    name: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    language: courseLanguage.optional(),
    outputProfile: outputProfile
      .optional()
      .describe("course-standard (1080p30) or course-hq (1080p60)"),
    glossary: z
      .array(glossaryTerm)
      .optional()
      .describe(
        "Replaces the glossary: terms the transcription should spell correctly",
      ),
  },
  import_recording: {
    lessonPath: lessonPathArg,
    displayPath: z
      .string()
      .describe(
        "Absolute path of the screen recording (.mp4/.webm/.mov/.mkv) on this computer",
      ),
    webcamPath: z
      .string()
      .optional()
      .describe("Absolute path of a separate webcam recording"),
    markers: z
      .array(marker)
      .optional()
      .describe(
        "Markers in ms from the start of the recording: cut | important | chapter (with title)",
      ),
    takeId: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .describe("Take id (digits, default: now in ms)"),
  },
  start_post_production: {
    lessonPath: lessonPathArg,
    retranscribe: z
      .boolean()
      .optional()
      .describe("Transcribe again even if captions exist"),
    ...waitArgs,
  },
  get_job_status: { lessonPath: lessonPathArg },
  cancel_job: { lessonPath: lessonPathArg },
  get_edit_plan: {
    lessonPath: lessonPathArg,
    includeRaw: z
      .boolean()
      .default(false)
      .describe("Also return the raw edit-plan.json"),
  },
  update_edit_plan: {
    lessonPath: lessonPathArg,
    acceptCuts: z
      .array(z.number().int().nonnegative())
      .optional()
      .describe("Cut indices to accept (remove from the video)"),
    rejectCuts: z
      .array(z.number().int().nonnegative())
      .optional()
      .describe("Cut indices to reject (keep in the video)"),
    acceptReasons: z
      .array(cutReason)
      .optional()
      .describe('Accept every cut with these reasons, e.g. ["silence"]'),
    rejectReasons: z.array(cutReason).optional(),
    chapters: editPlan.shape.chapters
      .optional()
      .describe(
        "Replaces all chapters; timeMs is on the ORIGINAL recording timeline",
      ),
    layout: editPlan.shape.layout.optional(),
    intro: editPlan.shape.intro
      .optional()
      .describe("{title, subtitle} or null for no intro"),
    outro: z.boolean().optional(),
  },
  get_transcript: {
    lessonPath: lessonPathArg,
    includeCaptions: z
      .boolean()
      .default(false)
      .describe("Also return the word-level captions with indices"),
  },
  update_transcript_text: {
    lessonPath: lessonPathArg,
    replacements: z
      .array(
        z.object({
          find: z.string().min(1),
          replace: z.string(),
          caseSensitive: z.boolean().optional(),
          wholeWord: z.boolean().optional(),
        }),
      )
      .optional()
      .describe(
        "Phrase replacements over the whole transcript (may span words)",
      ),
    edits: z
      .array(
        z.object({ index: z.number().int().nonnegative(), text: z.string() }),
      )
      .optional()
      .describe(
        "Set the text of single captions by index (see get_transcript includeCaptions)",
      ),
  },
  render_lesson: { lessonPath: lessonPathArg, ...waitArgs },
  get_published_files: { lessonPath: lessonPathArg },
  process_lesson_end_to_end: {
    lessonPath: lessonPathArg
      .optional()
      .describe("Existing lesson; or pass course + module + lesson"),
    course: z
      .string()
      .optional()
      .describe("Course id or title (created if missing)"),
    module: z
      .string()
      .optional()
      .describe("Module id or title (created if missing)"),
    lesson: z
      .string()
      .optional()
      .describe("Lesson id or title (created if missing)"),
    language: courseLanguage
      .optional()
      .describe("Language of a newly created course"),
    displayPath: z
      .string()
      .optional()
      .describe("Absolute path of a recording to import first"),
    webcamPath: z.string().optional(),
    markers: z.array(marker).optional(),
    postProduction: postProductionPatch
      .optional()
      .describe("Lesson post-production settings to set first"),
    retranscribe: z.boolean().optional(),
    acceptSilence: z
      .boolean()
      .default(false)
      .describe("Accept all silence suggestions before rendering"),
    render: z.boolean().default(true),
    timeoutSec: z
      .number()
      .positive()
      .max(6 * 3600)
      .default(3600),
  },
} as const;

// ---- Helpers ----------------------------------------------------------------

const text = (value: unknown, isError = false): CallToolResult => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
  ...(isError ? { isError: true } : {}),
});

const safe =
  <A>(fn: (args: A, extra: Extra) => Promise<CallToolResult>) =>
  async (args: A, extra: Extra): Promise<CallToolResult> => {
    try {
      return await fn(args, extra);
    } catch (e) {
      return text(`Error: ${(e as Error).message}`, true);
    }
  };

// Sends MCP progress notifications when the client asked for them
// (progress must only increase).
export const makeProgressReporter = (extra: Extra) => {
  const token = extra._meta?.progressToken;
  let last = -1;
  return async (progress: number, message: string) => {
    if (token === undefined) {
      return;
    }
    const value = Math.max(0, Math.min(100, Math.round(progress * 10) / 10));
    if (value <= last) {
      return;
    }
    last = value;
    await extra
      .sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress: value, total: 100, message },
      })
      .catch(() => undefined);
  };
};

const jobMessage = (job: JobState) =>
  `${job.kind} ${job.status}: ${job.step} (${Math.round(job.progress * 100)}%)`;

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export const INSTRUCTIONS = `Course Recording Studio turns screen recordings into published course lessons.
Hierarchy: course → module → lesson. A lesson is addressed by lessonPath "courses/<course>/<module>/<lesson>".
Typical flow: create (or find) the lesson → import_recording (or record in the app UI) → start_post_production (transcribe, detect silence, build the edit plan) → review with get_edit_plan / get_transcript → update_edit_plan / update_transcript_text → render_lesson → get_published_files.
process_lesson_end_to_end does all of it in one call.
Lesson status: DRAFT → READY_TO_RECORD → RECORDED → PROCESSING → REVIEW → PUBLISHED.
Edit plan: "accepted" cuts are removed from the video; non-accepted cuts are only suggestions. Chapter and cut times are on the ORIGINAL recording timeline.
Recordings are never overwritten or deleted by these tools; source files are only read.`;

// ---- Server -----------------------------------------------------------------

export const createStudioMcpServer = (
  client: StudioClient = new StudioClient(),
) => {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: "Course Recording Studio",
    },
    { instructions: INSTRUCTIONS },
  );

  const waitJob = async (
    lessonPath: string,
    job: JobState,
    args: { wait: boolean; timeoutSec: number },
    extra: Extra,
  ) => {
    if (!args.wait) {
      return { job, timedOut: false };
    }
    const report = makeProgressReporter(extra);
    return client.waitForJob(lessonPath, job.id, {
      timeoutSec: args.timeoutSec,
      signal: extra.signal,
      onProgress: (j) => report(j.progress * 100, jobMessage(j)),
    });
  };

  // ---- Courses ----

  server.registerTool(
    "list_courses",
    {
      title: "List courses (Danh sách khóa học)",
      description: "Lists all courses with their module and lesson counts.",
      inputSchema: toolSchemas.list_courses,
      annotations: READ_ONLY,
    },
    safe(async () => text(await client.listCourses())),
  );

  server.registerTool(
    "get_course_tree",
    {
      title: "Course tree (Cây khóa học)",
      description:
        "Returns courses → modules → lessons with every lesson's lessonPath, status, selected take and settings.",
      inputSchema: toolSchemas.get_course_tree,
      annotations: READ_ONLY,
    },
    safe(async ({ courseId }) => {
      const tree = await client.getCourseTree();
      const filtered = courseId
        ? tree.filter((c) => c.course.id === courseId)
        : tree;
      return text(
        filtered.map(({ course, modules }) => ({
          course,
          modules: modules.map(({ module, lessons }) => ({
            module,
            lessons: lessons.map((l) => ({
              lessonPath: toLessonPath(l),
              ...l,
            })),
          })),
        })),
      );
    }),
  );

  server.registerTool(
    "create_course",
    {
      title: "Create course (Tạo khóa học)",
      description:
        "Creates a course. The id is a slug of the name (a suffix is added if taken).",
      inputSchema: toolSchemas.create_course,
      annotations: WRITE,
    },
    safe(async (args) => text(await client.createCourse(args))),
  );

  server.registerTool(
    "create_module",
    {
      title: "Create module (Tạo chương)",
      description: "Creates a module in a course.",
      inputSchema: toolSchemas.create_module,
      annotations: WRITE,
    },
    safe(async ({ courseId, title }) =>
      text(await client.createModule(courseId, title)),
    ),
  );

  server.registerTool(
    "create_lesson",
    {
      title: "Create lesson (Tạo bài học)",
      description:
        "Creates a lesson (status READY_TO_RECORD). Returns the lesson and its lessonPath.",
      inputSchema: toolSchemas.create_lesson,
      annotations: WRITE,
    },
    safe(async ({ courseId, moduleId, title, webcam, ...fields }) => {
      const lesson = await client.createLesson(courseId, moduleId, title, {
        ...fields,
        ...(webcam !== undefined ? { recordingProfile: { webcam } } : {}),
      });
      return text({ lessonPath: toLessonPath(lesson), lesson });
    }),
  );

  server.registerTool(
    "update_lesson",
    {
      title: "Update lesson (Sửa bài học)",
      description:
        "Updates lesson fields: title, description, objectives, notes, status, recordingProfile, postProduction (partial).",
      inputSchema: toolSchemas.update_lesson,
      annotations: WRITE,
    },
    safe(async ({ lessonPath, ...patch }) =>
      text(await client.updateLesson(lessonPath, patch)),
    ),
  );

  server.registerTool(
    "update_course",
    {
      title: "Update course (Sửa khóa học)",
      description:
        "Updates course fields: name, description, language (vi|en), outputProfile, glossary (replaces the list).",
      inputSchema: toolSchemas.update_course,
      annotations: WRITE,
    },
    safe(async ({ courseId, ...patch }) =>
      text(await client.updateCourse(courseId, patch)),
    ),
  );

  // ---- Recording ----

  server.registerTool(
    "import_recording",
    {
      title: "Import recording (Nhập video có sẵn)",
      description:
        "Imports existing video files from this computer (OBS etc.) as a new take of the lesson and selects it (status RECORDED). " +
        ".mov/.mkv are converted to mp4. Source files are only read, never moved or deleted.",
      inputSchema: toolSchemas.import_recording,
      annotations: WRITE,
    },
    safe(async (args) => text(await client.importRecording(args))),
  );

  // ---- Jobs ----

  server.registerTool(
    "start_post_production",
    {
      title: "Start post-production (Hậu kỳ tự động)",
      description:
        "Runs automatic post-production on the selected take: silence detection, transcription (if enabled), markers → edit plan. " +
        "With wait=true it waits and returns the final job and an edit plan summary.",
      inputSchema: toolSchemas.start_post_production,
      annotations: WRITE,
    },
    safe(async ({ lessonPath, retranscribe, ...wait }, extra) => {
      const started = await client.startPostProduction(
        lessonPath,
        retranscribe ?? false,
      );
      const { job, timedOut } = await waitJob(lessonPath, started, wait, extra);
      const summary =
        job?.status === "COMPLETED"
          ? summarizeEditPlan(await client.getEditPlan(lessonPath))
          : null;
      return text(
        {
          job,
          timedOut,
          ...(summary
            ? { summary: describeEditPlan(summary), editPlan: summary }
            : {}),
        },
        job?.status === "FAILED",
      );
    }),
  );

  server.registerTool(
    "get_job_status",
    {
      title: "Job status (Trạng thái tác vụ)",
      description:
        "Returns the latest post-production or render job of the lesson (or null).",
      inputSchema: toolSchemas.get_job_status,
      annotations: READ_ONLY,
    },
    safe(async ({ lessonPath }) => text(await client.getJobStatus(lessonPath))),
  );

  server.registerTool(
    "cancel_job",
    {
      title: "Cancel job (Hủy tác vụ)",
      description: "Cancels the queued or running job of the lesson.",
      inputSchema: toolSchemas.cancel_job,
      annotations: WRITE,
    },
    safe(async ({ lessonPath }) => text(await client.cancelJob(lessonPath))),
  );

  // ---- Edit plan ----

  server.registerTool(
    "get_edit_plan",
    {
      title: "Edit plan (Kế hoạch dựng)",
      description:
        "Returns a summary of the edit plan: indexed cuts (accepted = removed, otherwise suggestion), kept duration, chapters, layout, intro/outro.",
      inputSchema: toolSchemas.get_edit_plan,
      annotations: READ_ONLY,
    },
    safe(async ({ lessonPath, includeRaw }) => {
      const { plan, summary } = await client.getEditPlanWithSummary(lessonPath);
      return text({
        description: describeEditPlan(summary),
        summary,
        ...(includeRaw ? { raw: plan } : {}),
      });
    }),
  );

  server.registerTool(
    "update_edit_plan",
    {
      title: "Update edit plan (Sửa kế hoạch dựng)",
      description:
        "Accepts/rejects cuts by index or by reason (silence|marker|trim), replaces chapters, sets layout, intro ({title, subtitle} or null) and outro. " +
        "Segments are recomputed by the app. Index decisions win over reason decisions.",
      inputSchema: toolSchemas.update_edit_plan,
      annotations: WRITE,
    },
    safe(async ({ lessonPath, ...update }) => {
      const plan = await client.updateEditPlan(lessonPath, update);
      const summary = summarizeEditPlan(plan);
      return text({ description: describeEditPlan(summary), summary });
    }),
  );

  // ---- Transcript ----

  server.registerTool(
    "get_transcript",
    {
      title: "Transcript (Bản ghi lời thoại)",
      description:
        "Returns the transcript of the selected take as plain text and timed lines (times on the original recording).",
      inputSchema: toolSchemas.get_transcript,
      annotations: READ_ONLY,
    },
    safe(async ({ lessonPath, includeCaptions }) => {
      const captions = await client.getCaptions(lessonPath);
      const transcript = buildTranscript(captions);
      return text({
        text: transcript.text,
        timed: formatTimedLines(transcript.lines),
        lines: transcript.lines,
        captionCount: transcript.captionCount,
        ...(includeCaptions
          ? { captions: captions.map((c, index) => ({ index, ...c })) }
          : {}),
      });
    }),
  );

  server.registerTool(
    "update_transcript_text",
    {
      title: "Fix transcript (Sửa lời thoại)",
      description:
        'Fixes transcript text without changing timing: phrase replacements (e.g. {find: "dot net", replace: ".NET"}) and/or per-caption edits by index. ' +
        "Re-render afterwards to update subtitles.",
      inputSchema: toolSchemas.update_transcript_text,
      annotations: WRITE,
    },
    safe(async ({ lessonPath, replacements, edits }) => {
      let captions = await client.getCaptions(lessonPath);
      let replaced = 0;
      if (edits && edits.length > 0) {
        captions = editCaptionTexts(captions, edits);
      }
      if (replacements && replacements.length > 0) {
        const r = replaceInCaptions(captions, replacements);
        captions = r.captions;
        replaced = r.replaced;
      }
      await client.saveCaptions(lessonPath, captions);
      const transcript = await client.getTranscript(lessonPath);
      return text({
        replaced,
        edited: edits?.length ?? 0,
        text: transcript.text,
      });
    }),
  );

  // ---- Render / publish ----

  server.registerTool(
    "render_lesson",
    {
      title: "Render lesson (Xuất video)",
      description:
        "Renders the lesson from its edit plan to published/ (lesson.mp4, .srt, .vtt, thumbnail.jpg, chapters.json, transcript.md). " +
        "With wait=true returns the published files.",
      inputSchema: toolSchemas.render_lesson,
      annotations: WRITE,
    },
    safe(async ({ lessonPath, ...wait }, extra) => {
      const started = await client.startRender(lessonPath);
      const { job, timedOut } = await waitJob(lessonPath, started, wait, extra);
      const published =
        job?.status === "COMPLETED"
          ? await client.getPublishedFiles(lessonPath)
          : null;
      return text({ job, timedOut, published }, job?.status === "FAILED");
    }),
  );

  server.registerTool(
    "get_published_files",
    {
      title: "Published files (Tệp đã xuất bản)",
      description:
        "Lists the published files of a lesson with absolute paths and URLs.",
      inputSchema: toolSchemas.get_published_files,
      annotations: READ_ONLY,
    },
    safe(async ({ lessonPath }) =>
      text(await client.getPublishedFiles(lessonPath)),
    ),
  );

  server.registerTool(
    "process_lesson_end_to_end",
    {
      title: "Produce lesson in one call (Sản xuất trọn gói)",
      description:
        "One-call automation: find or create course/module/lesson by title → optionally import a recording → post-production → " +
        "optionally accept all silence suggestions → render → return published file paths. Reports progress.",
      inputSchema: toolSchemas.process_lesson_end_to_end,
      annotations: WRITE,
    },
    safe(async ({ acceptSilence, ...args }, extra) => {
      const report = makeProgressReporter(extra);
      // Overall progress: production 0–45 %, render 50–100 %.
      const ranges = { production: [0, 45], render: [50, 100] } as const;
      const result = await processLesson(
        client,
        { ...args, acceptSuggestions: acceptSilence ? ["silence"] : undefined },
        {
          signal: extra.signal,
          onStage: (stage, message) =>
            report(
              stage === "render"
                ? 50
                : stage === "done"
                  ? 100
                  : stage === "edit-plan"
                    ? 46
                    : 0,
              message,
            ),
          onJob: (stage, job) => {
            const range =
              stage === "render" ? ranges.render : ranges.production;
            return report(
              range[0] + (range[1] - range[0]) * job.progress,
              jobMessage(job),
            );
          },
        },
      );
      return text(
        {
          ...result,
          ...(result.editPlan
            ? { editPlanDescription: describeEditPlan(result.editPlan) }
            : {}),
        },
        !result.ok && !result.timedOut,
      );
    }),
  );

  // ---- Resources ----

  server.registerResource(
    "course-tree",
    "courses://tree",
    {
      title: "Course tree",
      description: "All courses, modules and lessons",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.getCourseTree(), null, 2),
        },
      ],
    }),
  );

  const listLessons = async () => {
    const tree = await client.getCourseTree();
    return tree.flatMap(({ course, modules }) =>
      modules.flatMap(({ module, lessons }) =>
        lessons.map((l) => ({
          path: toLessonPath(l),
          name: `${course.name} / ${module.title} / ${l.title}`,
        })),
      ),
    );
  };

  const lessonPathOf = (variables: Record<string, string | string[]>) => {
    const value = variables.lessonPath;
    return decodeURIComponent(
      Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
    );
  };

  server.registerResource(
    "lesson",
    new ResourceTemplate("lesson://{+lessonPath}", {
      list: async () => ({
        resources: (await listLessons()).map((l) => ({
          uri: `lesson://${l.path}`,
          name: l.name,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "Lesson",
      description: "lesson.json of a lesson plus its course and module",
      mimeType: "application/json",
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.getLesson(lessonPathOf(variables)),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "transcript",
    new ResourceTemplate("transcript://{+lessonPath}", { list: undefined }),
    {
      title: "Transcript",
      description: "Timed transcript of the selected take of a lesson",
      mimeType: "text/plain",
    },
    async (uri, variables) => {
      const transcript = await client.getTranscript(lessonPathOf(variables));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: formatTimedLines(transcript.lines),
          },
        ],
      };
    },
  );

  server.registerResource(
    "edit-plan",
    new ResourceTemplate("edit-plan://{+lessonPath}", { list: undefined }),
    {
      title: "Edit plan",
      description: "production/edit-plan.json of a lesson",
      mimeType: "application/json",
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.getEditPlan(lessonPathOf(variables)),
            null,
            2,
          ),
        },
      ],
    }),
  );

  // ---- Prompts ----

  server.registerPrompt(
    "produce-lesson",
    {
      title: "Produce a lesson (Sản xuất bài học)",
      description:
        "Guided workflow from a recording file to a published lesson",
      argsSchema: {
        course: z.string().optional().describe("Course id or title"),
        module: z.string().optional().describe("Module id or title"),
        lesson: z.string().optional().describe("Lesson id or title"),
        file: z
          .string()
          .optional()
          .describe("Absolute path of the screen recording"),
      },
    },
    ({ course, module, lesson, file }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Produce a course lesson with the course-studio tools.
Course: ${course ?? "(ask me or pick from list_courses)"}
Module: ${module ?? "(ask me)"}
Lesson: ${lesson ?? "(ask me)"}
Recording: ${file ?? "(ask me for the absolute path, or use the lesson's existing take)"}

Steps:
1. get_course_tree to find existing course/module/lesson (reuse them; create only what is missing).
2. If a recording file is given, import_recording with it (never delete or move the source).
3. start_post_production with wait=true.
4. get_edit_plan and get_transcript. Report: original vs kept duration, suggested cuts, chapters, obvious transcript errors (product names, code terms).
5. Propose changes (accept silence suggestions? chapter titles? transcript fixes via update_transcript_text?) and apply them after I agree.
6. render_lesson with wait=true and give me the published file paths.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "review-edit-plan",
    {
      title: "Review edit plan (Duyệt kế hoạch dựng)",
      description:
        "Review the automatic edit plan of a lesson before rendering",
      argsSchema: {
        lessonPath: z.string().describe("courses/<course>/<module>/<lesson>"),
      },
    },
    ({ lessonPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review the edit plan of ${lessonPath}.
1. Call get_edit_plan and get_transcript for it.
2. For each suggested (not accepted) cut, read the transcript around its time range and recommend accept (remove) or reject (keep). Silence cuts in the middle of a sentence or right before a demo usually stay; long pauses, "um", restarts and false starts go.
3. Check chapters: titles should be short and descriptive, times are on the original recording timeline, the first chapter should be near 0.
4. Check intro title/subtitle and layout (screen-webcam only if there is a webcam).
5. Present a short table of recommendations, then apply them with update_edit_plan after I confirm. Do not render unless I ask.`,
          },
        },
      ],
    }),
  );

  return server;
};
