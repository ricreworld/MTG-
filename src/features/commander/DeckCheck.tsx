// The deck doctor: paste a Commander deck list (or pick one of the four built-in decks) and get an honest
// check: shape against the targets, problems, the bracket it actually is and why, and a strict star rating.
import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import library from "../../content/foundations.json";
import { CARD_LIST } from "../../game/commander/cards";
import { ALL_DECKS, deckListText, toLibraryCard } from "../../game/commander/decks";
import { checkDeck, parseList, stars, TARGETS, type LibraryCard, type Report } from "../../game/deckcheck";

const LIB: LibraryCard[] = [...CARD_LIST.map(toLibraryCard), ...(library as LibraryCard[])];

interface Props { onBack: () => void; onReadMore: (moduleId: string) => void }

export function DeckCheck({ onBack, onReadMore }: Props) {
  const [text, setText] = useState("");
  const [commander, setCommander] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
  const run = (t: string, c: string) => {
    const lines = parseList(t);
    // "*CMDR*" or the first line names the commander when the field is empty.
    const cmdLine = /\*CMDR\*/i.test(t) ? parseList(t.split("\n").find((l) => /\*CMDR\*/i.test(l)) ?? "")[0] : undefined;
    const cmdName = c.trim() || cmdLine?.name || "";
    const rest = cmdName ? lines.filter((l, i) => !(l.name.toLowerCase() === cmdName.toLowerCase() && i === lines.findIndex((x) => x.name.toLowerCase() === cmdName.toLowerCase()))) : lines;
    setReport(checkDeck(rest, LIB, cmdName || undefined));
  };
  const example = (id: string) => { const d = ALL_DECKS.find((x) => x.id === id)!; const t = deckListText(d); setText(t); setCommander(""); run(t, ""); };
  const pct = useMemo(() => report ? Object.fromEntries(TARGETS.map((t) => [t.key, Math.min(100, Math.round((report.shape[t.key] / (t.max ?? t.min)) * 100))])) : {}, [report]);

  return (
    <section aria-labelledby="deckcheck-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="deckcheck-heading" tabIndex={-1} className="text-2xl font-bold">Deck doctor</h2>
        <button type="button" onClick={onBack} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="back" /> Back</button>
      </div>
      <p>Paste a Commander deck list and get an honest check: the shape a 100-card deck wants, what's missing, the bracket it actually is (and why), and a strict star rating where a deck that merely works is three stars. It reads each card's rules text. It knows every card the table can play plus the whole Foundations set; anything else is listed as not checked. Nothing leaves your device.</p>
      <div className="grid gap-s2">
        <label className="grid gap-s1 text-sm font-bold">Commander (or mark it with *CMDR* in the list)
          <input value={commander} onChange={(e) => setCommander(e.target.value)} placeholder="Lyra Dawnbringer" className="min-h-tap rounded-md border-2 border-border-strong bg-bg px-s3 font-normal" />
        </label>
        <label className="grid gap-s1 text-sm font-bold">Deck list, one card per line ("1 Card Name")
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false} className="rounded-md border-2 border-border-strong bg-bg p-s3 font-mono text-sm font-normal" placeholder={"1 Lyra Dawnbringer *CMDR*\n1 Serra Angel\n1 Healer's Hawk\n…\n30 Plains"} />
        </label>
        <div className="flex flex-wrap items-center gap-s2">
          <button type="button" onClick={() => run(text, commander)} disabled={!text.trim()} className={`${btn} bg-accent text-accent-ink disabled:opacity-50`}><Icon name="check" /> Check this deck</button>
          <span className="text-sm">Or check a built-in deck:</span>
          {ALL_DECKS.map((d) => <button key={d.id} type="button" onClick={() => example(d.id)} className={`${btn} min-h-[2.25rem] border-2 border-border-strong bg-surface text-sm`}>{d.name}</button>)}
        </div>
      </div>

      {report && (
        <div className="grid gap-s3" aria-live="polite">
          <div className="grid gap-s1 rounded-md border-2 border-accent bg-accent-soft p-s3">
            <p className="text-lg font-bold">{stars(report.overall.stars)} ({report.overall.stars} of 5), {report.overall.words}. Bracket {report.bracket.actual}.</p>
            {report.overall.capped && <p className="text-sm">{report.overall.capped}</p>}
            <p className="text-sm">Stars are not power. The bracket is the deck's power tier; the stars say how good it is within that bracket. A two-star Bracket 4 deck beats a five-star Bracket 2 deck.</p>
          </div>

          {report.problems.length > 0 && (
            <div className="grid gap-s1 rounded-md border border-border bg-surface-2 p-s3">
              <p className="font-bold">Fix these first</p>
              <ul className="grid gap-s1 pl-s5 text-sm">{report.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}

          <div className="grid gap-s2 rounded-md border border-border p-s3">
            <p className="font-bold">Shape {stars(report.structure.stars)} <span className="text-sm font-normal text-text-muted">({report.shape.total} cards, {report.shape.creatures} creatures)</span></p>
            <ul className="grid gap-s2">
              {TARGETS.map((t) => {
                const v = report.shape[t.key];
                const ok = v >= t.min && (t.max === undefined || v <= t.max);
                return (
                  <li key={t.key} className="grid gap-s1 text-sm">
                    <span className="flex items-center gap-s2"><span className={ok ? "text-success" : "text-hint"}><Icon name={ok ? "check" : "info"} size={1} /></span><strong>{t.label}:</strong> {v} <span className="text-text-muted">(want {t.min}{t.max !== undefined ? ` to ${t.max}` : "+"})</span></span>
                    <span className="ms-bar block h-2 w-full max-w-[20rem] overflow-hidden rounded-sm bg-surface-2" aria-hidden="true"><span className={`block h-full ${ok ? "bg-success" : "bg-hint"}`} style={{ width: `${pct[t.key] ?? 0}%` }} /></span>
                    <span className="text-text-muted">{t.note}</span>
                  </li>
                );
              })}
              <li className="text-sm">{report.structure.notes[report.structure.notes.length - 1]}</li>
            </ul>
          </div>

          <div className="grid gap-s1 rounded-md border border-border p-s3">
            <p className="font-bold">Ways to win {stars(report.wincons.stars)}</p>
            <ul className="grid gap-s1 pl-s5 text-sm">{report.wincons.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>

          <div className="grid gap-s1 rounded-md border border-border p-s3">
            <p className="font-bold">Bracket {report.bracket.actual}: {report.bracket.reason}</p>
            <ul className="grid gap-s1 pl-s5 text-sm">{report.bracket.signals.map((n, i) => <li key={i}>{n}</li>)}</ul>
            <p className="text-sm"><strong>To move up a bracket:</strong> {report.bracket.moveUp}</p>
            <p className="text-sm"><strong>To move down:</strong> {report.bracket.moveDown}</p>
          </div>

          <details className="rounded-md border border-border p-s3">
            <summary className="min-h-tap cursor-pointer content-center font-bold">Every card and its job</summary>
            <ul className="mt-s2 grid gap-[2px] text-sm">
              {report.commander && <li><strong>{report.commander.name}</strong> (commander): {report.commander.roles.join(", ") || "no listed job"}</li>}
              {report.cards.map((c, i) => <li key={i} className={c.found ? "" : "text-text-muted"}>{c.qty > 1 ? `${c.qty} ` : ""}{c.name}: {c.found ? c.roles.join(", ") || "no listed job (a body, a theme card or a trick)" : "not in Foundations, not checked"}{c.offIdentity ? " · outside the colour identity" : ""}</li>)}
            </ul>
          </details>
          <div><button type="button" onClick={() => onReadMore("building-a-commander-deck")} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="book" /> Read the deck-building lesson</button></div>
        </div>
      )}
      <p className="text-sm text-text-muted">The method follows the open-source claude-mtg-skills deck-building kit (MIT): shape targets, synergy as points of contact, the official bracket determination, and a strict rating.</p>
    </section>
  );
}
