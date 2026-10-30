// Learner settings: pure data + pure functions, so they're easy to test and to persist.

export type Theme = "dark" | "light";
export type FontChoice = "atkinson" | "lexend" | "opendyslexic";

/** Root font size per step, as a percentage of the browser default (16px). */
export const FONT_SIZE_STEPS = [100, 112.5, 125, 137.5] as const;
/** Line height per step. 1.5 is the minimum the spec allows. */
export const LINE_HEIGHT_STEPS = [1.5, 1.75, 2] as const;
/** Letter spacing per step, in em. */
export const LETTER_SPACING_STEPS = [0, 0.03, 0.06] as const;
/** Word spacing per step, in em. */
export const WORD_SPACING_STEPS = [0, 0.1, 0.2] as const;

export const FONT_LABELS: Record<FontChoice, string> = {
  atkinson: "Atkinson Hyperlegible",
  lexend: "Lexend",
  opendyslexic: "OpenDyslexic",
};

export interface Settings {
  theme: Theme;
  font: FontChoice;
  fontSizeStep: number;      // index into FONT_SIZE_STEPS
  lineHeightStep: number;    // index into LINE_HEIGHT_STEPS
  letterSpacingStep: number; // index into LETTER_SPACING_STEPS
  wordSpacingStep: number;   // index into WORD_SPACING_STEPS
  animations: boolean;       // off by default; the OS reduced-motion setting still wins
  focusMode: boolean;
  swipeToNavigate: boolean; // off by default, so scrolling never jumps to another step
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  theme: "dark",
  font: "atkinson",
  fontSizeStep: 0,
  lineHeightStep: 0,
  letterSpacingStep: 0,
  wordSpacingStep: 0,
  animations: false,
  focusMode: false,
  swipeToNavigate: false,
});

export type SettingsAction =
  | { type: "set"; patch: Partial<Settings> }
  | { type: "toggleTheme" }
  | { type: "toggleFocusMode" }
  | { type: "reset" };

const clampStep = (value: unknown, steps: readonly number[], fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < steps.length ? value : fallback;

/** Turns anything (for example, old or corrupted saved data) into valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : d.theme,
    font: r.font === "atkinson" || r.font === "lexend" || r.font === "opendyslexic" ? r.font : d.font,
    fontSizeStep: clampStep(r.fontSizeStep, FONT_SIZE_STEPS, d.fontSizeStep),
    lineHeightStep: clampStep(r.lineHeightStep, LINE_HEIGHT_STEPS, d.lineHeightStep),
    letterSpacingStep: clampStep(r.letterSpacingStep, LETTER_SPACING_STEPS, d.letterSpacingStep),
    wordSpacingStep: clampStep(r.wordSpacingStep, WORD_SPACING_STEPS, d.wordSpacingStep),
    animations: typeof r.animations === "boolean" ? r.animations : d.animations,
    focusMode: typeof r.focusMode === "boolean" ? r.focusMode : d.focusMode,
    swipeToNavigate: typeof r.swipeToNavigate === "boolean" ? r.swipeToNavigate : d.swipeToNavigate,
  };
}

export function settingsReducer(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case "set":
      return sanitizeSettings({ ...state, ...action.patch });
    case "toggleTheme":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };
    case "toggleFocusMode":
      return { ...state, focusMode: !state.focusMode };
    case "reset":
      return { ...DEFAULT_SETTINGS };
  }
}

/** The CSS custom properties and data attributes a settings object produces. */
export function settingsToDom(s: Settings): { attrs: Record<string, string>; vars: Record<string, string> } {
  return {
    attrs: {
      "data-theme": s.theme,
      "data-font": s.font,
      "data-motion": s.animations ? "on" : "off",
      "data-focus-mode": s.focusMode ? "on" : "off",
    },
    vars: {
      "--root-size": `${FONT_SIZE_STEPS[s.fontSizeStep] ?? 100}%`,
      "--leading": String(LINE_HEIGHT_STEPS[s.lineHeightStep] ?? 1.5),
      "--tracking": `${LETTER_SPACING_STEPS[s.letterSpacingStep] ?? 0}em`,
      "--word-spacing": `${WORD_SPACING_STEPS[s.wordSpacingStep] ?? 0}em`,
    },
  };
}

/** Writes settings onto the root element. Safe to call before React renders (avoids a theme flash). */
export function applySettings(s: Settings, root: HTMLElement = document.documentElement): void {
  const { attrs, vars } = settingsToDom(s);
  for (const [name, value] of Object.entries(attrs)) root.setAttribute(name, value);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  // Phone browser bar / status bar colour follows the theme (Android Chrome; iOS Safari tab bar).
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute("content", s.theme === "dark" ? "#17191F" : "#F4F2ED");
}
