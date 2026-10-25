#!/usr/bin/env bun
// Course Recording Studio CLI — shell/CI automation on top of the app's HTTP
// API. The app must be running (`npm run dev`); COURSE_STUDIO_URL overrides
// the default http://localhost:4000.
//   npm run studio -- process --course "C#" --module "Basics" --lesson "Intro" --file D:\rec.mp4 --render
import fs from "fs";
import type { EditPlan, JobState, Marker } from "../../config/course";
import { lessonPath as toLessonPath, marker } from "../../config/course";
import type { LessonPatch } from "../server/course-api";
import {
  describeEditPlan,
  formatMs,
  summarizeEditPlan,
} from "../../mcp/edit-plan-tools";
import { StudioClient, matchByTitle } from "../../mcp/studio-client";
import { formatTimedLines, replaceInCaptions } from "../../mcp/transcript";
import { processLesson } from "../../mcp/workflow";
import type { ParsedArgs } from "./args";
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
} from "./args";

export const HELP = `Course Recording Studio CLI

Usage: npm run studio -- <command> [options]      (or: bun scripts/cli/index.ts <command>)

Lessons are addressed with --lesson-path courses/<course>/<module>/<lesson>, or with
--course, --module and --lesson (ids or titles; "process", "import" and "ensure" create
what is missing, idempotently by slug).

Commands
  health                               Check that the app is running
  courses                              List courses
  tree [--course <id>]                 Course → module → lesson tree with lesson paths
  create-course --name <n> [--language vi|en] [--description <d>]
  create-module --course <id> --title <t>
  create-lesson --course <id> --module <id> --title <t>
  ensure --course <c> --module <m> --lesson <l>   Find or create, print the lesson path
  update-lesson <lesson> [--title] [--description] [--notes] [--status <S>]
                [--transcribe true|false] [--detect-silence true|false] [--remove-silence true|false]
                [--silence-preset conservative|balanced|aggressive] [--chapters-auto true|false]
                [--intro true|false] [--outro true|false] [--webcam true|false]
                [--auto-process true|false] [--auto-publish true|false]
  update-course --course <id> [--name] [--language vi|en] [--output-profile course-standard|course-hq]
                [--glossary "Term1,Term2"]
  import <lesson> --file <abs path> [--webcam-file <abs path>] [--markers markers.json] [--take-id <digits>]
  produce <lesson> [--retranscribe] [--no-wait] [--timeout <sec>]    Run post-production
  status <lesson>                      Latest job of the lesson
  cancel <lesson>                      Cancel the running job
  plan <lesson> [--raw]                Edit plan summary (indexed cuts)
  plan-update <lesson> [--accept 0,2] [--reject 1] [--accept-reason silence] [--reject-reason marker]
                [--layout screen-only|screen-webcam] [--no-intro | --intro-title <t> [--intro-subtitle <s>]]
                [--outro true|false] [--chapters chapters.json]
  transcript <lesson> [--timed]        Transcript text (or timed lines)
  fix-transcript <lesson> --replace "dot net=.NET" [--replace ...] [--whole-word]
  render <lesson> [--no-wait] [--timeout <sec>]
  published <lesson>                   Published files (absolute paths + URLs)
  process <lesson> [--file <abs path>] [--webcam-file <p>] [--markers <json>] [--no-transcribe]
                [--accept-silence] [--render | --no-render] [--timeout <sec>]    The whole pipeline in one go
                (renders when --render is given or the lesson's autoPublish is on)

Automation
  pipeline <lesson>                    Current job and what runs next (autoProcess / autoPublish)
  automation [--enable | --disable] [--inbox <abs folder> | --inbox-default]
                                       Show or change the inbox ("drop to publish") settings
  inbox [--limit <n>]                  Inbox watcher state and recent automation events
  process-pending [--course <id>] [--lesson-path <p> ...] [--dry-run]
                                       Post-production for RECORDED lessons, render for REVIEW
                                       lessons with autoPublish on

Global options
  --json            Machine-readable JSON on stdout (progress goes to stderr)
  --url <url>       App URL (default: $COURSE_STUDIO_URL or http://localhost:4000)

Exit codes: 0 ok, 1 error, 2 usage error, 3 job failed / cancelled / timed out.`;

type Output = {
  json: boolean;
  out: (text: string) => void;
  err: (text: string) => void;
};

class JobFailedError extends Error {}

const readJsonFile = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    throw new UsageError(
      `Could not read JSON from ${file}: ${(e as Error).message}`,
    );
  }
};

const readMarkers = (args: ParsedArgs): Marker[] | undefined => {
  const file = getString(args, "markers");
  return file ? marker.array().parse(readJsonFile(file)) : undefined;
};

const hasLessonTitles = (args: ParsedArgs) =>
  getString(args, "course") !== undefined &&
  getString(args, "module") !== undefined &&
  getString(args, "lesson") !== undefined;

// <lesson> = positional path, --lesson-path, or --course/--module/--lesson.
const resolveLessonPath = async (
  client: StudioClient,
  args: ParsedArgs,
  create: boolean,
): Promise<string> => {
  const explicit = getString(args, "lesson-path") ?? args.positionals[0];
  if (explicit) {
    return explicit.replace(/\\/g, "/").replace(/^public\//, "");
  }
  if (!hasLessonTitles(args)) {
    throw new UsageError(
      "Pass a lesson path or --course, --module and --lesson",
    );
  }
  const course = requireString(args, "course");
  const module = requireString(args, "module");
  const lesson = requireString(args, "lesson");
  if (create) {
    const language = getString(args, "language") as "vi" | "en" | undefined;
    return (await client.ensureLesson({ course, module, lesson, language }))
      .lessonPath;
  }
  const tree = await client.getCourseTree();
  const c = matchByTitle(
    tree,
    course,
    (x) => x.course.id,
    (x) => x.course.name,
  );
  const m =
    c &&
    matchByTitle(
      c.modules,
      module,
      (x) => x.module.id,
      (x) => x.module.title,
    );
  const l =
    m &&
    matchByTitle(
      m.lessons,
      lesson,
      (x) => x.id,
      (x) => x.title,
    );
  if (!l) {
    throw new UsageError(`No lesson "${lesson}" in "${course}" / "${module}"`);
  }
  return toLessonPath(l);
};

const jobLine = (job: JobState) =>
  `${job.kind} ${job.status} ${Math.round(job.progress * 100)}% — ${job.step}`;

const waitAndReport = async (
  client: StudioClient,
  lessonPath: string,
  job: JobState,
  args: ParsedArgs,
  o: Output,
) => {
  if (getBool(args, "wait") === false) {
    return { job, timedOut: false };
  }
  const result = await client.waitForJob(lessonPath, job.id, {
    timeoutSec: getNumber(args, "timeout"),
    onProgress: (j) => o.err(jobLine(j)),
  });
  if (result.timedOut) {
    throw new JobFailedError(
      `Stopped waiting after ${getNumber(args, "timeout")} s; the job keeps running (studio status ${lessonPath})`,
    );
  }
  if (result.job && result.job.status !== "COMPLETED") {
    throw new JobFailedError(
      `${result.job.kind} ${result.job.status}${result.job.error ? `: ${result.job.error}` : ""}`,
    );
  }
  return result;
};

const lessonPatchFromArgs = (args: ParsedArgs): LessonPatch => {
  const patch: LessonPatch = {};
  const title = getString(args, "title");
  const description = getString(args, "description");
  const notes = getString(args, "notes");
  const status = getString(args, "status");
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (notes !== undefined) patch.notes = notes;
  if (status !== undefined) patch.status = status as LessonPatch["status"];
  const objectives = getList(args, "objective");
  if (objectives.length > 0) patch.objectives = objectives;
  const pp: NonNullable<LessonPatch["postProduction"]> = {};
  const map = {
    transcribe: "autoTranscribe",
    "detect-silence": "autoDetectSilence",
    "remove-silence": "autoRemoveSilence",
    "chapters-auto": "generateChapters",
    intro: "intro",
    outro: "outro",
    "auto-process": "autoProcess",
    "auto-publish": "autoPublish",
  } as const;
  for (const [flag, field] of Object.entries(map)) {
    const value = getBool(args, flag);
    if (value !== undefined) pp[field] = value;
  }
  const preset = getString(args, "silence-preset");
  if (preset !== undefined)
    pp.silencePreset = preset as typeof pp.silencePreset;
  if (Object.keys(pp).length > 0) patch.postProduction = pp;
  const webcam = getBool(args, "webcam");
  if (webcam !== undefined) patch.recordingProfile = { webcam };
  return patch;
};

const printPlan = (plan: EditPlan, o: Output) => {
  const s = summarizeEditPlan(plan);
  o.out(describeEditPlan(s));
  for (const c of s.cuts) {
    o.out(
      `  #${c.index} ${c.accepted ? "CUT       " : "suggested "} ${c.reason.padEnd(7)} ${c.range} (${formatMs(c.durationMs)})`,
    );
  }
  for (const ch of s.chapters) {
    o.out(`  chapter ${formatMs(ch.timeMs)} ${ch.title}`);
  }
};

export const runCommand = async (
  args: ParsedArgs,
  client: StudioClient,
  o: Output,
): Promise<unknown> => {
  const print = (data: unknown, human: () => void) => {
    if (o.json) {
      o.out(JSON.stringify(data, null, 2));
    } else {
      human();
    }
    return data;
  };
  const lesson = (create = false) => resolveLessonPath(client, args, create);

  switch (args.command) {
    case "health": {
      const h = await client.health();
      return print(h, () =>
        o.out(`OK — ${h.app} ${h.version} on port ${h.port} (${h.publicDir})`),
      );
    }
    case "courses": {
      const list = await client.listCourses();
      return print(list, () =>
        list.forEach((c) =>
          o.out(
            `${c.id}  ${c.name}  [${c.language}] ${c.modules} modules, ${c.lessons} lessons`,
          ),
        ),
      );
    }
    case "tree": {
      const only = getString(args, "course");
      const tree = (await client.getCourseTree()).filter(
        (c) => !only || c.course.id === only,
      );
      return print(tree, () => {
        for (const { course, modules } of tree) {
          o.out(`${course.name} (${course.id})`);
          for (const { module, lessons } of modules) {
            o.out(`  ${module.title} (${module.id})`);
            for (const l of lessons) {
              o.out(
                `    ${l.status.padEnd(15)} ${toLessonPath(l)}  ${l.title}`,
              );
            }
          }
        }
      });
    }
    case "create-course": {
      const c = await client.createCourse({
        name: requireString(args, "name"),
        description: getString(args, "description"),
        language: getString(args, "language") as "vi" | "en" | undefined,
      });
      return print(c, () => o.out(`Created course ${c.id}`));
    }
    case "create-module": {
      const m = await client.createModule(
        requireString(args, "course"),
        requireString(args, "title"),
      );
      return print(m, () => o.out(`Created module ${m.courseId}/${m.id}`));
    }
    case "create-lesson": {
      const l = await client.createLesson(
        requireString(args, "course"),
        requireString(args, "module"),
        requireString(args, "title"),
      );
      return print({ lessonPath: toLessonPath(l), lesson: l }, () =>
        o.out(toLessonPath(l)),
      );
    }
    case "ensure": {
      const ref = await client.ensureLesson({
        course: requireString(args, "course"),
        module: requireString(args, "module"),
        lesson: requireString(args, "lesson"),
        language: getString(args, "language") as "vi" | "en" | undefined,
      });
      return print(ref, () => o.out(ref.lessonPath));
    }
    case "update-lesson": {
      const path = await lesson();
      const patch = lessonPatchFromArgs(args);
      if (Object.keys(patch).length === 0) {
        throw new UsageError("Nothing to update");
      }
      const l = await client.updateLesson(path, patch);
      return print(l, () => o.out(`Updated ${path}`));
    }
    case "update-course": {
      const courseId = requireString(args, "course");
      const name = getString(args, "name");
      const language = getString(args, "language");
      const profile = getString(args, "output-profile");
      const glossary = getList(args, "glossary");
      const c = await client.updateCourse(courseId, {
        ...(name !== undefined ? { name } : {}),
        ...(language !== undefined
          ? { language: language as "vi" | "en" }
          : {}),
        ...(profile !== undefined
          ? { outputProfile: profile as "course-standard" | "course-hq" }
          : {}),
        ...(glossary.length > 0
          ? { glossary: glossary.map((term) => ({ term, aliases: [] })) }
          : {}),
      });
      return print(c, () => o.out(`Updated course ${c.id}`));
    }
    case "import": {
      const path = await lesson(true);
      const r = await client.importRecording({
        lessonPath: path,
        displayPath: requireString(args, "file"),
        webcamPath: getString(args, "webcam-file"),
        markers: readMarkers(args),
        takeId: getString(args, "take-id"),
      });
      return print(r, () =>
        o.out(
          `Imported take ${r.take.takeId} (${formatMs(r.take.durationMs ?? 0)}) into ${path}`,
        ),
      );
    }
    case "produce": {
      const path = await lesson();
      const started = await client.startPostProduction(
        path,
        getBool(args, "retranscribe") ?? false,
      );
      const { job } = await waitAndReport(client, path, started, args, o);
      const plan =
        job?.status === "COMPLETED" ? await client.getEditPlan(path) : null;
      return print(
        { job, editPlan: plan ? summarizeEditPlan(plan) : null },
        () => {
          o.out(job ? jobLine(job) : "No job");
          if (plan) printPlan(plan, o);
        },
      );
    }
    case "status": {
      const job = await client.getJobStatus(await lesson());
      return print(job, () => o.out(job ? jobLine(job) : "No job yet"));
    }
    case "cancel": {
      const r = await client.cancelJob(await lesson());
      return print(r, () =>
        o.out(r.cancelled ? "Cancelled" : "Nothing to cancel"),
      );
    }
    case "plan": {
      const plan = await client.getEditPlan(await lesson());
      return print(
        getBool(args, "raw") ? plan : { summary: summarizeEditPlan(plan) },
        () => printPlan(plan, o),
      );
    }
    case "plan-update": {
      const path = await lesson();
      const introTitle = getString(args, "intro-title");
      const intro =
        getBool(args, "intro") === false
          ? null
          : introTitle !== undefined
            ? {
                title: introTitle,
                subtitle: getString(args, "intro-subtitle") ?? null,
              }
            : undefined;
      const chaptersFile = getString(args, "chapters");
      const plan = await client.updateEditPlan(path, {
        acceptCuts: getIndices(args, "accept"),
        rejectCuts: getIndices(args, "reject"),
        acceptReasons: getList(
          args,
          "accept-reason",
        ) as EditPlan["cuts"][number]["reason"][],
        rejectReasons: getList(
          args,
          "reject-reason",
        ) as EditPlan["cuts"][number]["reason"][],
        layout: getString(args, "layout") as EditPlan["layout"] | undefined,
        intro,
        outro: getBool(args, "outro"),
        chapters: chaptersFile
          ? (readJsonFile(chaptersFile) as EditPlan["chapters"])
          : undefined,
      });
      return print({ summary: summarizeEditPlan(plan) }, () =>
        printPlan(plan, o),
      );
    }
    case "transcript": {
      const t = await client.getTranscript(await lesson());
      return print(t, () =>
        o.out(getBool(args, "timed") ? formatTimedLines(t.lines) : t.text),
      );
    }
    case "fix-transcript": {
      const path = await lesson();
      const raw = args.flags.replace;
      const values =
        raw === undefined || typeof raw === "boolean"
          ? []
          : Array.isArray(raw)
            ? raw
            : [raw];
      if (values.length === 0) {
        throw new UsageError('Pass at least one --replace "find=replace"');
      }
      const wholeWord = getBool(args, "whole-word") ?? false;
      const { captions, replaced } = replaceInCaptions(
        await client.getCaptions(path),
        values.map((v) => ({ ...parseReplacement(v), wholeWord })),
      );
      await client.saveCaptions(path, captions);
      return print({ replaced }, () =>
        o.out(`Replaced ${replaced} occurrence(s)`),
      );
    }
    case "render": {
      const path = await lesson();
      const started = await client.startRender(path);
      const { job } = await waitAndReport(client, path, started, args, o);
      const published =
        job?.status === "COMPLETED"
          ? await client.getPublishedFiles(path)
          : null;
      return print({ job, published }, () => {
        o.out(job ? jobLine(job) : "No job");
        published?.files.forEach((f) => o.out(`  ${f.path}`));
      });
    }
    case "published": {
      const p = await client.getPublishedFiles(await lesson());
      return print(p, () => {
        if (p.files.length === 0) o.out("Nothing published yet");
        p.files.forEach((f) => o.out(`${f.path}  ${f.url}`));
      });
    }
    case "process": {
      const explicit = getString(args, "lesson-path") ?? args.positionals[0];
      const transcribe = getBool(args, "transcribe");
      const result = await processLesson(
        client,
        {
          lessonPath: explicit,
          course: getString(args, "course"),
          module: getString(args, "module"),
          lesson: getString(args, "lesson"),
          language: getString(args, "language") as "vi" | "en" | undefined,
          displayPath: getString(args, "file"),
          webcamPath: getString(args, "webcam-file"),
          markers: readMarkers(args),
          takeId: getString(args, "take-id"),
          postProduction:
            transcribe !== undefined
              ? { autoTranscribe: transcribe }
              : undefined,
          retranscribe: getBool(args, "retranscribe"),
          acceptSuggestions: getBool(args, "accept-silence")
            ? ["silence"]
            : undefined,
          // Default: the lesson's postProduction.autoPublish.
          render: getBool(args, "render"),
          timeoutSec: getNumber(args, "timeout"),
        },
        {
          onStage: (stage, message) => o.err(`[${stage}] ${message}`),
          onJob: (_stage, job) => o.err(jobLine(job)),
        },
      );
      print(result, () => {
        o.out(
          `Lesson: ${result.lessonPath}${result.created.length ? ` (created ${result.created.join(", ")})` : ""}`,
        );
        if (result.imported) o.out(`Imported take ${result.imported.takeId}`);
        if (result.editPlan) o.out(describeEditPlan(result.editPlan));
        result.published?.files.forEach((f) => o.out(`  ${f.path}`));
      });
      if (!result.ok) {
        throw new JobFailedError(
          result.timedOut
            ? `Timed out during ${result.stage}; the job keeps running`
            : `Failed during ${result.stage}: ${result.error}`,
        );
      }
      return result;
    }
    case "pipeline": {
      const p = await client.getPipelineStatus(await lesson());
      return print(p, () => {
        o.out(`${p.lessonPath}  ${p.lessonStatus}`);
        o.out(
          `  autoProcess ${p.autoProcess ? "on" : "off"}, autoPublish ${p.autoPublish ? "on" : "off"}`,
        );
        if (p.job) o.out(`  ${jobLine(p.job)}`);
        o.out(
          `  next: ${p.next ?? "nothing"}${p.next ? (p.nextIsAutomatic ? " (automatic)" : " (needs an action)") : ""}`,
        );
        o.out(`  ${p.message}`);
      });
    }
    case "automation": {
      const enable = getBool(args, "enable");
      const disable = getBool(args, "disable");
      const inbox = getString(args, "inbox");
      const reset = getBool(args, "inbox-default") ?? false;
      if (enable && disable) {
        throw new UsageError("Pass --enable or --disable, not both");
      }
      const patch = {
        ...(enable ? { enabled: true } : {}),
        ...(disable ? { enabled: false } : {}),
        ...(inbox !== undefined ? { inboxDir: inbox } : {}),
        ...(reset ? { inboxDir: null } : {}),
      };
      const s =
        Object.keys(patch).length > 0
          ? await client.updateAutomationSettings(patch)
          : await client.getAutomationSettings();
      return print(s, () => {
        o.out(
          `Inbox ${s.enabled ? "ON" : "off"}: ${s.inboxDir} (${s.inboxDirSource})`,
        );
        o.out(
          `  watcher ${s.watcher.watching ? "running" : "stopped"}; drop files at <inbox>/<Course>/<Module>/<Lesson>.mp4`,
        );
      });
    }
    case "inbox": {
      const a = await client.getInboxActivity();
      const limit = getNumber(args, "limit") ?? 20;
      const events = a.events.slice(0, limit);
      return print({ ...a, events }, () => {
        o.out(
          `Inbox ${a.settings.enabled ? "ON" : "off"}: ${a.settings.inboxDir} (watcher ${a.watcher.watching ? "running" : "stopped"})`,
        );
        a.watcher.pending.forEach((p) =>
          o.out(
            `  waiting ${p.file} (${p.sizeBytes} bytes, unchanged ${Math.round(p.stableForMs / 1000)} s)`,
          ),
        );
        events.forEach((e) =>
          o.out(
            `${e.at}  ${e.level.padEnd(5)} ${e.type.padEnd(15)} ${e.message}`,
          ),
        );
      });
    }
    case "process-pending": {
      const lessonPaths = getList(args, "lesson-path");
      const r = await client.processPending({
        courseId: getString(args, "course"),
        lessonPaths: lessonPaths.length > 0 ? lessonPaths : undefined,
        dryRun: getBool(args, "dry-run") ?? false,
      });
      return print(r, () => {
        const verb = r.dryRun ? "would queue" : "queued";
        r.production.forEach((x) =>
          o.out(`post-production ${verb}: ${x.lessonPath}`),
        );
        r.render.forEach((x) => o.out(`render ${verb}: ${x.lessonPath}`));
        r.skipped.forEach((x) => o.out(`skipped ${x.lessonPath}: ${x.reason}`));
        if (r.production.length + r.render.length === 0) {
          o.out("Nothing to process");
        }
      });
    }
    default:
      throw new UsageError(
        args.command ? `Unknown command "${args.command}"` : "No command given",
      );
  }
};

export const main = async (argv: string[]): Promise<number> => {
  const args = parseArgs(argv);
  const o: Output = {
    json: getBool(args, "json") ?? false,
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
  };
  if (!args.command || args.command === "help" || args.flags.help) {
    o.out(HELP);
    return args.command || args.flags.help ? 0 : 2;
  }
  const url = getString(args, "url");
  const client = new StudioClient(url);
  try {
    await runCommand(args, client, o);
    return 0;
  } catch (e) {
    const message = (e as Error).message;
    if (o.json) {
      o.out(JSON.stringify({ error: message }));
    }
    o.err(`Error: ${message}`);
    if (e instanceof UsageError) {
      o.err('Run "npm run studio -- help" for usage.');
      return 2;
    }
    return e instanceof JobFailedError ? 3 : 1;
  }
};

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
