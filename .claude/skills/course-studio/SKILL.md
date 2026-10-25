---
name: course-studio
description: Produce course lessons with Course Recording Studio — import recordings, run automatic post-production, review the edit plan and transcript, render and publish. Use when the user wants to create courses/modules/lessons, turn a recording (OBS, .mp4/.mov/.mkv) into a published lesson, fix a transcript, accept/reject cuts, or render a lesson. Works through the `course-studio` MCP tools or the `npm run studio` CLI.
---

# Course Recording Studio

The app runs locally (`npm run dev`, http://localhost:4000; `COURSE_STUDIO_URL`
overrides). The MCP tools and the CLI only talk to that running app. If a call
says the app is not reachable, ask the user to start it (or start it in the
background with `npm run dev`) — never work around it by editing files under
`public/courses` by hand.

Reference: `docs/automation.md` (all tools, CLI commands, HTTP routes).

## Model

- course → module → lesson. A lesson is addressed by **lessonPath**
  `courses/<course-id>/<module-id>/<lesson-id>`; ids are slugs of the titles.
- Lesson status: `DRAFT → READY_TO_RECORD → RECORDED → PROCESSING → REVIEW → PUBLISHED` (`ARCHIVED`).
- A **take** is one recording: `recordings/<takeId>/display.mp4|webm`, optional
  `webcam.*`, `markers.json`, `session.json`, `captions.json`. The lesson's
  `selectedTake` is what post-production and rendering use.
- **Markers** (`{type, timeMs, title?}`, ms from the take start):
  `cut` removes the stretch before it (back to the previous pause, max 15 s),
  `chapter` starts a chapter (title), `important` is a highlight.
- Jobs: one per lesson at a time. Production: `QUEUED → ANALYZING → TRANSCRIBING → EDITING → COMPLETED`;
  render: `QUEUED → RENDERING → COMPLETED`; or `FAILED` / `CANCELLED`.

## Edit plan semantics

- `cuts[]` each have `reason` (`silence` | `marker` | `trim`) and `accepted`.
  **Accepted cuts are removed** from the video. **Non-accepted cuts are only
  suggestions** and change nothing until accepted.
- `segments[]` (what is kept) are recomputed by the app — never write them.
- Cut indices are stable across edits (cuts are not merged on update), so
  read the plan once and refer to indices from it.
- `chapters[].timeMs` and cut times are on the **original recording timeline**,
  not the edited one. The app relocates chapters that fall inside removed parts.
- `intro` is `{title, subtitle}` or `null`; `outro` is a boolean; `layout` is
  `screen-only` or `screen-webcam` (only with a webcam take).

## Workflow (MCP)

1. `get_course_tree` — reuse existing course/module/lesson; create only what is missing
   (`create_course` / `create_module` / `create_lesson`). Set `update_course`
   `language` (vi/en) and `glossary` (product/code terms) before transcribing.
2. `import_recording` with the absolute path the user gave (or the user records in the app UI).
3. `start_post_production` (`wait: true`). For a quick run without Whisper, first
   `update_lesson` with `postProduction: {autoTranscribe: false}`.
4. Review: `get_edit_plan` + `get_transcript`. Summarise original vs kept duration,
   suggestions, chapters, transcript mistakes.
5. Apply what the user agrees to: `update_edit_plan` (e.g. `acceptReasons: ["silence"]`,
   `rejectCuts: [3]`, chapter titles), `update_transcript_text`
   (`replacements: [{find: "dot net", replace: ".NET"}]`).
6. `render_lesson` (`wait: true`) → report the published file paths
   (`lesson.mp4`, `.srt`, `.vtt`, `thumbnail.jpg`, `chapters.json`, `transcript.md`).

Shortcut when the user wants no review: `process_lesson_end_to_end`
(`course`/`module`/`lesson` titles, `displayPath`, `acceptSilence`, `render`).
Prompts `produce-lesson` and `review-edit-plan` contain the guided versions.

Waiting tools stop after `timeoutSec` while the job continues; then poll
`get_job_status` instead of starting the job again (a second start returns 409).

## Workflow (CLI)

```console
npm run studio -- process --course "C# 101" --module "Basics" --lesson "Intro" --file D:\rec.mp4 --accept-silence --render --json
npm run studio -- plan courses/c-101/basics/intro
npm run studio -- plan-update courses/c-101/basics/intro --accept-reason silence --reject 3
npm run studio -- fix-transcript courses/c-101/basics/intro --replace "dot net=.NET"
npm run studio -- render courses/c-101/basics/intro
```

## Safety rules

- Never delete, move or overwrite recordings (`recordings/**`) or the user's
  source video files. Imports copy/convert into a new take; original files are immutable.
- Do not edit JSON under `public/courses` directly; use the tools so validation,
  job locking and status updates happen.
- Do not cancel a job or re-run post-production on a lesson in `REVIEW`/`PUBLISHED`
  without the user's go-ahead: re-running rebuilds the edit plan and discards review decisions.
- Rendering replaces `published/*` of that lesson; mention it before re-rendering a published lesson.
