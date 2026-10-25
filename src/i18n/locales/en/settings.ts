/** Namespace "settings" (English). Keys must match ../vi/settings.ts. */
import type { SettingsMessages } from "../vi/settings";

const settings: SettingsMessages = {
  title: "Settings",
  description: "Language, light/dark mode and color palette of the interface.",
  openSettings: "Open settings",

  language: {
    label: "Language",
    hint: "Applies to the interface only, not to the language of a course.",
  },

  mode: {
    label: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "System",
    systemHint: "Follows your OS (currently {mode})",
  },

  palette: {
    label: "Color palette",
    hint: "Red is always reserved for recording and destructive actions.",
    selected: "Selected",
    dotnet: {
      name: ".NET Course",
      description: "Purple #7C5CE0 with a blue gradient",
    },
    recorder: { name: "Recorder", description: "Remotion Recorder red" },
    ocean: { name: "Ocean", description: "Blue" },
    emerald: { name: "Emerald", description: "Teal green" },
    slate: { name: "Slate", description: "Neutral and minimal" },
  },

  viewDesignSystem: "View design system",
  savedLocally: "Preferences are saved in this browser.",

  styleguide: {
    title: "Design system",
    description:
      "Every color token, type style and UI component in every palette and mode.",
    backToApp: "Back to library",
    sections: {
      palettes: "Palettes × modes",
      tokens: "Color tokens (current theme)",
      typography: "Typography",
      spacing: "Radius & spacing",
      buttons: "Buttons",
      badges: "Badges",
      lessonStatus: "Lesson status",
      forms: "Forms",
      feedback: "Feedback & progress",
      surfaces: "Cards, dialogs, menus",
    },
    usePalette: "Use this palette",
    contrast: "Contrast {ratio}:1",
    sampleText: "Lesson 3: Setting up the .NET development environment",
    sampleParagraph:
      "Record your screen and webcam, generate Vietnamese captions automatically and publish to your course in a few steps.",
    sampleCode: "dotnet new webapi -n CourseApi",
    states: {
      default: "Default",
      hover: "Hover",
      disabled: "Disabled",
      loading: "Loading",
      invalid: "Invalid",
    },
    demo: {
      inputPlaceholder: "Lesson name",
      inputLabel: "Title",
      selectPlaceholder: "Choose a module",
      progressLabel: "Exporting video",
      tooltip: "Shortcut: R to start recording",
      dialogTitle: "Delete this take?",
      dialogBody: "This take will be permanently deleted from disk.",
      menu: "Open menu",
      cardTitle: "C# programming basics",
      cardBody: "12 lessons · updated 2 days ago",
    },
  },
};

export default settings;
