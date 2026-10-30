// The course outline list. Phones open it with the "Outline" button (it fills the main area);
// wide screens also show it as a sidebar.
import type { Module } from "../../content/schema";
import type { Position } from "../course/navigation";

interface Props {
  modules: readonly Module[];
  position: Position;
  onGo: (moduleIndex: number, stepIndex: number) => void;
}

export function OutlineList({ modules, position, onGo }: Props) {
  return (
    <ol className="grid gap-s4">
      {modules.map((m, mi) => (
        <li key={m.id} className="grid gap-s2">
          <p className="font-bold">
            <span className="text-text-muted">Module {mi + 1}:</span> {m.title}
            <span className="block text-sm font-normal text-text-muted">About {m.estimatedMinutes} min</span>
          </p>
          <ol className="grid gap-s1">
            {m.steps.map((s, si) => {
              const current = mi === position.moduleIndex && si === position.stepIndex;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onGo(mi, si)}
                    aria-current={current ? "step" : undefined}
                    className={`flex min-h-tap w-full items-center gap-s2 rounded-md px-s3 text-left ${
                      current ? "bg-accent-soft font-bold" : "hover:bg-surface-2 active:bg-surface-2"
                    }`}
                  >
                    {/* The arrow marks the current step, so it isn't shown by colour alone. */}
                    <span aria-hidden="true" className="w-s4 shrink-0 font-mono">{current ? "▸" : ""}</span>
                    <span>{s.title}</span>
                    {current && <span className="sr-only">(you are here)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
