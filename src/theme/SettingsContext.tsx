import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { STORAGE_KEYS, readJson, writeJson } from "../lib/storage";
import { applySettings, sanitizeSettings, settingsReducer, type Settings, type SettingsAction } from "./settings";

interface SettingsContextValue {
  settings: Settings;
  dispatch: Dispatch<SettingsAction>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Reads saved settings (or defaults). Exported so main.tsx can apply them before the first paint. */
export function loadSettings(): Settings {
  return sanitizeSettings(readJson(STORAGE_KEYS.settings));
}

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Settings }) {
  const [settings, dispatch] = useReducer(settingsReducer, initial ?? loadSettings());

  // Autosave and apply after every change.
  useEffect(() => {
    applySettings(settings);
    writeJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  const value = useMemo(() => ({ settings, dispatch }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
