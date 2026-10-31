// Setting up a four-player Commander game: continue the saved game, or pick which of the four decks is yours.
// The other three decks go to the computer players.
import { forwardRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import { CCARDS } from "../../game/commander/cards";
import { CDECKS, deckSummary, type CDeck } from "../../game/commander/decks";
import type { SavedGame } from "../../game/commander/save";
import { CommanderCard } from "./CommanderCard";

interface Props {
  saved: SavedGame | null;
  onContinue: () => void;
  onStart: (deckId: string) => void;
  onBack: () => void;
}

function DeckTile({ deck, selected, onPick }: { deck: CDeck; selected: boolean; onPick: () => void }) {
  const commander = CCARDS[deck.commander]!;
  const sum = deckSummary(deck);
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
      <span className="flex flex-wrap gap-s2" aria-hidden="true"><CommanderCard card={commander} size="sm" />{keyCards.map((c) => <CommanderCard key={c.id} card={c} size="sm" />)}</span>
      <span className="sr-only">Commander and key cards: {[commander, ...keyCards].map((c) => c.name).join(", ")}.</span>
    </button>
  );
}

export const CommanderSetup = forwardRef<HTMLHeadingElement, Props>(function CommanderSetup({ saved, onContinue, onStart, onBack }, headingRef) {
  const [pick, setPick] = useState<string | null>(null);
  const btn = "inline-flex min-h-tap items-center gap-s2 rounded-md px-s4 font-bold";
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
      </div>
      <div>
        <button type="button" disabled={!pick} onClick={() => pick && onStart(pick)} className={`${btn} bg-accent text-accent-ink disabled:opacity-50`}><Icon name="play" /> {saved ? "Start a new game (replaces the saved one)" : "Start the game"}</button>
      </div>
    </section>
  );
});
