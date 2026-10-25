import {
  loadFont as loadRegular,
  fontFamily as regularFont,
} from "@remotion/google-fonts/BeVietnamPro";

import {
  loadFont as loadMonospace,
  fontFamily as monospaceFont,
} from "@remotion/google-fonts/JetBrainsMono";

import { cancelRender, continueRender, delayRender } from "remotion";

// Be Vietnam Pro is designed for Vietnamese diacritics; JetBrains Mono for code.
// Only the subsets we need are loaded to keep font downloads small.
const subsets = ["latin", "latin-ext", "vietnamese"] as const;

const regular = loadRegular("normal", {
  weights: ["500", "600", "700"],
  subsets: [...subsets],
});
const monospace = loadMonospace("normal", {
  weights: ["500"],
  subsets: [...subsets],
});

export const waitForFonts = async () => {
  await regular.waitUntilDone();
  await monospace.waitUntilDone();
};

export const REGULAR_FONT: React.CSSProperties = {
  fontFamily: regularFont,
  fontWeight: 600,
};

export const MONOSPACE_FONT: React.CSSProperties = {
  fontFamily: monospaceFont,
  fontWeight: 500,
};

export const TITLE_FONT: React.CSSProperties = {
  fontFamily: regularFont,
  fontWeight: 700,
};

export const ENDCARD_FONT: React.CSSProperties = {
  fontFamily: regularFont,
  fontWeight: 500,
};

const delay = delayRender("Loading fonts");

waitForFonts()
  .then(() => continueRender(delay))
  .catch((err) => cancelRender(err));
