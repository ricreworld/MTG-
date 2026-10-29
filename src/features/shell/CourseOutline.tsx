// The course outline (sidebar). On small screens it collapses into a "Course outline" disclosure.
import type { Module } from "../../content/schema";
import type { Position } from "../course/navigation";

interface Props {
  modules: readonly Module[];
  position: Position;
  onGo: (moduleIndex: number, stepIndex: number) => void;
}

function OutlineList({ modules, position, onGo }: Props) {
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
                      current ? "bg-accent-soft font-bold" : "hover:bg-surface-2"
                    }`}
                  >
                    {/* The arrow marks the current step, so it isn't shown by colour alone. */}
                    <span aria-hidden="true" className="w-s4 font-mono">{current ? "▸" : ""}</span>
                    <span>{s.title}</span>
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

export function CourseOutline(props: Props) {
  return (
    <>
      <nav aria-label="Course outline" className="hidden lg:block">
        <h2 className="mb-s4 text-lg font-bold">Course outline</h2>
        <OutlineList {...props} />
      </nav>
      <details className="rounded-lg border border-border bg-surface p-s4 lg:hidden">
        <summary className="min-h-tap cursor-pointer content-center font-bold">Course outline</summary>
        <nav aria-label="Course outline" className="mt-s4">
          <OutlineList {...props} />
        </nav>
      </details>
    </>
  );
}
