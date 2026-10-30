import { describe, expect, it } from "vitest";
import type { Module } from "../../content/schema";
import {
  EMPTY_PROGRESS,
  courseStats,
  hasSavedProgress,
  isStepDone,
  positionOf,
  progressReducer,
  sanitizeProgress,
  type Progress,
  type ProgressAction,
} from "./progress";

const check = { question: "Q?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a", hint: "H" };
const modules = [
  { id: "m1", checklist: [{ id: "c1", label: "L" }, { id: "c2", label: "L" }], steps: [{ id: "s1" }, { id: "s2", check }] },
  { id: "m2", checklist: [], steps: [{ id: "s1" }] },
] as unknown as Module[];
const [m1, m2] = modules as [Module, Module];

const run = (...actions: ProgressAction[]): Progress => actions.reduce(progressReducer, { ...EMPTY_PROGRESS });

describe("progress", () => {
  it("remembers where the learner is, without counting a step as done just for opening it", () => {
    const p = run({ type: "open", moduleId: "m1", stepId: "s1" }, { type: "open", moduleId: "m1", stepId: "s2" });
    expect(p.at).toEqual({ moduleId: "m1", stepId: "s2" });
    expect(p.completed).toEqual([]);
    expect(courseStats(p, modules).percent).toBe(0);
    expect(positionOf(p, modules)).toEqual({ moduleIndex: 0, stepIndex: 1 });
  });

  it("only counts a step with a check as done after a correct answer", () => {
    let p = run({ type: "complete", moduleId: "m1", stepId: "s2" });
    expect(isStepDone(p, m1, "s2")).toBe(false);
    p = progressReducer(p, { type: "passCheck", moduleId: "m1", stepId: "s2" });
    expect(isStepDone(p, m1, "s2")).toBe(true);
  });

  it("calculates course percentage from done steps", () => {
    const p = run({ type: "complete", moduleId: "m1", stepId: "s1" }, { type: "complete", moduleId: "m2", stepId: "s1" });
    expect(courseStats(p, modules)).toEqual({ done: 2, total: 3, percent: 67 });
    expect(isStepDone(p, m2, "s1")).toBe(true);
  });

  it("ticks and unticks checklist items", () => {
    let p = run({ type: "toggleChecklist", moduleId: "m1", itemId: "c1" });
    expect(p.checklist.m1).toEqual(["c1"]);
    p = progressReducer(p, { type: "toggleChecklist", moduleId: "m1", itemId: "c1" });
    expect(p.checklist.m1).toEqual([]);
  });

  it("only offers 'welcome back' when there is real progress", () => {
    expect(hasSavedProgress(run({ type: "open", moduleId: "m1", stepId: "s1" }))).toBe(false);
    expect(hasSavedProgress(run({ type: "complete", moduleId: "m1", stepId: "s1" }))).toBe(true);
    expect(hasSavedProgress(run({ type: "toggleChecklist", moduleId: "m1", itemId: "c2" }))).toBe(true);
  });

  it("start over clears everything", () => {
    const p = run({ type: "open", moduleId: "m1", stepId: "s2" }, { type: "passCheck", moduleId: "m1", stepId: "s2" }, { type: "reset" });
    expect(p).toEqual(EMPTY_PROGRESS);
  });

  it("repairs saved data from older or changed content instead of crashing", () => {
    expect(sanitizeProgress("garbage", modules)).toEqual(EMPTY_PROGRESS);
    const saved = {
      at: { moduleId: "deleted-module", stepId: "x" },
      completed: ["m1/s1", "m1/s1", "gone/step", 42],
      passed: ["m1/s2"],
      checklist: { m1: ["c1", "removed-item"], ghost: ["c1"] },
    };
    expect(sanitizeProgress(saved, modules)).toEqual({ v: 1, at: null, completed: ["m1/s1"], passed: ["m1/s2"], checklist: { m1: ["c1"] } });
  });
});
