// Free play setup: choose your deck, choose the opponent's deck, start. Calm, one choice at a time.
import { forwardRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ManaSymbol } from "../../components/ManaSymbol";
import { CARDS } from "../../game/cards";
import { DECKS, deckSize, type Deck } from "../../game/decks";
import { GameCard } from "./GameCard";

interface Props {
  mode: "standard" | "commander";
  onStart: (yourDeck: string, oppDeck: string) => void;
  onBack: () => void;
}

function DeckTile({ deck, selected, onPick, label, commander }: { deck: Deck; selected: boolean; onPick: () => void; label: string; commander: boolean }) {
  const keyCards = commander && deck.commander ? [deck.commander, ...Object.keys(deck.cards).filter((id) => CARDS[id]?.kind !== "land").slice(0, 2)] : Object.keys(deck.cards).filter((id) => CARDS[id]?.kind !== "land").slice(0, 3);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`grid w-full gap-s2 rounded-lg border-2 p-s3 text-left ${selected ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}
    >
      <span className="flex flex-wrap items-center gap-s2">
        <span className="inline-flex gap-1">{deck.colors.map((c) => <ManaSymbol key={c} color={c} size={1.4} />)}</span>
        <span className="text-lg font-bold">{deck.name}</span>
        {selected && <span className="ml-auto inline-flex items-center gap-s1 text-sm text-success"><Icon name="check" size={1} /> {label}</span>}
      </span>
      <span className="text-sm">{deck.style}</span>
      {commander && deck.commander && <span className="text-sm"><strong>Commander:</strong> {CARDS[deck.commander]!.name}</span>}
      <span className="flex flex-wrap gap-s2" aria-hidden="true">
        {keyCards.map((id) => <GameCard key={id} card={CARDS[id]!} size="sm" />)}
      </span>
      <span className="sr-only">{commander ? "Commander and key cards" : "Key cards"}: {keyCards.map((id) => CARDS[id]!.name).join(", ")}.</span>
    </button>
  );
}

export const DeckPicker = forwardRef<HTMLHeadingElement, Props>(function DeckPicker({ mode, onStart, onBack }, headingRef) {
  const [yours, setYours] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<string | null>(null);
  const commander = mode === "commander";
  const decks = commander ? DECKS.filter((d) => d.commander) : DECKS;
  const yourDeck = DECKS.find((d) => d.id === yours);
  const secondary = "inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s3 font-bold";
  const primary = "inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s4 font-bold text-accent-ink disabled:opacity-50";

  return (
    <section aria-labelledby="deck-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s2">
        <h2 id="deck-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">{commander ? "Play Commander" : "Play a game"}</h2>
        <button type="button" onClick={onBack} className={secondary}><Icon name="back" /> Practice</button>
      </div>
      {commander ? (
        <p>
          A Commander game against one computer opponent, with the coach beside you. Both players start at 40 life, each deck is led by a commander
          that waits in the command zone, and 21 combat damage from one commander wins. These decks have {deckSize(DECKS[0]!)} cards so a game stays
          short. Real Commander decks have 100 different cards and usually four players.
        </p>
      ) : (
        <p>
          A whole game against the computer, with the coach beside you: it suggests a move each step and explains why,
          and you can undo anything. These decks have {deckSize(DECKS[0]!)} cards so a game stays short. Real Standard decks have 60 or more.
        </p>
      )}

      <h3 className="text-lg font-bold">1. Your deck</h3>
      <ol className="grid gap-s2">
        {decks.map((d) => <li key={d.id}><DeckTile deck={d} selected={yours === d.id} onPick={() => setYours(d.id)} label="Your deck" commander={commander} /></li>)}
      </ol>
      {yourDeck && <p className="rounded-md bg-surface-2 p-s3 text-sm"><strong>How to play {yourDeck.name}:</strong> {yourDeck.howToPlay}</p>}

      <h3 className="text-lg font-bold">2. The computer's deck</h3>
      <ol className="grid gap-s2">
        {decks.map((d) => <li key={d.id}><DeckTile deck={d} selected={theirs === d.id} onPick={() => setTheirs(d.id)} label="Their deck" commander={commander} /></li>)}
      </ol>

      <div className="flex flex-wrap items-center gap-s2">
        <button type="button" disabled={!yours || !theirs} onClick={() => yours && theirs && onStart(yours, theirs)} className={primary}><Icon name="play" /> Start the game</button>
        {(!yours || !theirs) && <span className="text-sm text-text-muted">Pick both decks first.</span>}
      </div>
    </section>
  );
});
