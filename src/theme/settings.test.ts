import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings, settingsReducer, settingsToDom } from "./settings";

describe("settings", () => {
  it("defaults to dark theme, Atkinson, gentle motion on the table", () => {
    expect(DEFAULT_SETTINGS.theme).toBe("dark");
    expect(DEFAULT_SETTINGS.font).toBe("atkinson");
    expect(DEFAULT_SETTINGS.motion).toBe("gentle");
    expect(DEFAULT_SETTINGS.sound).toBe(false);
  });

  it("repairs corrupted saved data instead of crashing", () => {
    expect(sanitizeSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: "purple", fontSizeStep: 9, lineHeightStep: -1 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: "light", fontSizeStep: 3 })).toMatchObject({ theme: "light", fontSizeStep: 3 });
  });

  it("never lets line height go below 1.5", () => {
    const s = settingsReducer({ ...DEFAULT_SETTINGS }, { type: "set", patch: { lineHeightStep: 0 } });
    expect(Number(settingsToDom(s).vars["--leading"])).toBeGreaterThanOrEqual(1.5);
  });

  it("toggles theme and focus mode, and resets", () => {
    let s = settingsReducer({ ...DEFAULT_SETTINGS }, { type: "toggleTheme" });
    expect(s.theme).toBe("light");
    s = settingsReducer(s, { type: "toggleFocusMode" });
    expect(s.focusMode).toBe(true);
    expect(settingsReducer(s, { type: "reset" })).toEqual(DEFAULT_SETTINGS);
  });

  it("maps the four font-size steps to rem-scaling root sizes", () => {
    const sizes = [0, 1, 2, 3].map((i) => settingsToDom({ ...DEFAULT_SETTINGS, fontSizeStep: i }).vars["--root-size"]);
    expect(sizes).toEqual(["100%", "112.5%", "125%", "137.5%"]);
  });
});
