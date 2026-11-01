// A calm note with an icon and a visible word, so meaning never rides on colour alone.
import type { ReactNode } from "react";
import { Icon } from "../Icon";

type Kind = "info" | "success" | "changes" | "unsure";

const KIND: Record<Kind, { box: string; icon: "info" | "check"; word: string }> = {
  info: { box: "bg-hint-soft", icon: "info", word: "Note" },
  success: { box: "bg-success-soft", icon: "check", word: "Done" },
  changes: { box: "bg-accent-soft", icon: "info", word: "Rules change, check the current list" },
  unsure: { box: "bg-error-soft", icon: "info", word: "Not sure" },
};

export function Callout({ kind = "info", children, lastVerified }: { kind?: Kind; children: ReactNode; lastVerified?: string | undefined }) {
  const k = KIND[kind];
  return (
    <div role="note" className={`grid gap-s1 rounded-md p-s3 ${k.box}`}>
      <p className="flex items-center gap-s2 font-bold"><Icon name={k.icon} size={1.1} /> {k.word}</p>
      <div>{children}</div>
      {lastVerified && <p className="text-sm text-text-muted">Last checked {lastVerified}.</p>}
    </div>
  );
}
