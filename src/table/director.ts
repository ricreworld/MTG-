// Lays TableEvents out in time: which cue starts when, how long it runs, and with what easing.
// Pure data in, pure data out. The view plays the cues; it never decides timing itself.
import type { GameState } from "../game/engine";
import { announce, type TableEvent } from "./events";
import { TIMINGS, type Easing, type MotionLevel } from "./motion";

export interface Cue {
  at: number;     // ms from the start of the batch
  dur: number;    // ms
  easing: Easing;
  event: TableEvent;
}

export interface CueBatch {
  cues: Cue[];
  total: number;        // ms until the last cue ends
  announce: string;     // one sentence for aria-live
  shake: boolean;       // full motion only: lethal damage this batch
}

/** Events that happen at once (no ordering between them). */
const PARALLEL = new Set<TableEvent["kind"]>(["tapped", "drew", "turnChanged", "coach"]);

const durationOf = (e: TableEvent, t: (typeof TIMINGS)["gentle"]): number => {
  switch (e.kind) {
    case "tapped": return t.tap;
    case "spellCast": return t.lift + t.move;
    case "cardMoved": return e.to === "graveyard" ? t.destroy : t.move;
    case "countered": return t.destroy;
    case "attack": return t.move;
    case "block": return t.move;
    case "creatureDamaged": return t.number;
    case "lifeChanged": return t.number;
    case "destroyed": return t.destroy;
    case "result": return t.pulse;
    case "drew": return t.move;
    default: return 0;
  }
};

const easingOf = (e: TableEvent): Easing => (e.kind === "spellCast" || e.kind === "cardMoved" ? "out" : e.kind === "attack" ? "spring" : e.kind === "destroyed" || e.kind === "countered" ? "inOut" : "linear");

export function schedule(events: TableEvent[], level: MotionLevel, state: GameState): CueBatch {
  const t = TIMINGS[level];
  const cues: Cue[] = [];
  let cursor = 0;
  let lastSequentialEnd = 0;
  for (const e of events) {
    const dur = durationOf(e, t);
    if (PARALLEL.has(e.kind)) {
      cues.push({ at: 0, dur, easing: easingOf(e), event: e });
      lastSequentialEnd = Math.max(lastSequentialEnd, dur);
      continue;
    }
    // Numbers float alongside the cue that caused them rather than after it.
    const rides = e.kind === "lifeChanged" || e.kind === "creatureDamaged";
    const at = rides ? Math.max(0, cursor - Math.round(dur * 0.5)) : cursor;
    cues.push({ at, dur, easing: easingOf(e), event: e });
    if (!rides) cursor = at + Math.round(dur * (1 - t.overlap)) + t.gap;
    lastSequentialEnd = Math.max(lastSequentialEnd, at + dur);
  }
  let total = lastSequentialEnd;
  // Keep every batch inside the budget: compress proportionally rather than dropping cues.
  if (t.budget > 0 && total > t.budget) {
    const k = t.budget / total;
    for (const c of cues) { c.at = Math.round(c.at * k); c.dur = Math.round(c.dur * k); }
    total = t.budget;
  }
  if (level === "off") { for (const c of cues) { c.at = 0; c.dur = 0; } total = 0; }
  const lethal = events.some((e) => e.kind === "result");
  return { cues, total, announce: announce(events, state), shake: level === "full" && lethal && t.shake > 0 };
}
