// Deck guides: primers written by the deck-building skills (Markdown files in src/content/guides/), readable
// at the table on a phone. A tiny Markdown subset is rendered here (headings, paragraphs, lists, bold,
// code, links) and every [[Card Name]] becomes a button that shows the card's official image from Scryfall
// when online. Drop a new .md file into src/content/guides/ and it appears in the list; no code changes.
import { forwardRef, useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";

const files = import.meta.glob<string>("../../content/guides/*.md", { eager: true, query: "?raw", import: "default" });

export interface Guide { id: string; title: string; markdown: string }

export const GUIDES: Guide[] = Object.entries(files).map(([path, markdown]) => {
  const id = path.replace(/^.*\//, "").replace(/\.md$/, "");
  const first = markdown.split("\n").find((l) => l.startsWith("# ")) ?? id;
  return { id, title: first.replace(/^# /, "").replace(/\[\[([^\]]+)\]\]/g, "$1"), markdown };
}).sort((a, b) => a.title.localeCompare(b.title));

const cardImage = (name: string) => `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(name)}`;

function Inline({ text, onCard }: { text: string; onCard: (name: string) => void }) {
  // Split on [[cards]], **bold**, `code` and [links](url), in that order of appearance.
  const parts: ReactNode[] = [];
  const re = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:[^)]+)\)/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) { const name = m[1]; parts.push(<button key={k++} type="button" onClick={() => onCard(name)} className="rounded-sm bg-accent-soft px-1 font-bold underline decoration-accent">{name}</button>); }
    else if (m[2]) parts.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) parts.push(<code key={k++} className="rounded-sm bg-surface-2 px-1 font-mono text-[0.9em]">{m[3]}</code>);
    else if (m[4]) parts.push(<a key={k++} href={m[5]} target="_blank" rel="noreferrer" className="underline">{m[4]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Renders the Markdown subset the primers use. Lines that continue a list item or paragraph are joined. */
export function Markdown({ source, onCard }: { source: string; onCard: (name: string) => void }) {
  const blocks = useMemo(() => {
    const out: { kind: "h1" | "h2" | "h3" | "p" | "ul" | "ol"; lines: string[] }[] = [];
    for (const raw of source.split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) { continue; }
      const h = /^(#{1,3}) (.*)$/.exec(line);
      if (h) { out.push({ kind: `h${h[1]!.length}` as "h1" | "h2" | "h3", lines: [h[2]!] }); continue; }
      const li = /^\s*[-*] (.*)$/.exec(line);
      const oli = /^\s*\d+\. (.*)$/.exec(line);
      const prev = out[out.length - 1];
      if (li) { if (prev?.kind === "ul") prev.lines.push(li[1]!); else out.push({ kind: "ul", lines: [li[1]!] }); continue; }
      if (oli) { if (prev?.kind === "ol") prev.lines.push(oli[1]!); else out.push({ kind: "ol", lines: [oli[1]!] }); continue; }
      // A continuation line (indented, or following a list item / paragraph) joins the previous entry.
      if (prev && (prev.kind === "ul" || prev.kind === "ol") && /^\s{2,}/.test(raw)) { prev.lines[prev.lines.length - 1] += ` ${line.trim()}`; continue; }
      if (prev?.kind === "p") { prev.lines[0] += ` ${line.trim()}`; continue; }
      out.push({ kind: "p", lines: [line.trim()] });
    }
    return out;
  }, [source]);
  return (
    <div className="grid max-w-[65ch] gap-s3">
      {blocks.map((b, i) => {
        if (b.kind === "h1") return <h3 key={i} className="text-xl font-bold"><Inline text={b.lines[0]!} onCard={onCard} /></h3>;
        if (b.kind === "h2") return <h4 key={i} className="mt-s2 text-lg font-bold"><Inline text={b.lines[0]!} onCard={onCard} /></h4>;
        if (b.kind === "h3") return <h5 key={i} className="font-bold"><Inline text={b.lines[0]!} onCard={onCard} /></h5>;
        if (b.kind === "ul") return <ul key={i} className="grid gap-s1 pl-s5">{b.lines.map((l, j) => <li key={j} className="list-disc"><Inline text={l} onCard={onCard} /></li>)}</ul>;
        if (b.kind === "ol") return <ol key={i} className="grid gap-s1 pl-s5">{b.lines.map((l, j) => <li key={j} className="list-decimal"><Inline text={l} onCard={onCard} /></li>)}</ol>;
        return <p key={i}><Inline text={b.lines[0]!} onCard={onCard} /></p>;
      })}
    </div>
  );
}

interface Props { onBack: () => void }

export const DeckGuides = forwardRef<HTMLHeadingElement, Props>(function DeckGuides({ onBack }, headingRef) {
  const [open, setOpen] = useState<string | null>(GUIDES.length === 1 ? GUIDES[0]!.id : null);
  const [card, setCard] = useState<string | null>(null);
  const guide = GUIDES.find((g) => g.id === open);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
  return (
    <section aria-labelledby="guides-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="guides-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Deck guides</h2>
        <button type="button" onClick={guide && GUIDES.length > 1 ? () => setOpen(null) : onBack} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="back" /> {guide && GUIDES.length > 1 ? "All guides" : "Back"}</button>
      </div>
      {!guide && (
        <>
          <p>Primers for real decks: how each one wins, what every card does, and how to play it turn by turn. Tap a card name to see the card.</p>
          {GUIDES.length === 0 && <p className="text-text-muted">No guides yet. Drop a primer file into the guides folder and it appears here.</p>}
          <ul className="grid gap-s2">
            {GUIDES.map((g) => <li key={g.id}><button type="button" onClick={() => setOpen(g.id)} className="grid min-h-tap w-full rounded-md border-2 border-border-strong bg-surface px-s3 py-s2 text-left font-bold hover:bg-surface-2">{g.title}</button></li>)}
          </ul>
        </>
      )}
      {guide && (
        <>
          <p className="text-sm text-text-muted">Written by the deck-building skills for a paper or online deck. Most of these cards aren't in Foundations, so the practice table can't run this deck, but you can read it at the table. Card pictures load from Scryfall when you're online.</p>
          {card && (
            <div role="dialog" aria-label={`Card: ${card}`} className="grid justify-items-start gap-s2 rounded-md border-2 border-accent bg-surface-2 p-s3">
              <p className="font-bold">{card}</p>
              <img src={cardImage(card)} alt={`${card}, official card image`} className="w-[16rem] max-w-full rounded-lg" loading="lazy" />
              <p className="text-sm text-text-muted">© Wizards of the Coast. Image via Scryfall.</p>
              <button type="button" onClick={() => setCard(null)} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="close" /> Close</button>
            </div>
          )}
          <Markdown source={guide.markdown} onCard={(n) => { setCard(n); window.scrollTo({ top: 0 }); }} />
        </>
      )}
    </section>
  );
});
