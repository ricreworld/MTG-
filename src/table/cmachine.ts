// The four-player table's state machine: history for Undo, the human's reducer, the three computer
// players (one small step at a time so the human can respond or block), event diffing, cue scheduling,
// and saving after every move so the game can be picked up later.
import { aiStep, needsHuman } from "../game/commander/ai";
import { advise } from "../game/commander/coach";
import { allBlocksIn, player, reduce, type Action, type CState } from "../game/commander/engine";
import { saveGame } from "../game/commander/save";
import { cannounce, cdiff } from "./cevents";
import { schedule, type CueBatch } from "./director";
import type { TableEvent } from "./events";
import type { MotionLevel } from "./motion";

export type CMode = "PLAYING" | "VICTORY" | "DEFEAT";
export interface CFeedback { kind: "hint" | "coach" | "done" | "opp"; text: string; lines?: string[] }

export interface CSnapshot {
  mode: CMode;
  state: CState;
  canUndo: boolean;
  pending: CueBatch | null;
  feedback: CFeedback | null;
  motion: MotionLevel;
  sound: boolean;
  /** True while computer players are between steps (the view shows "the table is playing"). */
  othersPlaying: boolean;
}

export interface CMachineOptions { initial: CState; deckId: string; motion: MotionLevel; sound: boolean; autoResolve: boolean; save: boolean }

type Listener = (snap: CSnapshot) => void;

const HINTS = [
  "Each turn: play a land, cast what you can, attack the player who is winning, end your turn.",
  "Your commander is always in reach. Cast it from the command zone and attack with it: 21 damage from one commander ends a game on its own.",
  "With three opponents, don't be the biggest threat too early. Build up, then strike.",
  "Block when your creature destroys the attacker and survives. At 40 life, small hits don't matter much.",
  "Tap a card on the table to see what it can do. Undo takes back any of your moves.",
];

export class CommanderMachine {
  private history: CState[] = [];
  private mode: CMode = "PLAYING";
  private pending: CueBatch | null = null;
  private feedback: CFeedback | null = null;
  private hintIndex = 0;
  private listeners = new Set<Listener>();
  private cached: CSnapshot | null = null;
  private opts: CMachineOptions;
  private recent: { events: TableEvent[]; at: number }[] = [];

  constructor(opts: CMachineOptions) { this.opts = opts; }

  start(): CSnapshot {
    this.history = [this.opts.initial];
    this.mode = this.opts.initial.winner ? (this.opts.initial.winner === this.opts.initial.human ? "VICTORY" : "DEFEAT") : "PLAYING";
    this.pending = null; this.feedback = null;
    // If the saved game stopped while the computers were playing, finish their moves now.
    const before = this.state;
    const next = this.advance(before);
    if (next !== before) this.commit(before, next, null);
    return this.emit();
  }

  configure(patch: Partial<Pick<CMachineOptions, "motion" | "sound" | "autoResolve">>): CSnapshot { this.opts = { ...this.opts, ...patch }; return this.emit(); }
  cuesDone(): CSnapshot { this.pending = null; return this.emit(); }
  subscribe(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get state(): CState { return this.history[this.history.length - 1]!; }
  recentEvents() { return this.recent; }

  snapshot(): CSnapshot {
    if (this.cached) return this.cached;
    const state = this.state;
    this.cached = { mode: this.mode, state, canUndo: this.history.length > 1, pending: this.pending, feedback: this.feedback, motion: this.opts.motion, sound: this.opts.sound, othersPlaying: !state.winner && state.turn !== state.human && !needsHuman(state) };
    return this.cached;
  }

  /** The human acts; then the computers play until the human is needed again. */
  act(action: Action): CueBatch | null {
    if (this.mode !== "PLAYING") return null;
    if (this.pending && this.pending.total > 0) return null;
    const before = this.state;
    let next = reduce(before, action);
    if (next.refusal) { this.feedback = { kind: "hint", text: next.refusal }; this.emit(); return null; }
    const afterOwn = next;
    next = this.advance(next);
    const coachNote = coachLine(before, afterOwn, action);
    return this.commit(before, next, coachNote);
  }

  /** Skip combat and end the turn as one move (the "End turn" button in the first main phase). */
  endTurnFromMain1(): CueBatch | null {
    if (this.mode !== "PLAYING") return null;
    if (this.pending && this.pending.total > 0) return null;
    const before = this.state;
    const skipped = reduce(before, { type: "skipCombat" });
    let next = reduce(skipped.refusal ? before : skipped, { type: "endTurn" });
    if (next.refusal) { this.feedback = { kind: "hint", text: next.refusal }; this.emit(); return null; }
    const coachNote = coachLine(before, next, { type: "endTurn" });
    next = this.advance(next);
    return this.commit(before, next, coachNote);
  }

  /** Lets the computers continue (used by the "Continue" button when nothing is asked of the human). */
  continueOthers(): CueBatch | null {
    if (this.mode !== "PLAYING") return null;
    const before = this.state;
    const next = this.advance(before, true);
    if (next === before) return null;
    return this.commit(before, next, null);
  }

  undo(): CSnapshot {
    if (this.history.length > 1) { this.history = this.history.slice(0, -1); this.pending = null; this.feedback = null; this.mode = "PLAYING"; this.persist(); }
    return this.emit();
  }

  hint(): CSnapshot { this.feedback = { kind: "hint", text: HINTS[Math.min(this.hintIndex, HINTS.length - 1)]! }; this.hintIndex = Math.min(this.hintIndex + 1, HINTS.length - 1); return this.emit(); }
  say(text: string): CSnapshot { this.feedback = { kind: "hint", text }; return this.emit(); }
  clearFeedback(): CSnapshot { this.feedback = null; return this.emit(); }

  /* ---------- internals ---------- */

  /** Runs the stack and the computer players until the human is needed again. */
  private advance(s: CState, force = false): CState {
    let st = s;
    for (let guard = 0; guard < 400; guard++) {
      if (st.winner) break;
      const top = st.stack[st.stack.length - 1];
      if (top && top.caster === st.human && !this.opts.autoResolve && !force) break;
      if (needsHuman(st) && !(top && top.caster === st.human)) break;
      if (st.turn === st.human && !st.stack.length) {
        if (st.step === "blockers" && !allBlocksIn(st)) { const r = aiStep(st); if (r === st) break; st = r; continue; }
        break;
      }
      const r = aiStep(st);
      if (r === st) break;
      st = r;
    }
    return st;
  }

  private commit(before: CState, next: CState, coachNote: string | null): CueBatch {
    const events = cdiff(before, next);
    if (coachNote) events.push({ kind: "coach", text: coachNote, undoable: true });
    const batch = schedule(events, this.opts.motion, null, cannounce(events, next));
    this.history = [...this.history.slice(-60), next];
    this.recent = [...this.recent.slice(-49), { events, at: Date.now() }];
    this.pending = batch.total > 0 ? batch : null;
    if (next.winner) this.mode = next.winner === next.human ? "VICTORY" : "DEFEAT";
    else if (player(next, next.human).out) this.mode = "DEFEAT";
    const fresh = next.log.slice(before.log.length).filter((l) => !/^\(Why|^—/.test(l) && !l.startsWith("You "));
    const others = next.turn === next.human && fresh.length > 0 && before.turn !== next.human;
    if (coachNote) this.feedback = { kind: "coach", text: coachNote };
    else if (next.winner === next.human) this.feedback = { kind: "done", text: "You're the last player standing. You won the game!" };
    else if (this.mode === "DEFEAT") this.feedback = { kind: "done", text: player(next, next.human).outReason ?? "The game is over." };
    else if (others) this.feedback = { kind: "opp", text: "While you waited, around the table:", lines: summarise(fresh) };
    else this.feedback = null;
    this.persist();
    this.emit();
    return batch;
  }

  private persist() { if (this.opts.save) saveGame(this.state, this.opts.deckId); }

  private emit(): CSnapshot { this.cached = null; const snap = this.snapshot(); for (const fn of this.listeners) fn(snap); return snap; }
}

/** The most important lines of what other players did, at most eight. */
function summarise(lines: string[]): string[] {
  const keep = lines.filter((l) => /casts|attacks|destroys|exiles|loses \d+ life|out of the game|counters|is destroyed|returns/.test(l));
  return (keep.length ? keep : lines).slice(-8);
}

/** A gentle note when a move was clearly weaker than the coach's suggestion. */
function coachLine(before: CState, after: CState, action: Action): string | null {
  if (action.type !== "endTurn" && action.type !== "skipCombat") return null;
  const a = advise(before);
  if (!a) return null;
  if (action.type === "skipCombat" && /Go to combat/.test(a.move)) return `You skipped combat. ${a.move} ${a.why}`;
  if (action.type === "endTurn" && /^Cast|^Play a land/.test(a.move) && before.step !== "attackers") return `You ended the turn with something left to do. ${a.move} ${a.why}`;
  void after;
  return null;
}
