// Debug hooks: window.__manaSteps lets you inspect and drive the table from the browser console.
// Installed only while a table is mounted; harmless if called when none is.
import type { Action, GameState } from "../game/engine";
import type { TableMachine } from "./machine";

export interface DebugApi {
  state(): GameState;
  snapshot(): ReturnType<TableMachine["snapshot"]>;
  act(action: Action): unknown;
  events(): ReturnType<TableMachine["recentEvents"]>;
  skip(): void;
  fps(): { frames: number; worstMs: number; avgMs: number };
  setMotion(level: "off" | "gentle" | "full"): void;
}

declare global { interface Window { __manaSteps?: DebugApi } }

/** Frame timing while cues play: counts rAF ticks and the worst gap between them. */
export class FrameMeter {
  frames = 0; worstMs = 0; totalMs = 0;
  private last = 0; private handle = 0; private running = false;
  start() { if (this.running) return; this.running = true; this.frames = 0; this.worstMs = 0; this.totalMs = 0; this.last = performance.now(); const tick = (now: number) => { if (!this.running) return; const d = now - this.last; this.last = now; this.frames++; this.totalMs += d; if (d > this.worstMs) this.worstMs = d; this.handle = requestAnimationFrame(tick); }; this.handle = requestAnimationFrame(tick); }
  stop() { this.running = false; cancelAnimationFrame(this.handle); }
  read() { return { frames: this.frames, worstMs: Math.round(this.worstMs * 10) / 10, avgMs: this.frames ? Math.round((this.totalMs / this.frames) * 10) / 10 : 0 }; }
}

export function installDebug(machine: TableMachine, skip: () => void, meter: FrameMeter, setMotion: (l: "off" | "gentle" | "full") => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.__manaSteps = {
    state: () => machine.state,
    snapshot: () => machine.snapshot(),
    act: (action) => machine.act(action),
    events: () => machine.recentEvents(),
    skip,
    fps: () => meter.read(),
    setMotion,
  };
  return () => { delete window.__manaSteps; };
}
