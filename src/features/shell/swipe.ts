// Decides whether a finished touch counts as a deliberate sideways swipe.
// Strict on purpose: long, fast-enough, and clearly horizontal, so scrolling never changes the step.

export interface TouchPoint {
  x: number;
  y: number;
  t: number; // milliseconds
}

export const SWIPE_MIN_DISTANCE = 70; // px
export const SWIPE_MAX_DURATION = 600; // ms
export const SWIPE_DIRECTION_RATIO = 2; // horizontal movement must be at least 2x the vertical

/** Swipe left (finger moves left) = next step; swipe right = back. */
export function detectSwipe(start: TouchPoint, end: TouchPoint): "next" | "back" | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (end.t - start.t > SWIPE_MAX_DURATION) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return null;
  return dx < 0 ? "next" : "back";
}
