/** Namespace "review" (English). Keys must match ../vi/review.ts. */
import { plural } from "../../types";
import type { ReviewMessages } from "../vi/review";

const review: ReviewMessages = {
  title: "Review & publish",
  backToLibrary: "Library",
  noLesson: "Select a lesson in the library first.",
  openLibrary: "Open library",
  noPlan: {
    title: "This lesson has no edit plan yet",
    description:
      "Automatic post-production has not run for the selected take. Run post-production from the library; the edit plan then shows up here.",
  },
  loadError: "Could not load the edit plan: {message}",

  save: {
    saving: "Saving…",
    saved: "All changes saved",
    failed: "Saving failed — changes rolled back",
    unsaved: "Unsaved changes",
  },

  summary: {
    label: "Lesson summary",
    final: "Edited length",
    raw: "Raw take {raw}",
    removed: "{removed} shorter ({percent})",
    total: "Whole video {total} (with intro/outro)",
    cuts: "Cuts",
    acceptedCuts: plural({
      zero: "Nothing cut yet",
      one: "{count} cut applied",
      other: "{count} cuts applied",
    }),
    pending: plural({
      zero: "No suggestions left",
      one: "{count} suggestion to review",
      other: "{count} suggestions to review",
    }),
    chapters: "Chapters",
    chapterCount: plural({
      zero: "No chapters",
      one: "{count} chapter",
      other: "{count} chapters",
    }),
    transcript: "Transcript",
    words: plural({ zero: "No words", one: "{count} word", other: "{count} words" }),
    noTranscript: "No transcript",
    status: "Status",
    next: {
      record: "Next: record the lesson",
      production: "Next: run post-production",
      review: "Next: review, then publish",
      render: "Next: export the video",
      none: "All done",
      automatic: "automatic",
      rendering: "Exporting the video…",
    },
  },

  preview: {
    label: "Preview",
    loading: "Loading the preview…",
    error: "Could not build the preview: {message}",
  },

  timeline: {
    label: "Timeline of the original take",
    hint: "Click the bar to seek; click a hatched part to cut or keep it.",
    legend: {
      kept: "Kept",
      cut: "Cut",
      suggested: "Suggested cut",
      chapter: "Chapter",
      playhead: "Playhead",
    },
    cutAccepted: "{reason} {start}–{end}: cut. Click to keep it.",
    cutSuggested: "{reason} {start}–{end}: suggestion. Click to cut it.",
    chapter: "Chapter: {title} ({time})",
  },

  reason: {
    silence: "Silence",
    marker: "Cut marker",
    trim: "Start/end trim",
  },

  tabs: {
    label: "Editing panels",
    cuts: "Cuts",
    chapters: "Chapters",
    transcript: "Transcript",
    settings: "Settings",
    unsaved: "Unsaved",
  },

  cuts: {
    title: "Cuts",
    empty: "No cuts were suggested.",
    acceptAllSilence: "Cut all silences",
    rejectAllSilence: "Keep all silences",
    reset: "Back to automatic plan",
    resetHint: "Return every cut to what automatic post-production decided",
    removedTotal: "Checked parts are removed from the video ({duration} in total).",
    accept: "Cut part {index}",
    stateCut: "Cut",
    stateKeep: "Keep",
    seek: "Show this part",
    focusedHint: "Selected — press A to cut/keep, ← → to move",
  },

  chapters: {
    title: "Chapters",
    empty: "No chapters yet. Add one at the playhead.",
    addAtPlayhead: "Add at playhead",
    defaultTitle: "Chapter {index}",
    time: "Chapter {index} time",
    titleLabel: "Chapter {index} title",
    seek: "Seek to chapter",
    delete: "Delete chapter",
    save: "Save chapters",
    discard: "Discard changes",
    hint: "Times are on the original take (mm:ss). Chapters are kept in time order.",
    errors: {
      invalidTime: "Invalid time (use mm:ss)",
      emptyTitle: "The title is empty",
      duplicateTime: "Same time as another chapter",
      outOfRange: "Outside the recording",
    },
    insideCut: "Inside a removed part — moves to {time}",
    insideCutDropped: "Inside the removed end — the chapter will be dropped",
    fixErrors: "Fix the errors before saving",
    copyYouTube: "Copy chapters for YouTube",
    copyYouTubeHint:
      "Paste into the YouTube video description (needs at least 3 chapters of 10 s or more).",
    copied: "Copied {count} lines",
  },

  transcript: {
    title: "Transcript",
    empty: "This take has no transcript. Turn on transcription in the lesson settings and re-run post-production.",
    search: "Search the transcript",
    searchPlaceholder: "Search words, sentences…",
    results: plural({
      zero: "No matches",
      one: "{count} matching line",
      other: "{count} matching lines",
    }),
    lines: plural({ one: "{count} line", other: "{count} lines" }),
    edit: "Edit line",
    editLine: "Edit line {index}",
    seekLine: "Seek to {time}",
    saveLine: "Save line",
    cancelEdit: "Cancel",
    editHint: "Enter saves, Esc cancels. Only the text changes; timing stays.",
    saving: "Saving…",
    saved: "Saved",
    lowConfidence: "Low confidence — worth checking",
    glossaryTerm: "Glossary term: {term}",
    aliasOf: "Probably \"{term}\" — click to fix",
    fixAll: "Fix {count} terms",
    legend: {
      glossary: "Glossary term",
      alias: "Likely misheard",
      lowConfidence: "Low confidence",
    },
  },

  settings: {
    title: "Layout, intro and outro",
    layout: "Layout",
    screenOnly: "Screen only",
    screenWebcam: "Screen + webcam",
    noWebcam: "This take has no webcam recording.",
    intro: "Intro title card",
    introTitle: "Intro title",
    introSubtitle: "Intro subtitle (optional)",
    outro: "Outro end card",
    save: "Save settings",
    discard: "Discard changes",
    style: {
      title: "Course video style",
      description:
        "Palette, intro style and transitions are set for the whole course in the Library (course settings), not here.",
      open: "Open in Library",
      palette: "Palette",
      intro: "Intro style",
      transition: "Transition",
      chapterCards: "Chapter cards",
      lowerThird: "Lower third",
      backgroundMusic: "Background music",
      progressBar: "Progress bar",
      introStyle: {
        minimal: "Minimal",
        gradient: "Gradient",
        starburst: "Starburst",
      },
      transitionStyle: {
        none: "None",
        fade: "Fade",
        slide: "Slide",
        "light-leak": "Light leak",
      },
    },
  },

  export: {
    approve: "Approve & export",
    approveHint: "Save the edit plan and export the video, subtitles and chapters to the published folder",
    title: "Publishing",
    rendering: "Exporting the video",
    production: "Running post-production",
    queued: "Waiting in the queue",
    eta: "About {time} left",
    cancel: "Cancel export",
    cancelling: "Cancelling…",
    failed: "Export failed",
    productionFailed: "Post-production failed",
    cancelled: "The export was cancelled.",
    productionCancelled: "Post-production was cancelled.",
    retry: "Export again",
    success: "Published!",
    successHint: "The video and its files are in the published folder.",
    locked: "A job is running — editing is paused.",
  },

  jobStatus: {
    QUEUED: "Queued",
    ANALYZING: "Analyzing",
    TRANSCRIBING: "Transcribing",
    EDITING: "Editing",
    RENDERING: "Rendering",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  },

  published: {
    title: "Published files",
    empty: "Nothing has been exported yet.",
    thumbnail: "Thumbnail",
    play: "Play video",
    openInTab: "Open in a new tab",
    download: "Download {name}",
    copyPath: "Copy path",
    pathCopied: "Path copied",
    files: {
      mp4: "Video (MP4)",
      srt: "Subtitles (SRT)",
      vtt: "Subtitles (VTT)",
      chapters: "Chapters (JSON)",
      transcript: "Transcript (Markdown)",
      thumbnail: "Thumbnail (JPG)",
    },
    copyYouTube: "Copy chapters for YouTube",
    copyFailed: "Could not copy to the clipboard",
    videoTitle: "Exported video",
  },

  shortcuts: {
    button: "Keyboard shortcuts",
    title: "Keyboard shortcuts",
    playPause: "Play / pause",
    back: "Back 5 seconds",
    forward: "Forward 5 seconds",
    toggleCut: "Cut / keep the selected part",
    prevNext: "Previous / next cut",
    help: "Show shortcuts",
  },

  unsaved: {
    title: "Discard unsaved changes?",
    description:
      "You have unsaved changes in {panels}. If you continue, they will be lost.",
    stay: "Stay",
    discard: "Discard and continue",
  },

  units: {
    seconds: "{value} s",
  },
};

export default review;
