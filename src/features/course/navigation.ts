// Where the learner is in the course. Pure, so Phase 4 can save/restore it and tests can drive it.
import type { Module } from "../../content/schema";

export interface Position {
  moduleIndex: number;
  stepIndex: number;
}

export type NavAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; moduleIndex: number; stepIndex: number };

export const START: Position = { moduleIndex: 0, stepIndex: 0 };

/** Keeps a position inside the course, e.g. after content changed between visits. */
export function clampPosition(modules: readonly Module[], p: Position): Position {
  if (modules.length === 0) return START;
  const moduleIndex = Math.min(Math.max(0, p.moduleIndex), modules.length - 1);
  const steps = modules[moduleIndex]?.steps.length ?? 1;
  const stepIndex = Math.min(Math.max(0, p.stepIndex), steps - 1);
  return { moduleIndex, stepIndex };
}

export function isFirst(p: Position): boolean {
  return p.moduleIndex === 0 && p.stepIndex === 0;
}

export function isLast(modules: readonly Module[], p: Position): boolean {
  const lastModule = modules.length - 1;
  return p.moduleIndex >= lastModule && p.stepIndex >= (modules[lastModule]?.steps.length ?? 1) - 1;
}

export function navigate(modules: readonly Module[], p: Position, action: NavAction): Position {
  switch (action.type) {
    case "goto":
      return clampPosition(modules, { moduleIndex: action.moduleIndex, stepIndex: action.stepIndex });
    case "next": {
      if (isLast(modules, p)) return p;
      const steps = modules[p.moduleIndex]?.steps.length ?? 0;
      return p.stepIndex + 1 < steps ? { ...p, stepIndex: p.stepIndex + 1 } : { moduleIndex: p.moduleIndex + 1, stepIndex: 0 };
    }
    case "back": {
      if (isFirst(p)) return p;
      if (p.stepIndex > 0) return { ...p, stepIndex: p.stepIndex - 1 };
      const prevSteps = modules[p.moduleIndex - 1]?.steps.length ?? 1;
      return { moduleIndex: p.moduleIndex - 1, stepIndex: prevSteps - 1 };
    }
  }
}
