# Automation: MCP server, CLI and HTTP API

Course Recording Studio can be driven by AI agents (via MCP) and by scripts or
CI (via the CLI or plain HTTP). All three go through the **running app**:

```console
npm run dev            # starts the app on http://localhost:4000 (+ Remotion Studio)
```

Agents and scripts reach it at `COURSE_STUDIO_URL` (default
`http://localhost:4000`). If the app is not running, every tool and command
fails with a message telling you to start it.

Lessons are addressed by **lesson path**: `courses/<course>/<module>/<lesson>`
(the folder under `public/`). Get them from `get_course_tree` / `studio tree`.

## 1. MCP server

Entry point: `mcp/index.ts` (stdio transport, official
`@modelcontextprotocol/sdk`). Run it with Bun from anywhere:

```console
bun D:/repos/course-recording-studio/mcp/index.ts
```

> Do not register it as `npm run …`: npm prints a banner on stdout, which
> breaks the stdio protocol.

### Claude Code

This repository ships a project-scoped [`.mcp.json`](../.mcp.json), so Claude
Code started in this folder offers the `course-studio` server automatically
(you approve it once). To add it yourself instead:

```console
# only for you, in this project (default scope "local")
claude mcp add course-studio -- bun D:/repos/course-recording-studio/mcp/index.ts

# for all your projects
claude mcp add --scope user course-studio -- bun D:/repos/course-recording-studio/mcp/index.ts

# app on another port
claude mcp add course-studio -e COURSE_STUDIO_URL=http://localhost:4126 -- bun D:/repos/course-recording-studio/mcp/index.ts
```

Check with `claude mcp list` or `/mcp` inside Claude Code. The skill in
`.claude/skills/course-studio/SKILL.md` teaches the agent the workflow.

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) or
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "course-studio": {
      "command": "bun",
      "args": ["D:/repos/course-recording-studio/mcp/index.ts"],
      "env": { "COURSE_STUDIO_URL": "http://localhost:4000" }
    }
  }
}
```

If Claude Desktop cannot find `bun`, use its absolute path
(`where bun` → e.g. `C:\\Users\\<you>\\.bun\\bin\\bun.exe`).

### Other MCP clients (Cursor, VS Code, Windsurf, MCP Inspector, …)

Any client that supports stdio servers: command `bun`, argument
`<repo>/mcp/index.ts`, optional env `COURSE_STUDIO_URL`. For a quick manual
test:

```console
npx @modelcontextprotocol/inspector bun D:/repos/course-recording-studio/mcp/index.ts
```

### Tools

| Tool | What it does |
| --- | --- |
| `list_courses` | Courses with module/lesson counts |
| `get_course_tree` | Courses → modules → lessons, with `lessonPath`, status, settings |
| `create_course` / `create_module` / `create_lesson` | Create entries (ids are slugs of the titles) |
| `update_course` | `name`, `description`, `language` (vi/en), `outputProfile`, `glossary` |
| `update_lesson` | Title, description, objectives, notes, status, `recordingProfile`, `postProduction` |
| `import_recording` | Import existing video files (OBS, phone, …) as a new take: `displayPath`, `webcamPath?`, `markers?`, `takeId?` |
| `start_post_production` | Silence detection, transcription, markers → edit plan. `wait` (default true) + `timeoutSec` |
| `get_job_status` / `cancel_job` | Latest job of the lesson / cancel it |
| `get_edit_plan` | Summary with indexed cuts, kept duration, chapters, layout, intro/outro (`includeRaw` for the JSON) |
| `update_edit_plan` | `acceptCuts`/`rejectCuts` (indices), `acceptReasons`/`rejectReasons` (`silence`, `marker`, `trim`), `chapters`, `layout`, `intro`, `outro` |
| `get_transcript` | Plain text + timed lines (`includeCaptions` for word-level captions with indices) |
| `update_transcript_text` | Phrase replacements (may span words) and per-caption edits; timing never changes |
| `render_lesson` | Render to `published/`; `wait` + `timeoutSec`; returns the published files |
| `get_published_files` | Absolute paths, URLs, sizes of `published/*` |
| `process_lesson_end_to_end` | One call: find/create lesson by title → import → post-production → accept silence (opt.) → render → published paths |

Long waits send MCP **progress notifications** when the client passes a
`progressToken`, honour cancellation, and stop waiting after `timeoutSec`
(the job keeps running; poll `get_job_status`).

### Resources and prompts

| URI / name | Content |
| --- | --- |
| `courses://tree` | The whole course tree (JSON) |
| `lesson://{lessonPath}` | Lesson + course + module (listed for every lesson) |
| `transcript://{lessonPath}` | Timed transcript (text) |
| `edit-plan://{lessonPath}` | `production/edit-plan.json` |
| prompt `produce-lesson` | Guided workflow from a recording to a published lesson (`course`, `module`, `lesson`, `file`) |
| prompt `review-edit-plan` | Review cuts, chapters and intro of a lesson before rendering (`lessonPath`) |

### Optional: Remotion's own MCP server

`@remotion/mcp` is installed too. It answers questions from the Remotion
documentation, which helps agents that **write Remotion code** (the
`remotion/` compositions); it does not control this app. Register it next to
`course-studio` if you want it:

```console
claude mcp add remotion-documentation -- npx remotion-mcp
```

See <https://www.remotion.dev/docs/ai/mcp>.

## 2. CLI

```console
npm run studio -- <command> [options]      # or: bun scripts/cli/index.ts <command>
npm run studio -- help
```

Add `--json` for machine-readable output (progress goes to stderr), `--url`
to target another instance. Exit codes: `0` ok, `1` error, `2` usage error,
`3` job failed / cancelled / timed out.

```console
# Everything in one go: create course/module/lesson if missing (idempotent by slug),
# import a recording, post-production, accept silence suggestions, render.
npm run studio -- process --course "Lập trình .NET" --module "Cơ bản" --lesson "Giới thiệu" --file D:\rec.mp4 --accept-silence --render

# Same, skipping Whisper (fast) and with markers from a JSON file
npm run studio -- process --course "C# 101" --module "Basics" --lesson "Intro" --file D:\obs\intro.mkv --markers D:\obs\markers.json --no-transcribe --render --json

# Step by step
npm run studio -- ensure --course "C# 101" --module "Basics" --lesson "Intro"     # prints the lesson path
npm run studio -- import courses/c-101/basics/intro --file D:\obs\intro.mov
npm run studio -- produce courses/c-101/basics/intro
npm run studio -- plan courses/c-101/basics/intro
npm run studio -- plan-update courses/c-101/basics/intro --accept-reason silence --reject 3 --intro-title "Intro" --intro-subtitle "C# 101"
npm run studio -- transcript courses/c-101/basics/intro --timed
npm run studio -- fix-transcript courses/c-101/basics/intro --replace "dot net=.NET" --replace "c sharp=C#"
npm run studio -- render courses/c-101/basics/intro
npm run studio -- published courses/c-101/basics/intro --json

# Settings
npm run studio -- update-course --course c-101 --language en --output-profile course-hq --glossary ".NET,ASP.NET Core,Entity Framework"
npm run studio -- update-lesson courses/c-101/basics/intro --transcribe false --silence-preset balanced
```

`markers.json` is an array of `{ "type": "cut" | "important" | "chapter", "timeMs": 12345, "title"?: "…" }`
with times in ms from the start of the recording.

## 3. HTTP API

JSON in, JSON out; errors are `{ "error": "…" }` with 400/404/405/409/500.
`lessonPath` is always `courses/<course>/<module>/<lesson>`.

| Method | Route | Body / query | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | – | `{ok, app, version, port, publicDir}` |
| GET | `/api/courses` | – | Course tree `[{course, modules: [{module, lessons}]}]` |
| POST | `/api/courses` | `{kind:"course", name, description?, language?}` · `{kind:"module", courseId, title}` · `{kind:"lesson", courseId, moduleId, title, description?, objectives?, notes?, recordingProfile?, postProduction?}` | Created entry |
| PATCH | `/api/courses` | `{kind:"course", courseId, patch:{name?, description?, language?, outputProfile?, glossary?}}` | Course |
| PATCH | `/api/lesson` | `{lessonPath, patch:{title?, description?, objectives?, notes?, status?, recordingProfile?, postProduction?}}` | Lesson |
| POST | `/api/lesson/import-recording` | `{lessonPath, displayPath, webcamPath?, markers?, takeId?}` — absolute paths to `.mp4/.webm/.mov/.mkv`; `.mov/.mkv` are remuxed (h264) or transcoded to mp4 | `{lesson, take:{takeId, dir, display, webcam, durationMs, conversions, markers}}` |
| GET | `/api/lesson/published` | `?lessonPath=` | `{lessonPath, dir, files:[{name, path, urlPath, sizeBytes, modifiedAt}]}` |
| POST | `/api/lesson/take-file` | `?lessonPath=&takeId=&name=markers.json\|session.json`, body = file JSON | The file |
| POST | `/api/lesson/select-take` | `{lessonPath, takeId}` | Lesson (status RECORDED) |
| POST | `/api/upload-video` | `?lessonPath=&takeId=&prefix=display\|webcam&extension=mp4\|webm`, raw body | – (recorder upload) |
| GET | `/api/disk-space` | – | `{freeBytes}` |
| POST | `/api/production/start` | `{lessonPath, retranscribe?}` | JobState (202) |
| GET | `/api/production/status` | `?lessonPath=` | JobState or `null` |
| POST | `/api/production/cancel` | `{lessonPath}` | `{cancelled}` |
| GET | `/api/production/edit-plan` | `?lessonPath=` | EditPlan |
| PUT | `/api/production/edit-plan` | `{lessonPath, cuts?:[{index, accepted}], chapters?, layout?, intro?, outro?}` | EditPlan |
| GET | `/api/production/captions` | `?lessonPath=` | Caption[] of the selected take |
| PUT | `/api/production/captions` | `{lessonPath, captions}` (same count and timing, text only) | Caption[] |
| POST | `/api/render` | `{lessonPath}` | JobState (202) |

Legacy Remotion Recorder routes (`/api/projects`, `/api/create-folder`,
`/api/transcribe-video`, `/api/cancel-transcribe`) still exist for the
original recorder workflow.

JobState: `{id, kind: "production"|"render", lessonPath, takeId, status, step, progress (0..1), error, createdAt, updatedAt, finishedAt}`;
`status` is `QUEUED → ANALYZING → TRANSCRIBING → EDITING → COMPLETED` (production) or
`QUEUED → RENDERING → COMPLETED` (render), or `FAILED` / `CANCELLED`. Only one job per
lesson at a time (409 otherwise).

Published files (`<lesson>/published/`): `lesson.mp4`, `lesson.srt`, `lesson.vtt`
(when there are captions), `thumbnail.jpg`, `chapters.json`, `transcript.md`.

## Safety

- Imported source files are only read (copied or converted), never moved or deleted.
- An import always creates a new take folder (`recordings/<takeId>/`); an existing take id is refused (409).
- Nothing in the MCP server or CLI deletes recordings. Re-running post-production rewrites `production/*` only; rendering replaces `published/*`.
