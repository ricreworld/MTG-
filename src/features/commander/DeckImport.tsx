// Your decks: paste a Commander list, see which cards the table can run, swap the ones it can't, save it, play it.
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { CCARDS } from "../../game/commander/cards";
import { importDeck, loadMyDecks, myDeckText, saveMyDecks, type ImportResult, type MyDeck } from "../../game/commander/mydecks";
import { CommanderCard } from "./CommanderCard";
import { DeckGuideView } from "./DeckGuideView";

interface Props { onBack: () => void; onPlay: (deck: MyDeck) => void; prefill?: { decklist: string; name: string } | null }

export function DeckImport({ onBack, onPlay, prefill }: Props) {
  const [decks, setDecks] = useState<MyDeck[]>(() => loadMyDecks());
  const [text, setText] = useState(prefill?.decklist ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [commander, setCommander] = useState("");
  const [result, setResult] = useState<ImportResult | null>(() => (prefill ? importDeck(prefill.decklist, prefill.name) : null));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [guideFor, setGuideFor] = useState<MyDeck | null>(null);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
  const primary = `${btn} bg-accent text-accent-ink`;
  const secondary = `${btn} border-2 border-border-strong bg-surface`;
  const check = () => setResult(importDeck(text, name, commander));
  const save = () => { if (!result?.deck) return; const next = [...decks.filter((d) => d.name !== result.deck!.name), result.deck]; setDecks(next); saveMyDecks(next); setResult(null); setText(""); setName(""); setCommander(""); };
  const remove = (id: string) => { const next = decks.filter((d) => d.id !== id); setDecks(next); saveMyDecks(next); setConfirmDelete(null); };
  const swapIn = (oldName: string, card: string) => {
    // Replace the unplayable line with the suggested card, then check again.
    const lines = text.split("\n").map((l) => (new RegExp(`^\\s*\\d*\\s*x?\\s*${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i").test(l) ? l.replace(oldName, card) : l));
    const t = lines.join("\n"); setText(t); setResult(importDeck(t, name, commander));
  };

  if (guideFor) return <DeckGuideView deckId={guideFor.id} name={guideFor.name} commander={guideFor.commander} cards={guideFor.cards} onBack={() => setGuideFor(null)} onPlay={() => onPlay(guideFor)} />;
  return (
    <section aria-labelledby="mydecks-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="mydecks-heading" tabIndex={-1} className="text-2xl font-bold">Your decks</h2>
        <button type="button" onClick={onBack} className={secondary}><Icon name="back" /> Back</button>
      </div>
      <p>Paste a Commander deck list. The table can play it when the engine can run every card exactly as printed, from a pool of {Object.keys(CCARDS).length} real cards. Cards it can't run yet are listed with playable swaps that do the same job. Saved decks stay on this device.</p>

      {decks.length > 0 && (
        <ul className="grid gap-s2">
          {decks.map((d) => (
            <li key={d.id} className="grid gap-s2 rounded-md border-2 border-border-strong p-s3">
              <div className="flex flex-wrap items-center gap-s2">
                <CommanderCard card={CCARDS[d.commander]!} size="sm" />
                <span className="grid gap-s1"><span className="font-bold">{d.name}</span><span className="text-sm text-text-muted">Led by {CCARDS[d.commander]!.name}. {d.cards.length + 1} cards.</span></span>
              </div>
              <div className="flex flex-wrap gap-s2">
                <button type="button" onClick={() => onPlay(d)} className={primary}><Icon name="play" /> Play this deck</button>
                <button type="button" onClick={() => setGuideFor(d)} className={secondary}><Icon name="book" /> How to play it</button>
                <button type="button" onClick={() => { setText(myDeckText(d)); setName(d.name); setCommander(""); setResult(null); }} className={secondary}>Edit the list</button>
                {confirmDelete === d.id ? <><button type="button" onClick={() => remove(d.id)} className={primary}>Yes, delete</button><button type="button" onClick={() => setConfirmDelete(null)} className={secondary}>Keep</button></> : <button type="button" onClick={() => setConfirmDelete(d.id)} className={secondary}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-s2">
        <label className="grid gap-s1 text-sm font-bold">Deck name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lyra's Angels" className="min-h-tap rounded-md border-2 border-border-strong bg-bg px-s3 font-normal" />
        </label>
        <label className="grid gap-s1 text-sm font-bold">Commander (or mark it with *CMDR* in the list, or put it first)
          <input value={commander} onChange={(e) => setCommander(e.target.value)} placeholder="Lyra Dawnbringer" className="min-h-tap rounded-md border-2 border-border-strong bg-bg px-s3 font-normal" />
        </label>
        <label className="grid gap-s1 text-sm font-bold">Deck list, one card per line ("1 Card Name")
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} className="rounded-md border-2 border-border-strong bg-bg p-s3 font-mono text-sm font-normal" placeholder={"1 Lyra Dawnbringer *CMDR*\n1 Giada, Font of Hope\n…\n31 Plains"} />
        </label>
        <div><button type="button" onClick={check} disabled={!text.trim()} className={`${primary} disabled:opacity-50`}><Icon name="check" /> Check this deck</button></div>
      </div>

      {result && (
        <div className="grid gap-s3" aria-live="polite">
          <div className={`grid gap-s1 rounded-md border-2 p-s3 ${result.playable ? "border-success bg-success-soft" : "border-accent bg-accent-soft"}`}>
            <p className="font-bold">{result.playable ? "Every card can be played on the table." : `${result.unplayable.length} card${result.unplayable.length === 1 ? "" : "s"} can't be played yet.`} {result.commander ? `Commander: ${result.commander.name}.` : ""} {result.total} cards.</p>
            {result.commanderProblem && <p className="text-sm">{result.commanderProblem}</p>}
            {result.problems.map((p, i) => <p key={i} className="text-sm">{p}</p>)}
            {result.playable && <div><button type="button" onClick={save} className={primary}><Icon name="check" /> Save this deck</button></div>}
          </div>
          {result.unplayable.length > 0 && (
            <div className="grid gap-s2 rounded-md border border-border p-s3">
              <p className="font-bold">Cards the engine can't run yet</p>
              <p className="text-sm text-text-muted">Each one is either not in the pool or has rules text the engine doesn't understand exactly. Tap a swap to put it in the list.</p>
              <ul className="grid gap-s2">
                {result.unplayable.map((u) => (
                  <li key={u.name} className="grid gap-s1 text-sm">
                    <span><strong>{u.qty > 1 ? `${u.qty} ` : ""}{u.name}</strong></span>
                    {u.suggestions.length > 0 && <span className="flex flex-wrap gap-s1">{u.suggestions.map((s) => <button key={s.id} type="button" onClick={() => swapIn(u.name, s.name)} className={`${secondary} min-h-[2.25rem] text-sm`}>Swap for {s.name}</button>)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="rounded-md border border-border p-s3">
            <summary className="min-h-tap cursor-pointer content-center font-bold">Every card ({result.cards.length} lines)</summary>
            <ul className="mt-s2 grid gap-[2px] text-sm">{result.cards.map((c, i) => <li key={i} className={c.card ? "" : "text-text-muted"}>{c.line.qty > 1 ? `${c.line.qty} ` : ""}{c.card ? c.card.name : `${c.line.name} (can't run yet)`}{c.offIdentity ? ", outside the commander's colours" : ""}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
