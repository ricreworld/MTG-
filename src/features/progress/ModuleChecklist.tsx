// A collapsible, tick-it-yourself checklist for the current module. Closed by default (less on screen).
import type { Module } from "../../content/schema";

interface Props {
  module: Module;
  ticked: readonly string[];
  onToggle: (itemId: string) => void;
}

export function ModuleChecklist({ module, ticked, onToggle }: Props) {
  if (module.checklist.length === 0) return null;
  const count = module.checklist.filter((c) => ticked.includes(c.id)).length;
  return (
    <details data-focus-hide className="rounded-lg border border-border bg-surface">
      <summary className="flex min-h-tap cursor-pointer items-center gap-s2 px-s4 py-s2 font-bold">
        <span>Module checklist</span>
        <span className="text-sm font-normal text-text-muted">{count} of {module.checklist.length} ticked</span>
      </summary>
      <fieldset className="grid gap-s2 px-s4 pb-s4">
        <legend className="sr-only">Checklist for {module.title}</legend>
        <p className="text-sm text-text-muted">Tick these off yourself whenever you feel ready. There's no rush.</p>
        {module.checklist.map((item) => {
          const checked = ticked.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex min-h-tap cursor-pointer items-center gap-s3 rounded-md border-2 px-s3 py-s2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
                checked ? "border-success bg-success-soft" : "border-border-strong bg-surface"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item.id)}
                className="h-5 w-5 shrink-0 accent-[rgb(var(--color-success))]"
              />
              <span>{item.label}</span>
            </label>
          );
        })}
      </fieldset>
    </details>
  );
}
