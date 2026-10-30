// Learner progress: pure data + pure functions, saved to localStorage after every action.
// Everything is stored by module/step/checklist ID (not by position), so adding, removing or
// reordering lessons later never scrambles a learner's progress.
import type { Module } from "../../content/schema";

export const PROGRESS_VERSION = 1;

/** "moduleId/stepId" — one key per step. */
export type StepKey = string;
export const stepKey = (moduleId: string, stepId: string): StepKey => `${moduleId}/${stepId}`;

export interface Progress {
  v: typeof PROGRESS_VERSION;
  /** Where the learner is (null = never started). */
  at: { moduleId: string; stepId: string } | null;
  /** Steps the learner finished by moving on with Next (or Finish). */
  completed: StepKey[];
  /** Steps whose check question was answered correctly. */
  passed: StepKey[];
  /** Ticked checklist items per module. */
  checklist: Record<string, string[]>;
  /** Practice Table scenarios the learner has completed. */
  scenarios: string[];
}

export const EMPTY_PROGRESS: Readonly<Progress> = Object.freeze({ v: PROGRESS_VERSION, at: null, completed: [], passed: [], checklist: {}, scenarios: [] });

export type ProgressAction =
  | { type: "open"; moduleId: string; stepId: string } // learner is on this step (saves the place)
  | { type: "complete"; moduleId: string; stepId: string } // learner moved on from this step
  | { type: "passCheck"; moduleId: string; stepId: string }
  | { type: "toggleChecklist"; moduleId: string; itemId: string }
  | { type: "completeScenario"; scenarioId: string }
  | { type: "reset" };

const addOnce = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? [...list] : [...list, item]);

export function progressReducer(state: Progress, action: ProgressAction): Progress {
  switch (action.type) {
    case "open": {
      const same = state.at?.moduleId === action.moduleId && state.at.stepId === action.stepId;
      return same ? state : { ...state, at: { moduleId: action.moduleId, stepId: action.stepId } };
    }
    case "complete": {
      const key = stepKey(action.moduleId, action.stepId);
      return state.completed.includes(key) ? state : { ...state, completed: addOnce(state.completed, key) };
    }
    case "passCheck": {
      const key = stepKey(action.moduleId, action.stepId);
      return state.passed.includes(key) ? state : { ...state, passed: [...state.passed, key] };
    }
    case "toggleChecklist": {
      const ticked = state.checklist[action.moduleId] ?? [];
      const next = ticked.includes(action.itemId) ? ticked.filter((i) => i !== action.itemId) : [...ticked, action.itemId];
      return { ...state, checklist: { ...state.checklist, [action.moduleId]: next } };
    }
    case "completeScenario":
      return state.scenarios.includes(action.scenarioId) ? state : { ...state, scenarios: [...state.scenarios, action.scenarioId] };
    case "reset":
      return { ...EMPTY_PROGRESS, completed: [], passed: [], checklist: {}, scenarios: [] };
  }
}

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

/**
 * Turns saved data (possibly old, corrupted, or from before content changed) into valid progress.
 * Unknown modules, steps and checklist items are dropped quietly.
 */
export function sanitizeProgress(raw: unknown, modules: readonly Module[]): Progress {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const validSteps = new Set(modules.flatMap((m) => m.steps.map((s) => stepKey(m.id, s.id))));
  const at = r.at as { moduleId?: unknown; stepId?: unknown } | null | undefined;
  const atOk = at && typeof at.moduleId === "string" && typeof at.stepId === "string" && validSteps.has(stepKey(at.moduleId, at.stepId));
  const checklistRaw = (r.checklist && typeof r.checklist === "object" ? r.checklist : {}) as Record<string, unknown>;
  const checklist: Record<string, string[]> = {};
  for (const m of modules) {
    const valid = new Set(m.checklist.map((c) => c.id));
    const ticked = [...new Set(strings(checklistRaw[m.id]))].filter((id) => valid.has(id));
    if (ticked.length) checklist[m.id] = ticked;
  }
  return {
    v: PROGRESS_VERSION,
    at: atOk ? { moduleId: at.moduleId as string, stepId: at.stepId as string } : null,
    completed: [...new Set(strings(r.completed))].filter((k) => validSteps.has(k)),
    passed: [...new Set(strings(r.passed))].filter((k) => validSteps.has(k)),
    checklist,
    scenarios: [...new Set(strings(r.scenarios))],
  };
}

/* ---------- selectors ---------- */

/** A step is done once the learner moved on from it, and its check (if it has one) was answered correctly. */
export function isStepDone(p: Progress, m: Module, stepId: string): boolean {
  const key = stepKey(m.id, stepId);
  const step = m.steps.find((s) => s.id === stepId);
  if (!step || !p.completed.includes(key)) return false;
  return !step.check || p.passed.includes(key);
}

export function moduleStats(p: Progress, m: Module): { done: number; total: number } {
  return { done: m.steps.filter((s) => isStepDone(p, m, s.id)).length, total: m.steps.length };
}

export function courseStats(p: Progress, modules: readonly Module[]): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const m of modules) {
    const s = moduleStats(p, m);
    done += s.done;
    total += s.total;
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** True when there's enough saved progress to offer "Welcome back, continue?". */
export function hasSavedProgress(p: Progress): boolean {
  const ticks = Object.values(p.checklist).some((l) => l.length > 0);
  return p.completed.length > 0 || p.passed.length > 0 || ticks || p.scenarios.length > 0;
}

/** Converts the saved location into a position (module and step numbers) for navigation. */
export function positionOf(p: Progress, modules: readonly Module[]): { moduleIndex: number; stepIndex: number } {
  if (!p.at) return { moduleIndex: 0, stepIndex: 0 };
  const moduleIndex = modules.findIndex((m) => m.id === p.at?.moduleId);
  if (moduleIndex < 0) return { moduleIndex: 0, stepIndex: 0 };
  const stepIndex = modules[moduleIndex]?.steps.findIndex((s) => s.id === p.at?.stepId) ?? -1;
  return { moduleIndex, stepIndex: Math.max(0, stepIndex) };
}
