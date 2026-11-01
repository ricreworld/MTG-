// "How to play this deck": the short guide (one screen) with a button for every card. Written by the app from the
// cards, offline. Also shows the deck's goals and which ones have been reached on this device.
import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { CCARDS } from "../../game/commander/cards";
import { deckGoals, planLabel, writeGuide } from "../../game/commander/primer";
import { CommanderCard } from "./CommanderCard";

export const GOALS_KEY = "mana-steps:deck-goals";
export function loadGoals(deckId: string): string[] { try { const raw = localStorage.getItem(GOALS_KEY); const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}; return all[deckId] ?? []; } catch { return []; } }
export function saveGoals(deckId: string, done: string[]): void { try { const raw = localStorage.getItem(GOALS_KEY); const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}; all[deckId] = done; localStorage.setItem(GOALS_KEY, JSON.stringify(all)); } catch { /* ignore */ } }

interface Props { deckId: string; name: string; commander: string; cards: string[]; onBack: () => void; onPlay?: (() => void) | undefined }

export function DeckGuideView({ deckId, name, commander, cards, onBack, onPlay }: Props) {
  const guide = useMemo(() => writeGuide(commander, cards), [commander, cards]);
  const goals = useMemo(() => deckGoals(guide.plan, guide.commander), [guide]);
  const done = useMemo(() => loadGoals(deckId), [deckId]);
  const [every, setEvery] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
  const cardButton = (id: string, label?: string) => <button key={id} type="button" onClick={() => setCard(id)} className="rounded-sm bg-accent-soft px-1 font-bold underline decoration-accent">{label ?? CCARDS[id]?.name}</button>;
  return (
    <section aria-labelledby="guide-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="guide-heading" tabIndex={-1} className="text-2xl font-bold">How to play {name}</h2>
        <button type="button" onClick={onBack} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="back" /> Back</button>
      </div>
      <p className="text-sm text-text-muted">Written by the app from the cards in this deck. Tap a card name to see it.</p>
      {card && CCARDS[card] && (
        <div role="dialog" aria-label={`Card: ${CCARDS[card]!.name}`} className="grid justify-items-start gap-s2 rounded-md border-2 border-accent bg-surface-2 p-s3">
          <CommanderCard card={CCARDS[card]!} size="lg" />
          <button type="button" onClick={() => setCard(null)} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="close" /> Close</button>
        </div>
      )}
      <div className="grid max-w-[65ch] gap-s3">
        <div className="flex flex-wrap items-start gap-s3">
          <CommanderCard card={guide.commander} size="md" />
          <div className="grid gap-s1">
            <p><strong>The plan:</strong> {planLabel(guide.plan)}{guide.secondPlan ? `, backed by ${planLabel(guide.secondPlan)}` : ""}.</p>
            <p>{guide.planText}</p>
          </div>
        </div>
        <div>
          <p className="font-bold">Key cards</p>
          <ul className="grid gap-s1 pl-s5">{guide.keyCards.map((k) => <li key={k.card.id} className="list-disc">{cardButton(k.card.id)}: {k.why}</li>)}</ul>
        </div>
        <p><strong>Opening hand:</strong> {guide.openingHand}</p>
        <p><strong>Early:</strong> {guide.early}</p>
        <p><strong>Middle:</strong> {guide.mid}</p>
        <p><strong>Late:</strong> {guide.late}</p>
        {guide.weakSpots.length > 0 && (
          <div>
            <p className="font-bold">Weak spots</p>
            <ul className="grid gap-s1 pl-s5">{guide.weakSpots.map((w, i) => <li key={i} className="list-disc">{w}</li>)}</ul>
          </div>
        )}
        <p className="text-sm text-text-muted">Shape: {guide.shape.lands} lands · {guide.shape.ramp} ramp · {guide.shape.draw} card draw · {guide.shape.interaction} answers ({guide.shape.wipes} wipes) · {guide.shape.creatures} creatures · average cost {guide.shape.avgMv}.</p>
        <div className="grid gap-s1 rounded-md border border-border bg-surface-2 p-s3">
          <p className="font-bold">Deck goals <span className="text-sm font-normal text-text-muted">({done.length} of {goals.length} reached)</span></p>
          <ul className="grid gap-s1">{goals.map((g) => <li key={g.id} className="flex items-center gap-s2"><span className={done.includes(g.id) ? "text-success" : "text-text-muted"}><Icon name={done.includes(g.id) ? "check" : "info"} size={1} /></span>{g.label}</li>)}</ul>
          <p className="text-sm text-text-muted">Goals tick themselves off while you play this deck on the table.</p>
        </div>
        <div className="flex flex-wrap gap-s2">
          {onPlay && <button type="button" onClick={onPlay} className={`${btn} bg-accent text-accent-ink`}><Icon name="play" /> Play this deck</button>}
          <button type="button" onClick={() => setEvery((v) => !v)} aria-expanded={every} className={`${btn} border-2 border-border-strong bg-surface`}>{every ? "Hide every card" : "Show every card"}</button>
        </div>
        {every && guide.groups.map((g) => (
          <div key={g.title}>
            <p className="font-bold">{g.title}</p>
            <ul className="grid gap-s1 pl-s5">{g.cards.map((c) => <li key={c.card.id} className="list-disc text-sm">{cardButton(c.card.id, c.line.split(":")[0])}{c.line.slice(c.line.indexOf(":"))}</li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}
