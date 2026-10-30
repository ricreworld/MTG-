// Motion levels and timing. Everything the view animates is driven from these numbers,
// so "Off" is exactly zero motion and "Gentle" never exceeds the per-batch budget.
export type MotionLevel = "off" | "gentle" | "full";

export type Easing = "linear" | "out" | "inOut" | "spring";

/** CSS easing strings for the Web Animations API. */
export const EASING_CSS: Record<Easing, string> = {
  linear: "linear",
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export interface Timings {
  tap: number;        // a card turning sideways
  move: number;       // a card sliding between zones
  lift: number;       // a card lifting before it moves
  number: number;     // a floating damage/life number
  pulse: number;      // the next-button pulse after a state change
  destroy: number;    // fade + slide to the graveyard
  gap: number;        // pause between sequential cues
  shake: number;      // screen shake (full only, lethal only)
  budget: number;     // the most a whole batch may take; longer batches are compressed
  overlap: number;    // 0..1, how much sequential cues overlap (full packs them tighter)
}

export const TIMINGS: Record<MotionLevel, Timings> = {
  off: { tap: 0, move: 0, lift: 0, number: 0, pulse: 0, destroy: 0, gap: 0, shake: 0, budget: 0, overlap: 0 },
  gentle: { tap: 160, move: 260, lift: 120, number: 700, pulse: 300, destroy: 300, gap: 60, shake: 0, budget: 1200, overlap: 0 },
  full: { tap: 140, move: 220, lift: 100, number: 650, pulse: 260, destroy: 280, gap: 30, shake: 120, budget: 1400, overlap: 0.35 },
};
