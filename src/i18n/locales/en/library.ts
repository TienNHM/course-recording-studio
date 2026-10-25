/** Namespace "library" (English). Keys must match ../vi/library.ts. */
import { plural } from "../../types";
import type { LibraryMessages } from "../vi/library";

const library: LibraryMessages = {
  title: "Course library",
  continueRecording: "Continue recording: {lesson}",
  continueRecordingShort: "Continue recording",
  newCourse: "New course",
  automation: "Automation",
  serverOffline:
    "The local server is not running. Run “npm run dev”, then reload the page.",
  loadError: "Could not load the library: {message}",

  onboarding: {
    title: "Quick start",
    intro:
      "Every lesson goes through 4 steps. The app does most of the work — you record and review.",
    dismiss: "Got it",
    show: "How it works",
    steps: {
      record: {
        title: "Record",
        body: "Record screen + webcam right here, or drop an OBS video into the inbox folder.",
      },
      process: {
        title: "Process",
        body: "Subtitles, silence detection and chapters are created automatically once the take is saved.",
      },
      review: {
        title: "Review",
        body: "Check the cuts, chapters and subtitles before exporting.",
      },
      publish: {
        title: "Publish",
        body: "Export MP4, SRT/VTT subtitles, a thumbnail and chapters. Auto-publish is optional.",
      },
    },
  },

  sidebar: {
    label: "Courses",
    published: "{done}/{total} published",
    pickCourse: "Choose a course",
  },

  empty: {
    noCourses: {
      title: "No courses yet",
      body: "Create your first course, add modules and lessons, then start recording.",
      action: "Create course",
    },
    noModules: {
      title: "This course has no modules",
      body: "Modules group lessons together, e.g. “Module 1: Introduction”.",
    },
    noLessons: "This module has no lessons yet.",
    noSelection: {
      title: "Select a lesson",
      body: "Pick a lesson on the left to see its progress, record it or edit its details.",
    },
  },

  outline: {
    settings: "Course settings",
    moduleCount: plural({ one: "{count} lesson", other: "{count} lessons" }),
    modulePublished: "{done}/{total} done",
    newModulePlaceholder: "New module title, e.g. “Module 1: Introduction”",
    newModule: "Add module",
    newLessonPlaceholder: "New lesson title",
    newLesson: "Add lesson",
    current: "Recording target",
    currentHint: "This lesson is selected for recording",
    lessonNumber: "Lesson {number}",
  },

  inlineCreate: {
    required: "Please enter a title.",
    tooLong: "The title is too long (max {max} characters).",
    failed: "Could not create it: {message}",
  },

  newCourseDialog: {
    title: "New course",
    description:
      "The course language is used for subtitles and the text in the video.",
    name: "Course name",
    namePlaceholder: "React fundamentals",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Who is it for, what will they be able to do…",
    language: "Course language",
    create: "Create course",
    creating: "Creating…",
    failed: "Could not create the course: {message}",
  },

  steps: {
    label: "Lesson progress",
    record: "Record",
    process: "Process",
    review: "Review",
    publish: "Publish",
    state: {
      done: "Done",
      current: "Current step",
      active: "Running",
      failed: "Failed",
      upcoming: "Not yet",
    },
  },

  actions: {
    record: "Record lesson",
    reRecord: "Record again",
    process: "Process",
    reProcess: "Process again",
    review: "Review the edit",
    export: "Export video",
    reExport: "Export again",
    openPublished: "Open published video",
    cancelJob: "Cancel job",
    retranscribe: "Re-create subtitles",
    retranscribeHint: "Run Whisper again instead of reusing existing subtitles.",
    more: "More actions",
  },

  primaryHint: {
    record: "Next step: record the lesson.",
    process: "Next step: process the recording.",
    review: "Next step: review the cuts, chapters and subtitles.",
    export: "Next step: export the video.",
    "open-published": "This lesson is published.",
    wait: "Working on it — feel free to do something else meanwhile.",
    archived: "This lesson is archived.",
  },

  job: {
    production: "Post-production",
    render: "Export",
    status: {
      QUEUED: "Queued",
      ANALYZING: "Analyzing",
      TRANSCRIBING: "Transcribing",
      EDITING: "Editing",
      RENDERING: "Rendering",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    },
    progress: "{kind}: {percent}",
    failed: "{kind} failed",
    cancelled: "{kind} was cancelled.",
    unknownError: "Unknown error",
    finishedAt: "Finished {time}",
  },

  next: {
    title: "What's next",
    auto: "Automatic",
    manual: "Needs you",
    waitingRecordAuto:
      "Waiting for a recording — processing starts automatically when the take is saved.",
    waitingRecord: "Waiting for a recording. After recording, click “Process”.",
    processingThenPublish:
      "Processing — will be published automatically after processing.",
    processingThenReview: "Processing — then it waits for your review.",
    rendering: "Exporting — the lesson is published when it finishes.",
    recorded:
      "Recorded. Click “Process” to create subtitles and the edit.",
    reviewAutoPublish:
      "Ready to export (auto-publish is on). Click “Export video” or “Process all pending”.",
    review: "Waiting for you to review the edit, then export.",
    published: "Published. Export again any time after changing the edit.",
    archived: "This lesson is archived.",
    lastFailed: "The last run failed: {error}",
  },

  published: {
    title: "Published files",
    video: "Video (MP4)",
    srt: "Subtitles (SRT)",
    vtt: "Subtitles (VTT)",
    chapters: "Chapters",
    transcript: "Transcript",
    thumbnail: "Thumbnail",
    none: "No files yet.",
  },

  detail: {
    takeDuration: "Take length {duration}",
    keptDuration: "After cuts {duration}",
    noTake: "No take yet",
  },

  form: {
    title: "Lesson details",
    lessonTitle: "Title",
    lessonTitlePlaceholder: "Lesson 1: Course introduction",
    description: "Description",
    descriptionPlaceholder: "What is this lesson about?",
    objectives: "Learning objectives",
    objectivePlaceholder: "Objective {number}",
    addObjective: "Add objective",
    removeObjective: "Remove objective {number}",
    notes: "Speaker notes",
    notesHint: "Shown in the floating window while recording.",
    recording: "Recording",
    webcam: "Record webcam",
    webcamHint: "Also record the presenter in a corner of the video.",
    postProduction: "Post-production",
    automationSection: "Automation",
    autoProcess: "Process automatically after recording",
    autoProcessHint:
      "Start subtitles and the edit as soon as a take is saved or imported.",
    autoPublish: "Publish automatically after processing",
    autoPublishHint:
      "Skips review: the video is exported as soon as post-production completes. Only turn on if you trust the automatic edit.",
    autoTranscribe: "Create subtitles automatically",
    autoTranscribeHint: "Uses Whisper running on this computer.",
    autoDetectSilence: "Detect silence",
    autoDetectSilenceHint: "Suggests silent parts to cut.",
    autoRemoveSilence: "Remove silence automatically",
    autoRemoveSilenceHint: "When off, silent parts are only suggested for review.",
    generateChapters: "Chapters from markers",
    generateChaptersHint: "Uses the “chapter” markers you set while recording.",
    intro: "Intro card",
    introHint: "Lesson title at the start of the video.",
    outro: "Outro card",
    outroHint: "Thank-you card at the end of the video.",
    silencePreset: "Silence cutting",
    silencePresets: {
      conservative: "Gentle",
      balanced: "Balanced",
      aggressive: "Aggressive",
    },
    validation: {
      titleRequired: "The title cannot be empty.",
      titleTooLong: "The title is too long (max {max} characters).",
      objectiveDuplicate: "Duplicate objective.",
    },
    saveState: {
      saved: "Saved",
      saving: "Saving…",
      dirty: "Unsaved changes",
      invalid: "Fix the errors to save",
      error: "Could not save: {message}",
      autosave: "Autosave",
    },
    saveNow: "Save now",
  },

  courseSettings: {
    title: "Course settings",
    description: "Applies to every lesson of this course.",
    sections: {
      general: "General",
      glossary: "Glossary",
      videoStyle: "Video style",
    },
    name: "Course name",
    descriptionLabel: "Description",
    language: "Language",
    languageHint: "Used for subtitles and the text in the video.",
    outputProfile: "Export quality",
    outputProfiles: {
      "course-standard": "Standard",
      "course-hq": "High quality",
    },
    outputProfileDetail: "{width}×{height}, {fps} frames per second",
    glossaryHint:
      "Correct terms and how Whisper tends to mishear them. Subtitles are corrected to the term.",
    glossaryTerm: "Correct term",
    glossaryTermPlaceholder: "ASP.NET Core",
    glossaryAliases: "Misheard as",
    glossaryAliasesPlaceholder: "asp dot net core, a s p net",
    glossaryAliasesHint: "Separated by commas.",
    glossaryAdd: "Add term",
    glossaryRemove: "Remove term “{term}”",
    glossaryEmpty: "No terms yet.",
    glossaryDuplicate: "Duplicate term.",
    glossaryCount: plural({ zero: "None", one: "{count} term", other: "{count} terms" }),
    nameRequired: "The course name cannot be empty.",
    save: "Save settings",
    saved: "Course settings saved",
    failed: "Could not save: {message}",
    unsaved: "Unsaved changes",
    discardTitle: "Discard changes?",
    discardBody: "Your changes to the course settings will not be saved.",
    discard: "Discard",
    keepEditing: "Keep editing",
  },

  videoStyle: {
    palette: "Video palette",
    intro: "Intro style",
    intros: {
      minimal: "Minimal",
      gradient: "Gradient",
      starburst: "Starburst",
    },
    transition: "Transition",
    transitions: {
      none: "None",
      fade: "Fade",
      slide: "Slide",
      "light-leak": "Light leak",
    },
    chapterCards: "Chapter cards",
    chapterCardsHint: "Show the chapter name when a chapter starts.",
    lowerThird: "Lower third",
    lowerThirdHint: "Course and lesson name at the start of the video.",
    backgroundMusic: "Background music",
    backgroundMusicHint: "Soft music under the intro and outro cards.",
    progressBar: "Progress bar",
    progressBarHint: "Thin bar at the bottom with chapter ticks.",
    preview: "Preview",
    previewHint:
      "Previewing the intro of “{lesson}” — nothing is saved until you click Save.",
    previewMockHint:
      "No lesson has a take yet, so this is a mock-up. Record a lesson to see a real preview.",
    previewPlay: "Hover or click to play",
    previewLoading: "Preparing the preview…",
    previewError: "Could not preview: {message}",
    mockLesson: "Lesson 1",
    mockTitle: "Course introduction",
  },

  automationDialog: {
    title: "Automation",
    description:
      "Drop videos into a folder; the app imports, processes and (if enabled) publishes them.",
    inbox: {
      title: "Inbox folder",
      body: "Place videos as Course/Module/Lesson.mp4. A file is imported once it has not changed for 5 seconds.",
      enabled: "Watch the inbox folder",
      enabledHint: "Import new videos into the right lesson automatically.",
      folder: "Folder path",
      folderHint: "An absolute path, outside the app's public/ folder.",
      useSuggested: "Use the suggested folder",
      suggested: "Suggested: {path}",
      save: "Save folder",
      saved: "Saved",
      failed: "Could not save: {message}",
      folderRequired: "Please enter a folder path.",
      folderNotAbsolute: "The path must be absolute.",
      source: {
        settings: "From settings",
        env: "From environment variable",
        default: "Default",
      },
      layout: "Folder layout",
    },
    watcher: {
      watching: "Watching",
      off: "Off",
      pending: plural({
        zero: "No files waiting",
        one: "{count} file being written",
        other: "{count} files being written",
      }),
      processing: "Importing: {file}",
    },
    events: {
      title: "Recent activity",
      empty: "No activity yet.",
      types: {
        detected: "Detected",
        imported: "Imported",
        deferred: "Deferred",
        failed: "Failed",
        "auto-production": "Auto-process",
        "auto-render": "Auto-export",
        pipeline: "Pipeline",
        watcher: "Watcher",
      },
    },
    pending: {
      title: "Process all pending",
      body: "Processes every recorded lesson and exports every lesson waiting for review that has auto-publish on.",
      scope: "Scope",
      scopeAll: "All courses",
      scopeCourse: "Only “{course}”",
      preview: "Preview",
      run: "Run {count} jobs",
      running: "Queuing…",
      nothing: "Nothing is pending.",
      production: "Will process",
      render: "Will export",
      skipped: "Skipped",
      queued: plural({
        zero: "No jobs were queued.",
        one: "Queued {count} job.",
        other: "Queued {count} jobs.",
      }),
      failed: "Could not run: {message}",
    },
    agent: {
      title: "Connect an AI agent",
      body: "Let Claude Code (or another MCP client) drive the studio: create lessons, import videos, review and publish.",
      mcp: "Add the MCP server to Claude Code",
      cli: "Or use the command line",
      docs: "Details in docs/automation.md.",
      copy: "Copy command",
      copied: "Copied",
      copyFailed: "Could not copy — select and copy it manually.",
    },
    layout: {
      course: "course name",
      module: "module name",
      lesson: "lesson name",
    },
    loadFailed: "Could not load the automation settings: {message}",
  },

  confirm: {
    reProcessTitle: "Process the lesson again?",
    reProcessBody:
      "The current edit (the cuts and chapters you reviewed) is rebuilt from scratch.",
    reProcess: "Process again",
    runPendingTitle: "Run {count} jobs?",
    runPendingBody: "Jobs run one after another in the background; you can keep working.",
  },
};

export default library;
