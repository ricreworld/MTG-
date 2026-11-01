// Ways to play. Facts checked 2026-11-01 against the official format pages and the Comprehensive Rules.
// Anything that moves (rotation, banned and restricted lists, legal sets, Arena pools) carries a
// "changes" note and the date instead of a hard-coded list.

export const FORMATS_LAST_VERIFIED = "2026-11-01";

export type Family = "constructed" | "limited" | "digital";

export interface Format {
  id: string;
  name: string;
  family: Family;
  summary: string;
  why: string;
  fields: { deckSize: string; copies: string; life: string; players: string; pool: string; rotates: string; where: string; cost: string; bestFor: string };
  changes?: string;
  lastVerified: string;
  experienced?: boolean;
  leadsTo: { label: string; target: string }[];
}

export const FAMILIES: { id: Family; name: string; summary: string }[] = [
  { id: "constructed", name: "Constructed", summary: "You bring a deck you built ahead of time." },
  { id: "limited", name: "Limited", summary: "You build a deck on the spot from booster packs." },
  { id: "digital", name: "Digital only (MTG Arena)", summary: "Formats that exist only in the Arena app." },
];

const V = FORMATS_LAST_VERIFIED;

export const FORMATS: Format[] = [
  { id: "standard", name: "Standard", family: "constructed", summary: "The newest sets only, from about the last three years. The smallest card pool and the easiest place to start.", why: "Because old sets leave, everyone's collection is roughly the same age, so a new player is not facing twenty years of cards. Foundations stays legal through at least 2029, so cards from it are the safest to collect first. Universes Beyond sets are Standard-legal too.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Sets from about the last 3 years", rotates: "Yes", where: "Paper and Arena", cost: "medium", bestFor: "A first competitive deck with a small card pool." }, changes: "Which sets are legal changes when sets rotate out. Check the official Standard page for today's list.", lastVerified: V, leadsTo: [{ label: "Pioneer, no rotation", target: "pioneer" }, { label: "Foundations, the base set", target: "set:foundations" }] },
  { id: "pioneer", name: "Pioneer", family: "constructed", summary: "Every set from Return to Ravnica (2012) onward. Nothing rotates, so a deck stays legal for years.", why: "If you like a deck, it is yours to keep. The pool is bigger than Standard, so decks are stronger and more varied.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Sets from 2012 onward", rotates: "No", where: "Paper and Arena", cost: "medium", bestFor: "Keeping one deck for a long time." }, changes: "A short banned list applies. Check the official page.", lastVerified: V, leadsTo: [{ label: "Modern, a bigger pool", target: "modern" }] },
  { id: "modern", name: "Modern", family: "constructed", summary: "Every set from Eighth Edition (2003) onward, plus sets released straight into Modern.", why: "The biggest everyday pool and the strongest decks. Decks cost more, and games are faster and sharper.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Sets from 2003 onward, plus Modern-only sets", rotates: "No", where: "Paper", cost: "high", bestFor: "Experienced players who want powerful, lasting decks." }, changes: "A banned list applies and changes. Check the official page.", lastVerified: V, leadsTo: [{ label: "Legacy, almost everything", target: "legacy" }, { label: "Modern Horizons sets", target: "set:supplemental" }] },
  { id: "legacy", name: "Legacy", family: "constructed", summary: "Almost every card ever printed, with a banned list keeping out the most broken ones.", why: "The deepest card pool in paper. Old, expensive cards shape the format, which is why it is rare at a local shop.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Almost every card ever printed", rotates: "No", where: "Paper", cost: "high", bestFor: "Collectors and long-time players." }, changes: "The banned list changes. Check the official page.", lastVerified: V, leadsTo: [{ label: "Vintage, restricted instead", target: "vintage" }] },
  { id: "vintage", name: "Vintage", family: "constructed", summary: "Almost every card ever printed. Instead of banning most powerful cards, it restricts them: only one copy of each restricted card.", why: "This is the only format where the very first, most powerful cards are playable. It is a museum and a battlefield at once.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each; only 1 of each restricted card", life: "20", players: "2", pool: "Almost every card ever printed", rotates: "No", where: "Paper", cost: "high", bestFor: "The most experienced players with the deepest collections." }, changes: "The restricted list changes. Check the official page.", lastVerified: V, experienced: true, leadsTo: [{ label: "Pauper, the budget cousin", target: "pauper" }] },
  { id: "pauper", name: "Pauper", family: "constructed", summary: "Only cards that have been printed at common rarity. Whole decks cost very little.", why: "If money is the worry, this is the answer. The games are still sharp; the cards are just cheap.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Any card ever printed at common", rotates: "No", where: "Paper (online versions exist)", cost: "low", bestFor: "Playing a strong deck on a small budget." }, changes: "A banned list applies. Check the official page.", lastVerified: V, leadsTo: [{ label: "Commander, the social game", target: "commander" }] },
  { id: "commander", name: "Commander", family: "constructed", summary: "Casual multiplayer, usually four players. A 100-card deck with one copy of each card, led by a legendary creature you choose.", why: "Games are long, social and full of surprises. Every card in your deck must match your commander's colours, so the commander decides what the deck is about. Most of this app's practice happens here.", fields: { deckSize: "Exactly 100 cards, counting the commander", copies: "1 of each, except basic lands", life: "40", players: "Usually 4", pool: "Almost every card ever printed", rotates: "No", where: "Paper and Arena (Brawl is the Arena cousin)", cost: "low to high, your choice", bestFor: "Playing with friends and expressing a theme." }, changes: "The banned list and the Game Changers list change. Check the official Commander page.", lastVerified: V, leadsTo: [{ label: "Try the four-player table", target: "play:commander" }, { label: "Commander decks (sets)", target: "set:supplemental" }] },
  { id: "draft", name: "Booster Draft", family: "limited", summary: "Open a booster pack, pick one card, pass the rest. When the packs are empty, build a 40-card deck from your picks.", why: "Everyone starts equal and nobody needs a collection. You learn to judge cards one at a time.", fields: { deckSize: "40 cards minimum", copies: "As many as you picked", life: "20", players: "Usually 8 at a table, then 2 per game", pool: "The packs opened at the table", rotates: "Each event uses a current set", where: "Paper and Arena", cost: "medium per event", bestFor: "Learning cards and playing without a collection." }, lastVerified: V, leadsTo: [{ label: "Sealed, no passing", target: "sealed" }] },
  { id: "sealed", name: "Sealed Deck", family: "limited", summary: "Open six booster packs and build a 40-card deck from what you pulled. This is how prerelease events work.", why: "The friendliest first event: the weekend before a set comes out, shops run Sealed so everyone meets the new cards together.", fields: { deckSize: "40 cards minimum", copies: "As many as you opened", life: "20", players: "2 per game", pool: "Your six packs", rotates: "Each event uses a current set", where: "Paper and Arena", cost: "medium per event", bestFor: "Your first event at a shop." }, lastVerified: V, leadsTo: [{ label: "Main expansion sets", target: "set:expansion" }] },
  { id: "alchemy", name: "Alchemy", family: "digital", summary: "Arena only. Like Standard, but with digital-only cards and live balance changes to cards.", why: "Cards can be changed after release to keep the format healthy, which only works on a computer.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "Standard sets plus digital-only cards", rotates: "Yes", where: "Arena", cost: "low to medium (in-app)", bestFor: "Arena players who like a changing format." }, changes: "The card pool and rebalanced cards change often. Check the Arena format page.", lastVerified: V, leadsTo: [{ label: "Historic, no rotation", target: "historic" }] },
  { id: "historic", name: "Historic", family: "digital", summary: "Arena only. A curated card pool that never rotates and includes rebalanced digital cards.", why: "Your Arena collection keeps its value: nothing leaves.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each, except basic lands", life: "20", players: "2", pool: "A curated Arena pool, including rebalanced cards", rotates: "No", where: "Arena", cost: "low to medium (in-app)", bestFor: "Keeping Arena decks for the long run." }, changes: "The pool and banned list change. Check the Arena format page.", lastVerified: V, leadsTo: [{ label: "Timeless, everything on Arena", target: "timeless" }] },
  { id: "timeless", name: "Timeless", family: "digital", summary: "Arena only. Every card on Arena is legal, nothing is banned, and the most powerful cards are restricted to one copy.", why: "The strongest Arena format. Games are fast and the best cards appear every game, so it rewards experience.", fields: { deckSize: "60 cards minimum", copies: "Up to 4 of each; only 1 of each restricted card", life: "20", players: "2", pool: "Everything on Arena", rotates: "No", where: "Arena", cost: "medium (in-app)", bestFor: "Experienced Arena players." }, changes: "The restricted list changes. Check the Arena format page.", lastVerified: V, experienced: true, leadsTo: [{ label: "Back to Standard", target: "standard" }] },
];

export const formatById = (id: string): Format | undefined => FORMATS.find((f) => f.id === id);

/** "Which format is for me?": three questions, each answer adds points to formats. */
export interface Question { id: string; text: string; options: { id: string; text: string; points: Partial<Record<string, number>> }[] }

export const QUESTIONS: Question[] = [
  { id: "people", text: "Who do you want to play with?", options: [
    { id: "one", text: "One opponent", points: { standard: 2, pioneer: 1, draft: 1, sealed: 1, alchemy: 1, historic: 1 } },
    { id: "group", text: "A group of friends", points: { commander: 4 } },
  ] },
  { id: "cards", text: "Do you own cards yet?", options: [
    { id: "none", text: "Not yet", points: { sealed: 3, draft: 2, pauper: 1, alchemy: 1 } },
    { id: "some", text: "A few, and I want to collect", points: { standard: 3, commander: 1, pauper: 1 } },
    { id: "many", text: "Plenty, old and new", points: { commander: 2, pioneer: 2, modern: 1 } },
  ] },
  { id: "where", text: "Where will you play?", options: [
    { id: "phone", text: "On my phone or computer", points: { alchemy: 2, historic: 2, standard: 1, draft: 1 } },
    { id: "shop", text: "At a shop or event", points: { sealed: 2, draft: 1, standard: 1, commander: 1 } },
    { id: "home", text: "At home with friends", points: { commander: 3, pauper: 1 } },
  ] },
];

export function recommend(answers: Record<string, string>): Format {
  const score: Record<string, number> = {};
  for (const q of QUESTIONS) { const o = q.options.find((x) => x.id === answers[q.id]); if (!o) continue; for (const [id, n] of Object.entries(o.points)) score[id] = (score[id] ?? 0) + (n ?? 0); }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "standard";
  return formatById(best) ?? FORMATS[0]!;
}
