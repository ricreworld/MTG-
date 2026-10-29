// Safe localStorage helpers. Storage can be missing or blocked (private windows,
// embedded previews), so every read and write is wrapped and never throws.

const PREFIX = "mana-steps:";

export const STORAGE_KEYS = {
  settings: `${PREFIX}settings`,
  progress: `${PREFIX}progress`, // used from Phase 4
} as const;

export function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: nothing to remove */
  }
}
