// Setting up a four-player Commander game: continue the saved game, or pick which of the four decks is yours.
// The other three decks go to the computer players.
import { forwardRef, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import { CCARDS } from "../../game/commander/cards";
import { CDECKS, deckListText, deckSummary, toLibraryCard, type CDeck } from "../../game/commander/decks";
import type { SavedGame } from "../../game/commander/save";
import { CARD_LIST } from "../../game/commander/cards";
import { checkDeck, parseList, stars, type LibraryCard } from "../../game/deckcheck";
import { CommanderCard } from "./CommanderCard";
import { DeckCheck } from "./DeckCheck";
import { DeckImport } from "./DeckImport";
import type { MyDeck } from "../../game/commander/mydecks";

const LIB: LibraryCard[] = CARD_LIST.map(toLibraryCard);
const shapeOf = (d: CDeck) => { const lines = parseList(deckListText(d)); return checkDeck(lines.slice(1), LIB, lines[0]!.name); };

interface Props {
  saved: SavedGame | null;
  onContinue: () => void;
  onStart: (deckId: string) => void;
  onStartCustom: (deck: MyDeck) => void;
  onBack: () => void;
  onReadMore: (moduleId: string) => void;
  /** A deck list handed over from a guide, to check and play. */
  prefill?: { decklist: string; name: string } | null | undefined;
  onPrefillUsed?: (() => void) | undefined;
}

function DeckTile({ deck, selected, onPick }: { deck: CDeck; selected: boolean; onPick: () => void }) {
  const commander = CCARDS[deck.commander]!;
  const sum = deckSummary(deck);
  const r = useMemo(() => shapeOf(deck), [deck]);
  const keyCards = deck.cards.filter((id) => CCARDS[id]!.kind !== "land").slice(-2).map((id) => CCARDS[id]!);
  return (
    <button type="button" onClick={onPick} aria-pressed={selected} className={`grid w-full gap-s2 rounded-lg border-2 p-s3 text-left ${selected ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}>
      <span className="flex flex-wrap items-center gap-s2">
        <span className="inline-flex gap-1">{(deck.identity || "C").split("").map((c) => <ManaSymbol key={c} color={c as ManaColor} size={1.4} />)}</span>
        <span className="text-lg font-bold">{deck.name}</span>
        {selected && <span className="ml-auto inline-flex items-center gap-s1 text-sm text-success"><Icon name="check" size={1} /> Your deck</span>}
      </span>
      <span className="text-sm">{deck.style}</span>
      <span className="text-sm"><strong>Commander:</strong> {commander.name}. {sum.creatures} creatures, {sum.other} other spells, {sum.lands} lands.</span>
      <span className="text-sm"><strong>Shape:</strong> {r.shape.ramp} ramp · {r.shape.draw} card draw · {r.shape.interaction} answers ({r.shape.wipes} wipes) · {r.shape.finishers} finishers. Deck doctor: {stars(r.overall.stars)}, Bracket {r.bracket.actual}.</span>
      <span className="text-sm"><strong>How it wins:</strong> {deck.primer.wins}</span>
      <span className="flex flex-wrap gap-s2" aria-hidden="true"><CommanderCard card={commander} size="sm" />{keyCards.map((c) => <CommanderCard key={c.id} card={c} size="sm" />)}</span>
      <span className="sr-only">Commander and key cards: {[commander, ...keyCards].map((c) => c.name).join(", ")}.</span>
    </button>
  );
}

export const CommanderSetup = forwardRef<HTMLHeadingElement, Props>(function CommanderSetup({ saved, onContinue, onStart, onStartCustom, onBack, onReadMore, prefill, onPrefillUsed }, headingRef) {
  const [pick, setPick] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(!!prefill);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
  if (checking) return <DeckCheck onBack={() => setChecking(false)} onReadMore={onReadMore} />;
  if (importing) return <DeckImport onBack={() => { setImporting(false); onPrefillUsed?.(); }} onPlay={onStartCustom} prefill={prefill ?? null} />;
  const picked = pick ? CDECKS.find((d) => d.id === pick) : undefined;
  return (
    <section aria-labelledby="cmd-setup-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="cmd-setup-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Commander: four players</h2>
        <button type="button" onClick={onBack} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="back" /> Back</button>
      </div>
      <p>A real Commander game: you and three computer players, each with a 100-card singleton deck built from {Object.keys(CCARDS).length} Foundations cards, 40 life each, commanders in the command zone. The game saves itself after every move, so you can stop and come back later.</p>
      {saved && (
        <div className="grid gap-s2 rounded-md border-2 border-accent bg-accent-soft p-s3">
          <p className="font-bold">Welcome back. Your game is waiting.</p>
          <p className="text-sm">Turn {saved.state.turnNumber}, saved {new Date(saved.savedAt).toLocaleString()}. You lead {CCARDS[saved.state.players[saved.state.human]!.commandZone.card]?.name}.</p>
          <div><button type="button" onClick={onContinue} className={`${btn} bg-accent text-accent-ink`}><Icon name="play" /> Continue that game</button></div>
        </div>
      )}
      <div className="grid gap-s2">
        <p className="font-bold">{saved ? "Or start a new game. Which deck is yours?" : "Which deck is yours?"}</p>
        <div className="grid gap-s2 sm:grid-cols-2">{CDECKS.map((d) => <DeckTile key={d.id} deck={d} selected={pick === d.id} onPick={() => setPick(d.id)} />)}</div>
        <p className="text-sm text-text-muted">The three decks you don't pick go to Mara, Theo and Ines, the computer players. Turns go clockwise: you, then Mara, Theo, Ines.</p>
        {picked && (
          <div className="grid gap-s1 rounded-md border border-border bg-surface-2 p-s3 text-sm">
            <p className="font-bold">How to play {picked.name}</p>
            <p><strong>Early:</strong> {picked.primer.early}</p>
            <p><strong>Middle:</strong> {picked.primer.mid}</p>
            <p><strong>Late:</strong> {picked.primer.late}</p>
            <p><strong>Common mistakes:</strong> {picked.primer.misplays}</p>
          </div>
        )}
      </div>
      <div className="grid gap-s2 rounded-md border-2 border-accent bg-surface p-s3">
        <p className="font-bold">Your decks</p>
        <p className="text-sm">Paste any Commander deck list. If the engine can run every card, you can save it and play it here against the three computer decks.</p>
        <div><button type="button" onClick={() => setImporting(true)} className={`${btn} bg-accent text-accent-ink`}><Icon name="play" /> Paste or play your own deck</button></div>
      </div>
      <div className="grid gap-s2 rounded-md border border-border bg-surface-2 p-s3">
        <p className="font-bold">Deck doctor</p>
        <p className="text-sm">Check any Commander deck list against the shape a 100-card deck wants, see which bracket it really is, and get a strict star rating. Works on these four decks too.</p>
        <div><button type="button" onClick={() => setChecking(true)} className={`${btn} border-2 border-border-strong bg-surface`}><Icon name="check" /> Check a deck list</button></div>
      </div>
      <div>
        <button type="button" disabled={!pick} onClick={() => pick && onStart(pick)} className={`${btn} bg-accent text-accent-ink disabled:opacity-50`}><Icon name="play" /> {saved ? "Start a new game (replaces the saved one)" : "Start the game"}</button>
      </div>
    </section>
  );
});
