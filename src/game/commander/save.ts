// Saving a Commander game so it can be picked up later: the whole state is plain data, so it's JSON.
// Saved after every move; one slot on this device (localStorage), never sent anywhere.
import type { CState } from "./engine";

export const SAVE_KEY = "mana-steps:commander-game";
export const SAVE_VERSION = 1;

export interface SavedGame { version: number; savedAt: string; deckId: string; state: CState }

export function saveGame(state: CState, deckId: string, storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): void {
  if (!storage) return;
  try { storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString(), deckId, state } satisfies SavedGame)); } catch { /* storage full or blocked: the game still plays */ }
}

export function loadGame(storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): SavedGame | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;
    if (parsed.version !== SAVE_VERSION || !parsed.state || !Array.isArray(parsed.state.seats) || !parsed.state.players) return null;
    return parsed as SavedGame;
  } catch { return null; }
}

export function clearGame(storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): void {
  try { storage?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
