// A tappable zone on the example card. It is a real button (keyboard works), lights up when chosen,
// and carries a visible label on tap. Children draw the zone's content.
import type { ReactNode } from "react";

export function Hotspot({ id, label, lit, onPick, children, className = "" }: { id: string; label: string; lit: boolean; onPick: (id: string) => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" data-zone={id} data-lit={lit} aria-pressed={lit} onClick={() => onPick(id)} className={`card-zone block min-h-[2.2rem] w-full rounded-sm text-left ${className}`}>
      <span className="sr-only">{label}: </span>{children}
    </button>
  );
}
