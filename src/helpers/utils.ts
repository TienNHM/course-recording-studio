import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom type scale from tailwind.config.js, otherwise
// it treats `text-title` as a text color and drops it next to `text-primary`.
const twMerge = extendTailwindMerge({
  classGroups: {
    "font-size": [
      {
        text: [
          "2xs",
          "display",
          "title",
          "heading",
          "body",
          "label",
          "caption",
          "overline",
        ],
      },
    ],
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
