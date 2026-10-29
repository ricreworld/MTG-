import type { Config } from "tailwindcss";

// Every value points at a CSS variable in src/styles/tokens.css,
// so themes and learner settings change the whole UI without new classes.
const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: rgb("color-bg"),
      surface: { DEFAULT: rgb("color-surface"), 2: rgb("color-surface-2") },
      border: { DEFAULT: rgb("color-border"), strong: rgb("color-border-strong") },
      text: { DEFAULT: rgb("color-text"), muted: rgb("color-text-muted") },
      accent: { DEFAULT: rgb("color-accent"), ink: rgb("color-accent-ink"), soft: rgb("color-accent-soft") },
      focus: rgb("color-focus"),
      success: { DEFAULT: rgb("color-success"), soft: rgb("color-success-soft") },
      hint: { DEFAULT: rgb("color-hint"), soft: rgb("color-hint-soft") },
      mtg: {
        white: rgb("mtg-white"), "white-ink": rgb("mtg-white-ink"),
        blue: rgb("mtg-blue"), "blue-ink": rgb("mtg-blue-ink"),
        black: rgb("mtg-black"), "black-ink": rgb("mtg-black-ink"),
        red: rgb("mtg-red"), "red-ink": rgb("mtg-red-ink"),
        green: rgb("mtg-green"), "green-ink": rgb("mtg-green-ink"),
        colorless: rgb("mtg-colorless"), "colorless-ink": rgb("mtg-colorless-ink"),
      },
    },
    fontFamily: {
      body: "var(--font-body)",
      mono: "var(--font-mono)",
    },
    fontSize: {
      sm: "var(--text-sm)",
      base: "var(--text-base)",
      lg: "var(--text-lg)",
      xl: "var(--text-xl)",
      "2xl": "var(--text-2xl)",
    },
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      full: "var(--radius-full)",
    },
    extend: {
      spacing: {
        "s1": "var(--space-1)", "s2": "var(--space-2)", "s3": "var(--space-3)", "s4": "var(--space-4)",
        "s5": "var(--space-5)", "s6": "var(--space-6)", "s7": "var(--space-7)", "s8": "var(--space-8)",
        tap: "var(--tap-min)",
      },
      minHeight: { tap: "var(--tap-min)" },
      minWidth: { tap: "var(--tap-min)" },
      maxWidth: { measure: "var(--measure)" },
      lineHeight: { learner: "var(--leading)" },
      letterSpacing: { learner: "var(--tracking)" },
      transitionDuration: { motion: "var(--motion-duration)" },
      outlineWidth: { focus: "var(--focus-width)" },
    },
  },
  plugins: [],
} satisfies Config;
