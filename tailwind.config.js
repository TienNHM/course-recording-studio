/** @type {import('tailwindcss').Config} */

// Semantic color tokens (see src/theme/tokens.ts and docs/design-system.md).
// `<alpha-value>` lets every token take opacity modifiers: bg-success/15.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const pair = (name) => ({
  DEFAULT: token(name),
  foreground: token(`${name}-foreground`),
});

module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: pair("primary"),
        secondary: pair("secondary"),
        destructive: pair("destructive"),
        muted: pair("muted"),
        accent: pair("accent"),
        popover: pair("popover"),
        card: pair("card"),
        success: pair("success"),
        warning: pair("warning"),
        info: pair("info"),
        recording: pair("recording"),
        brand: {
          from: token("brand-from"),
          to: token("brand-to"),
          foreground: token("brand-foreground"),
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, hsl(var(--brand-from)), hsl(var(--brand-to)))",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      // Semantic type scale. Use these instead of ad-hoc sizes:
      // display > title > heading > body > label/caption > overline
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        display: [
          "2rem",
          { lineHeight: "2.5rem", fontWeight: "700", letterSpacing: "-0.02em" },
        ],
        title: [
          "1.375rem",
          { lineHeight: "1.875rem", fontWeight: "600", letterSpacing: "-0.01em" },
        ],
        heading: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.375rem" }],
        label: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
        overline: [
          "0.6875rem",
          { lineHeight: "1rem", fontWeight: "600", letterSpacing: "0.06em" },
        ],
      },
      spacing: {
        header: "3.5rem",
      },
      height: {
        header: "3.5rem",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "progress-indeterminate":
          "progress-indeterminate 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
