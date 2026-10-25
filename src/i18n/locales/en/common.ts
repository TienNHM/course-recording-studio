/** Namespace "common" (English). Keys must match ../vi/common.ts. */
import { plural } from "../../types";
import type { CommonMessages } from "../vi/common";

const common: CommonMessages = {
  appName: "Course Recording Studio",
  appTagline: "Record, edit and publish course lessons",

  nav: {
    library: "Library",
    record: "Record",
    review: "Review & publish",
    styleguide: "Design system",
  },

  actions: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    add: "Add",
    back: "Back",
    next: "Next",
    retry: "Retry",
    refresh: "Refresh",
    open: "Open",
    copy: "Copy",
    copied: "Copied",
    download: "Download",
    upload: "Upload",
    search: "Search",
    settings: "Settings",
    more: "More options",
  },

  state: {
    loading: "Loading…",
    empty: "Nothing here yet",
    error: "Something went wrong",
    errorWithMessage: "Something went wrong: {message}",
    unsavedChanges: "Unsaved changes",
    optional: "Optional",
    required: "Required",
    yes: "Yes",
    no: "No",
    on: "On",
    off: "Off",
    none: "None",
    unknown: "Unknown",
  },

  lessonStatus: {
    DRAFT: "Draft",
    READY_TO_RECORD: "Ready to record",
    RECORDED: "Recorded",
    PROCESSING: "Processing",
    REVIEW: "In review",
    PUBLISHED: "Published",
    ARCHIVED: "Archived",
  },

  recordingBadge: {
    live: "REC",
    paused: "Paused",
  },

  count: {
    courses: plural({
      zero: "No courses yet",
      one: "{count} course",
      other: "{count} courses",
    }),
    modules: plural({
      zero: "No modules yet",
      one: "{count} module",
      other: "{count} modules",
    }),
    lessons: plural({
      zero: "No lessons yet",
      one: "{count} lesson",
      other: "{count} lessons",
    }),
    takes: plural({
      zero: "No takes yet",
      one: "{count} take",
      other: "{count} takes",
    }),
    files: plural({ one: "{count} file", other: "{count} files" }),
    minutes: plural({ one: "{count} minute", other: "{count} minutes" }),
  },

  language: {
    vi: "Vietnamese",
    en: "English",
  },
};

export default common;
