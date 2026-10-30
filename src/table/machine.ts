// The table's state machine. Owns the game history, runs the engine and the computer opponent
// through the scenario, diffs the result into events, schedules cues, and locks input while they play.
// No React, no DOM: the view subscribes and renders whatever `snapshot()` says.
import { canPay, commanderCost, def, tapLandsFor, type Action, type GameState } from "../game/engine";
import { step as applyStep, type Scenario } from "../game/scenarios";
import { schedule, type CueBatch } from "./director";
import { diff, type TableEvent } from "./events";
import type { MotionLevel } from "./motion";

export type TableMode = "SETUP" | "PLAYING" | "PAUSED" | "VICTORY" | "DEFEAT" | "REVIEW";

export interface Feedback { kind: "hint" | "coach" | "done" | "opp"; text: string; lines?: string[] }

export interface Snapshot {
  mode: TableMode;
  state: GameState;
  canUndo: boolean;
  pending: CueBatch | null;    // cues the view should play; input is locked while non-null
  feedback: Feedback | null;
  hintIndex: number;
  motion: MotionLevel;
  sound: boolean;
}

export interface MachineOptions {
  scenario: Scenario;
  motion: MotionLevel;
  sound: boolean;
  /** Pay mana automatically when casting from hand / the command zone. */
  autoMana: boolean;
  /** Resolve the learner's own spells automatically when the computer doesn't respond. */
  autoResolve: boolean;
}

type Listener = (snap: Snapshot) => void;

export class TableMachine {
  private history: GameState[] = [];
  private mode: TableMode = "SETUP";
  private pending: CueBatch | null = null;
  private feedback: Feedback | null = null;
  private hintIndex = 0;
  private listeners = new Set<Listener>();
  private recent: { events: TableEvent[]; at: number }[] = [];
  private opts: MachineOptions;
  private cached: Snapshot | null = null; // same reference until something changes (useSyncExternalStore needs that)

  constructor(opts: MachineOptions) { this.opts = opts; }

  /* ---------- lifecycle ---------- */

  start(): Snapshot {
    this.history = [this.opts.scenario.setup()];
    this.mode = "PLAYING";
    this.pending = null;
    this.feedback = null;
    this.hintIndex = 0;
    return this.emit();
  }

  configure(patch: Partial<Pick<MachineOptions, "motion" | "sound" | "autoMana" | "autoResolve">>): Snapshot {
    this.opts = { ...this.opts, ...patch };
    return this.emit();
  }

  pause(): Snapshot { if (this.mode === "PLAYING") this.mode = "PAUSED"; return this.emit(); }
  resume(): Snapshot { if (this.mode === "PAUSED") this.mode = "PLAYING"; return this.emit(); }
  review(): Snapshot { if (this.mode === "VICTORY" || this.mode === "DEFEAT") this.mode = "REVIEW"; return this.emit(); }

  /** The view calls this when the batch's cues have finished (or were skipped). */
  cuesDone(): Snapshot { this.pending = null; return this.emit(); }

  subscribe(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  snapshot(): Snapshot {
    if (this.cached) return this.cached;
    const state = this.state;
    this.cached = { mode: this.mode, state, canUndo: this.history.length > 1, pending: this.pending, feedback: this.feedback, hintIndex: this.hintIndex, motion: this.opts.motion, sound: this.opts.sound };
    return this.cached;
  }

  /** The last 50 event batches, for the debug panel. */
  recentEvents(): { events: TableEvent[]; at: number }[] { return this.recent; }

  get state(): GameState { return this.history[this.history.length - 1]!; }
  get scenario(): Scenario { return this.opts.scenario; }

  /* ---------- input ---------- */

  /** Runs a learner action. Returns the batch to play, or null if the input was refused or locked. */
  act(action: Action): CueBatch | null {
    if (this.mode !== "PLAYING") return null;
    if (this.pending && this.pending.total > 0) return null; // input locked while cues play
    const before = this.state;
    let next = applyStep(this.opts.scenario, before, action);
    if (next.refusal) { this.feedback = { kind: "hint", text: next.refusal }; this.emit(); return null; }
    const coachNote = this.opts.scenario.coach?.(before, next, action) ?? null;
    let guard = 0;
    while (this.opts.autoResolve && !next.result && next.stack.length && next.stack[next.stack.length - 1]?.caster === "you" && guard++ < 5) {
      const r = applyStep(this.opts.scenario, next, { type: "pass" });
      if (r.refusal) break;
      next = r;
    }
    return this.commit(before, next, action, coachNote);
  }

  /** Casts a card from hand, paying its mana first when autoMana is on. */
  castFromHand(uid: string): CueBatch | null {
    const s = this.state;
    const card = def(s.cards[uid] ?? "");
    if (card.kind === "land") return this.act({ type: "playLand", uid });
    if (this.opts.autoMana && card.cost && !canPay(s.you.pool, card.cost)) {
      const paid = tapLandsFor(s, "you", card.cost);
      if (paid) return this.actFrom(paid, { type: "cast", uid });
    }
    return this.act({ type: "cast", uid });
  }

  castCommander(): CueBatch | null {
    const s = this.state;
    const cost = commanderCost(s, "you") ?? "";
    if (this.opts.autoMana && !canPay(s.you.pool, cost)) {
      const paid = tapLandsFor(s, "you", cost);
      if (paid) return this.actFrom(paid, { type: "castCommander" });
    }
    return this.act({ type: "castCommander" });
  }

  /** Skip combat and end the turn as one move (the "End turn" button in the first main phase). */
  endTurnFromMain1(): CueBatch | null {
    const s = this.state;
    const skipped = applyStep(this.opts.scenario, s, { type: "skipCombat" });
    return this.actFrom(skipped.refusal ? s : skipped, { type: "endTurn" });
  }

  undo(): Snapshot {
    if (this.history.length > 1) {
      this.history = this.history.slice(0, -1);
      this.pending = null; // undoing mid-batch drops the cues; the view re-renders the earlier state
      this.feedback = null;
      if (this.mode === "VICTORY" || this.mode === "DEFEAT" || this.mode === "REVIEW") this.mode = "PLAYING";
    }
    return this.emit();
  }

  restart(): Snapshot { return this.start(); }

  hint(): Snapshot {
    const hints = this.opts.scenario.hints;
    this.feedback = { kind: "hint", text: hints[Math.min(this.hintIndex, hints.length - 1)] ?? "" };
    this.hintIndex = Math.min(this.hintIndex + 1, hints.length - 1);
    return this.emit();
  }

  say(text: string): Snapshot { this.feedback = { kind: "hint", text }; return this.emit(); }
  clearFeedback(): Snapshot { this.feedback = null; return this.emit(); }

  /* ---------- internals ---------- */

  private actFrom(from: GameState, action: Action): CueBatch | null {
    if (this.mode !== "PLAYING") return null;
    if (this.pending && this.pending.total > 0) return null;
    const before = this.state;
    let next = applyStep(this.opts.scenario, from, action);
    if (next.refusal) { this.feedback = { kind: "hint", text: next.refusal }; this.emit(); return null; }
    const coachNote = this.opts.scenario.coach?.(before, next, action) ?? null;
    let guard = 0;
    while (this.opts.autoResolve && !next.result && next.stack.length && next.stack[next.stack.length - 1]?.caster === "you" && guard++ < 5) {
      const r = applyStep(this.opts.scenario, next, { type: "pass" });
      if (r.refusal) break;
      next = r;
    }
    return this.commit(before, next, action, coachNote);
  }

  private commit(before: GameState, next: GameState, action: Action, coachNote: string | null): CueBatch {
    const events = diff(before, next, action);
    if (coachNote) events.push({ kind: "coach", text: coachNote, undoable: true });
    const batch = schedule(events, this.opts.motion, next);
    this.history = [...this.history, next];
    this.recent = [...this.recent.slice(-49), { events, at: Date.now() }];
    this.pending = batch.total > 0 ? batch : null;
    if (next.result === "win") this.mode = "VICTORY";
    else if (next.result === "lose") this.mode = "DEFEAT";

    const fresh = next.log.slice(before.log.length).filter((l) => /^Your opponent|^Commander damage|^Blocks:|on your opponent's side|^\(Why:/.test(l));
    const oppActed = next.turn === "you" && (action.type === "endTurn" || action.type === "pass" || action.type === "declareBlockers" || action.type === "dealDamage") && fresh.length > 0;
    if (coachNote) this.feedback = { kind: "coach", text: coachNote };
    else if (next.result === "win") this.feedback = { kind: "done", text: this.opts.scenario.advise ? "You won the game. Well played!" : "Goal reached. Nice work!" };
    else if (this.opts.scenario.isComplete(next) && !this.opts.scenario.advise) this.feedback = { kind: "done", text: "Goal reached. Nice work!" };
    else if (oppActed) this.feedback = { kind: "opp", text: "While you waited, your opponent:", lines: fresh.map((l) => l.replace(/^Your opponent /, "").replace(/^\(Why: (.*)\)$/, "Why: $1")) };
    else this.feedback = null;
    this.emit();
    return batch;
  }

  private emit(): Snapshot {
    this.cached = null;
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
    return snap;
  }
}
