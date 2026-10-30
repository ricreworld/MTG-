// The debug panel: state machine mode, engine step, pending cues, recent events and frame timing.
// Shown only when Settings > Debug panel is on.
import type { Snapshot, TableMachine } from "../../table/machine";

interface Props { snap: Snapshot; machine: TableMachine; fps: { frames: number; worstMs: number; avgMs: number } | null }

export function DebugPanel({ snap, machine, fps }: Props) {
  const recent = machine.recentEvents().slice(-6).reverse();
  return (
    <details open className="rounded-lg border-2 border-dashed border-border-strong bg-surface p-s3 font-mono text-xs">
      <summary className="min-h-tap cursor-pointer content-center font-bold">Debug</summary>
      <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s3 gap-y-s1">
        <dt>mode</dt><dd>{snap.mode}</dd>
        <dt>turn/step</dt><dd>{snap.state.turn} / {snap.state.step} / turn {snap.state.turnNumber}</dd>
        <dt>stack</dt><dd>{snap.state.stack.map((x) => `${x.caster}:${x.card}`).join(", ") || "empty"}</dd>
        <dt>pending</dt><dd>{snap.pending ? `${snap.pending.cues.length} cues, ${snap.pending.total} ms` : "none"}</dd>
        <dt>motion/sound</dt><dd>{snap.motion} / {snap.sound ? "on" : "off"}</dd>
        <dt>frames</dt><dd>{fps ? `${fps.frames} frames, avg ${fps.avgMs} ms, worst ${fps.worstMs} ms` : "no batch measured yet"}</dd>
        <dt>history</dt><dd>{snap.canUndo ? "undo available" : "at start"}</dd>
      </dl>
      <p className="mt-s2 font-bold">Recent batches</p>
      <ol className="grid gap-s1">
        {recent.map((b, i) => <li key={b.at + "-" + i}>{b.events.map((e) => e.kind).join(" › ") || "(none)"}</li>)}
      </ol>
      <p className="mt-s2 text-text-muted">Console: window.__manaSteps.state(), .act(action), .events(), .skip(), .fps(), .setMotion("full")</p>
    </details>
  );
}
