/** Namespace "recording" (English). Keys must match ../vi/recording.ts. */
import { plural } from "../../types";
import type { RecordingMessages } from "../vi/recording";

const recording: RecordingMessages = {
  title: "Record lesson",

  header: {
    back: "Library",
    noLesson: "No lesson selected",
    notes: "Notes",
    showNotes: "Show lesson notes",
    hideNotes: "Hide lesson notes",
  },

  sources: {
    title: "Sources",
    label: {
      webcam: "Webcam",
      display: "Screen",
      alternative1: "Extra source 1",
      alternative2: "Extra source 2",
    },
    hint: {
      webcam: "Camera filming the presenter",
      display: "Screen or window you present",
      alternative1: "Additional camera or screen — not saved to the lesson",
      alternative2: "Additional camera or screen — not saved to the lesson",
    },
    micBadge: "Records mic",
    requiredBadge: "Lesson needs it",
    live: "Recording",
    video: "Video",
    audio: "Microphone",
    choose: "Choose a source…",
    none: "Don't use",
    noAudio: "No microphone",
    screen: "Share a screen / window",
    screenWithAudio: "Screen + system audio (no microphone)",
    screenGroup: "Screen",
    cameraGroup: "Cameras",
    cameraFallback: "Camera {index}",
    micFallback: "Microphone {index}",
    pickScreen: "Choose a screen to record",
    changeScreen: "Change screen",
    emptyTitle: "No video yet",
    emptyHint: "Pick a camera or a screen below.",
    emptyScreenHint:
      "Your browser will ask whether to share the whole screen, a window or a tab.",
    loading: "Opening source…",
    rescan: "Rescan devices",
    rescanning: "Scanning…",
    more: "Add extra sources",
    fewer: "Hide extra sources",
    resolution: "{width}×{height} · {fps} FPS",
    crop: "Show portrait crop guide",
    mirror: "Mirror",
    rotate: "Portrait",
    resolutionSettings: "Resolution & frame rate",
    clear: "Clear source",
    webcamOff: {
      title: "This lesson doesn't use a webcam",
      body: "Only the screen and microphone are recorded. You can still turn the webcam on for this take.",
      enable: "Turn webcam on",
      disable: "Turn webcam off",
    },
    error: {
      notReadable:
        "The device can't be read. Another app may be using this camera.",
      overconstrained:
        "The device doesn't support the selected resolution / frame rate. Lower the resolution limit.",
      cancelled: "You cancelled the screen picker.",
      notAllowed: "The browser blocked access to this device.",
      notFound: "Device not found. Plug it back in and rescan.",
      generic: "Couldn't open the source: {message}",
      retry: "Try again",
    },
  },

  preflight: {
    title: "Pre-flight check",
    lesson: {
      label: "Lesson",
      ok: "{lesson}",
      missing: "No lesson selected — the take can only be downloaded",
      noServer:
        "The local server isn't running — the take can only be downloaded",
      choose: "Choose a lesson",
    },
    mic: {
      label: "Microphone",
      ok: "Sounds good",
      missing: "Choose a microphone for the {source} source",
      listening: "Say a few words…",
      silent: "Nothing heard yet — check the mic or speak louder",
      notRequired: "This lesson doesn't record a microphone",
    },
    screen: {
      label: "Screen",
      ok: "Selected",
      missing: "Choose a screen or window to record",
      loading: "Waiting for you to pick a screen…",
      otherVideo: "Not recording the screen — camera only",
      action: "Choose screen",
    },
    webcam: {
      label: "Webcam",
      ok: "Selected",
      missing: "This lesson needs a webcam — choose a camera",
      loading: "Opening camera…",
      notRequired: "Not used for this lesson",
      extra: "Will be recorded too",
    },
    disk: {
      label: "Disk space",
      ok: "{free} free",
      low: "Only {free} left — a long take may not fit",
      loading: "Checking…",
      unknown: "Couldn't check",
    },
    state: {
      ok: "OK",
      warning: "Needs attention",
      error: "Not ready",
      pending: "Checking",
      skipped: "Skipped",
    },
    ready: "Everything is ready",
    warnings: "You can record, but check the items that need attention",
    blocked: "Complete the missing items to start recording",
    start: "Start recording",
    pressKey: "or press",
    autoProcessOn:
      "When you stop, the take is saved and post-production starts automatically.",
    autoProcessOff:
      "When you stop, the take is saved. Automatic post-production is off for this lesson.",
  },

  countdown: {
    title: "Get ready",
    hint: "Recording starts in {seconds} s",
    cancel: "Cancel",
  },

  live: {
    rec: "REC",
    paused: "Paused",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    stopAndSave: "Stop & save",
    markers: "Markers",
    chapterPlaceholder: "Next chapter title (default: {title})",
    chapterInput: "Title for the next chapter marker — Enter to add",
    markerCount: plural({
      zero: "No markers yet",
      one: "{count} marker",
      other: "{count} markers",
    }),
    lastMarker: "Last marker: {title} · {time}",
    micLevel: "Microphone level",
    pipTitle: "Recording controls",
    pipHint: "The floating panel stays on top — you can switch to another app.",
    pipUnsupported:
      "This browser doesn't support the floating panel. Use these buttons or the shortcuts.",
  },

  markers: {
    cut: "Cut",
    important: "Important",
    chapter: "Chapter",
    add: "Add “{type}” marker ({key})",
    defaultChapter: "Chapter {number}",
  },

  announce: {
    countdown: "Recording starts in {seconds} seconds",
    started: "Recording started",
    paused: "Recording paused",
    resumed: "Recording resumed",
    stopped: "Recording stopped",
    cancelled: "Countdown cancelled",
    marker: "{type} marker added",
    saved: "Take saved",
    saveFailed: "Saving the take failed",
  },

  take: {
    savingTitle: "Saving take",
    savingHint: "Keep this tab open until saving is done.",
    step: {
      converting: "Converting {file}",
      copying: "Copying {file} into the lesson",
      finishing: "Saving markers and session info",
      downloading: "Preparing {file}",
      transcribing: "Transcribing {file}",
      installingWhisper: "Installing Whisper",
      downloadingModel: "Downloading the Whisper model",
    },
    abort: "Stop saving",
    summary: "{duration} · {markers}",
    savedTitle: "Take saved to “{lesson}”",
    autoProcessTitle: "Post-production started automatically",
    autoProcessBody:
      "Transcription, silence detection and chapters run in the background. You can record another lesson meanwhile.",
    autoPublishNote:
      "Auto-publish is on for this lesson: the video renders as soon as post-production is done.",
    manualTitle: "Automatic post-production is off",
    manualBody: "Click “Process now” when you're ready.",
    processNow: "Process now",
    processStarting: "Starting…",
    processFailed: "Couldn't start post-production: {message}",
    jobStatus: {
      QUEUED: "Queued",
      ANALYZING: "Analyzing",
      TRANSCRIBING: "Transcribing",
      EDITING: "Editing",
      RENDERING: "Rendering",
      COMPLETED: "Done — ready for review",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    },
    backToLibrary: "Back to library",
    recordAnother: "Record another take",
    reviewWhenReady: "Review when ready",
    reviewNow: "Review now",
    errorTitle: "Couldn't save the take",
    errorBody:
      "{message} — the take is still kept in the browser. Retry or download it.",
    abortedTitle: "Saving stopped",
    unsavedTitle: "Take not saved yet",
    noLesson:
      "No lesson selected. Download the take, or choose a lesson and save.",
    noServer: "The local server isn't running — download the take instead.",
    save: "Save to lesson",
    retry: "Retry",
    download: "Download (MP4)",
    downloadRaw: "Download original (no conversion)",
    preview: "Preview {source}",
    moreOptions: "More options",
    discard: "Discard take",
    downloadFailed: "Download failed: {message}",
    discardConfirm: {
      title: "Discard this take?",
      body: "A take that wasn't saved to a lesson is deleted from the browser. This can't be undone.",
      confirm: "Discard take",
    },
  },

  recover: {
    title: "An unfinished take wasn't saved",
    meta: "{date} · {duration} · {markers}",
    target: "Will be saved to {lesson}",
    noTarget: "Choose a lesson to recover it",
    noServer: "The local server is needed to recover it",
    more: plural({ one: "+{count} more", other: "+{count} more" }),
    recover: "Recover",
    discard: "Discard",
    noData:
      "No recorded data was found for this take. It can only be discarded.",
    failed: "Recovering failed: {message}",
    discardConfirm: {
      title: "Discard the unfinished take?",
      body: "The recorded data is deleted from the browser. This can't be undone.",
      confirm: "Discard take",
    },
  },

  disk: {
    confirmTitle: "Running out of disk space",
    confirmBody:
      "Only {free} is free. A long take may not fit and could fail midway.",
    confirm: "Record anyway",
  },

  errors: {
    title: "Something went wrong",
    startFailed: "Couldn't start recording: {message}",
    recordingFailed:
      "Recording failed: {message}. Reload the page to recover what was recorded.",
    devices: "Couldn't list devices: {message}",
    dismiss: "Dismiss",
  },

  devices: {
    loading: "Looking for devices…",
    failedTitle: "Couldn't read devices",
  },

  permission: {
    title: "Allow device access",
    bodyMic: "The app needs your microphone to record your voice.",
    bodyCamera:
      "This lesson records your webcam, so the app needs your microphone and camera.",
    microphone: "Microphone",
    camera: "Camera",
    state: {
      initial: "Checking…",
      prompt: "Waiting for permission",
      granted: "Allowed",
      denied: "Blocked",
    },
    promptHint: "Click “Allow” in the browser's prompt (near the address bar).",
    deniedTitle: "Access is blocked",
    steps: {
      one: "Click the padlock / info icon left of the page address.",
      two: "Open “Permissions” or “Site settings”.",
      three: "Set Microphone and Camera to “Allow” or “Ask”.",
      four: "Reload the page to apply.",
    },
    reload: "Reload page",
    noDeviceTitle: "No microphone or camera found",
    noDeviceBody:
      "This device doesn't seem to be able to capture audio / video. Check that a microphone and camera are connected.",
  },

  browser: {
    unsupportedTitle: "Browser not supported",
    unsupportedBody:
      "This browser doesn't support the Web File System API needed for recording. Use a recent Chrome or Edge.",
    securityTitle: "Security error",
    securityBody:
      "The Web File System API is unavailable — you may be in a private window. Open the app in a regular window.",
  },

  notes: {
    title: "Lesson notes",
    objectives: "Objectives",
    notes: "Speaker notes",
    description: "Description",
    empty:
      "This lesson has no objectives or notes yet. Add them in the Library to see them while recording.",
    noLesson: "Choose a lesson to see its notes while recording.",
    collapse: "Collapse notes",
    expand: "Expand notes",
    larger: "Larger text",
    smaller: "Smaller text",
  },

  shortcuts: {
    title: "Keyboard shortcuts",
    open: "Show keyboard shortcuts",
    record: "Start / stop recording",
    pause: "Pause / resume",
    important: "Mark an important moment",
    cut: "Mark a part to cut",
    chapter: "Add a chapter marker",
    cancel: "Cancel the countdown",
    note: "Shortcuts also work in the floating panel, but not while typing.",
  },

  resolution: {
    title: "Limit resolution",
    description: "Lower the resolution of {device} if you see dropped frames.",
    full: "Full resolution",
    fullWithHeight: "Full resolution ({height}p)",
    limitTo: "Limit to {size}",
    fpsTitle: "Minimum frame rate",
    fpsUnknown:
      "{device} might record at a higher frame rate, but the resolution might drop.",
    fpsKnown:
      "{device} records up to {fps} FPS, but this might lower the resolution.",
    fpsDefault: "Default",
    fpsAtLeast: "At least {fps} FPS",
    done: "Done",
  },
};

export default recording;
