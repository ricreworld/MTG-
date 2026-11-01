// Learn to play: the ideas, in order, each with a summary, why it matters, and where it leads.
// Rules facts checked 2026-11-01 against the Comprehensive Rules. Rules can change; the date rides along.
import type { ZoneId } from "../components/ui/ExampleCard";
import type { FlowStep } from "../components/ui/StepFlow";

export const LEARN_LAST_VERIFIED = "2026-11-01";

export interface Idea { id: string; title: string; summary: string; why: string; leadsTo: { label: string; target: string }[]; zone?: ZoneId }

export interface Part { id: string; title: string; intro: string; ideas: Idea[] }

export const WIN: Idea[] = [
  { id: "win-life", title: "Life reaches 0", summary: "Each player starts with 20 life (40 in Commander). Get an opponent to 0 and they lose.", why: "Almost every game ends this way, so most of what you do is about dealing damage or stopping it.", leadsTo: [{ label: "How attacking works", target: "combat" }] },
  { id: "win-draw", title: "Drawing from an empty library", summary: "If a player must draw a card and their library is empty, they lose the next time the game checks.", why: "It is rare but real. Decks that make opponents draw or discard a lot aim here.", leadsTo: [{ label: "The draw step", target: "turn" }] },
  { id: "win-poison", title: "10 poison counters", summary: "Some cards give poison counters instead of damage. Ten of them and that player loses.", why: "A few decks win only this way, so it helps to recognise the word \"poison\" (and \"toxic\") when you see it.", leadsTo: [{ label: "Card types", target: "types" }] },
];

export const ANATOMY: Idea[] = [
  { id: "name", zone: "name", title: "Name", summary: "The card's name. Rules that say \"this\" mean the card by name.", why: "When a card refers to its own name, it means this copy, not every copy.", leadsTo: [{ label: "Mana cost", target: "cost" }] },
  { id: "cost", zone: "cost", title: "Mana cost", summary: "The symbols at the top right: what you pay to cast it. A number is \"any mana\"; a coloured symbol must be that colour.", why: "Cost decides when you can play a card. Cheap cards come down early; expensive cards win later.", leadsTo: [{ label: "Mana and colours", target: "mana" }] },
  { id: "art", zone: "art", title: "Art", summary: "The picture. It has no effect on the rules.", why: "Art tells you the mood and the colour at a glance, which helps you find cards quickly.", leadsTo: [{ label: "Type line", target: "type" }] },
  { id: "type", zone: "type", title: "Type line", summary: "What the card is: Creature, Land, Instant and so on, then its subtypes after the dash.", why: "The type decides how and when you can play the card, and which other cards affect it.", leadsTo: [{ label: "The card types", target: "types" }] },
  { id: "set", zone: "set", title: "Set symbol and rarity", summary: "The small symbol by the type line shows which set the card came from. Its colour shows rarity: common, uncommon, rare, mythic rare.", why: "Rarity hints at power and price, and the set tells you where the card is legal.", leadsTo: [{ label: "Where cards come from", target: "sets" }] },
  { id: "rules", zone: "rules", title: "Rules text", summary: "What the card does. Keywords like Vigilance are shorthand for longer rules.", why: "This is the part you read when a card is new to you. Reminder text in italics explains the keyword.", leadsTo: [{ label: "The stack", target: "stack" }] },
  { id: "flavor", zone: "flavor", title: "Flavor text", summary: "A line of story in italics. It never affects the game.", why: "Knowing it is safe to skip saves reading time.", leadsTo: [{ label: "Power and toughness", target: "pt" }] },
  { id: "pt", zone: "pt", title: "Power and toughness", summary: "Creatures only. Power is the damage it deals; toughness is how much damage destroys it, reset each turn.", why: "Combat is a comparison of these two numbers.", leadsTo: [{ label: "Combat, step by step", target: "combat" }] },
  { id: "loyalty", zone: "loyalty", title: "Loyalty", summary: "Planeswalkers only. Starts at the printed number; abilities add or remove loyalty; at 0 it leaves.", why: "A planeswalker is a second target for attacks, so it changes how opponents plan their turns.", leadsTo: [{ label: "Card types", target: "types" }] },
  { id: "mana-ability", zone: "mana-ability", title: "Mana ability", summary: "Lands only (mostly). Tap the land to add mana of the colour shown.", why: "Lands are where almost all mana comes from, so a deck needs plenty of them.", leadsTo: [{ label: "Mana and colours", target: "mana" }] },
];

export const MANA: Idea[] = [
  { id: "mana", title: "What mana is", summary: "Mana is the resource you pay to cast cards. Tap a land to make one mana. Mana you don't spend disappears at the end of each step.", why: "Because mana empties out, you plan each turn around what your lands can make right now.", leadsTo: [{ label: "The five colours", target: "colours" }] },
  { id: "colours", title: "The five colours and colourless", summary: "White, blue, black, red and green each have a symbol and a personality. Colourless mana comes from some lands and artifacts and only pays for generic costs.", why: "A deck in one or two colours makes the right mana more often, which is why most beginner decks stay small on colours.", leadsTo: [{ label: "Card types", target: "types" }] },
];

export const TYPES: Idea[] = [
  { id: "types", title: "Creature", summary: "Stays on the battlefield. Can attack and block. Has power and toughness. Can't attack or tap the turn it arrives (summoning sickness).", why: "Creatures are how most games are won.", leadsTo: [{ label: "The full turn", target: "turn" }] },
  { id: "type-instant", title: "Instant", summary: "A one-time effect you can cast at almost any moment, even on an opponent's turn.", why: "Instants are the surprises: a block that kills, a spell that gets countered.", leadsTo: [{ label: "The stack", target: "stack" }] },
  { id: "type-sorcery", title: "Sorcery", summary: "A one-time effect you can cast only on your own turn, in a main phase, when nothing else is happening.", why: "Sorceries are usually stronger than instants to pay for the timing limit.", leadsTo: [{ label: "The full turn", target: "turn" }] },
  { id: "type-enchantment", title: "Enchantment", summary: "Stays on the battlefield and keeps doing something. An Aura attaches to a creature or land.", why: "Enchantments change the rules of the game while they stay out.", leadsTo: [{ label: "Artifact", target: "type-artifact" }] },
  { id: "type-artifact", title: "Artifact", summary: "Usually colourless. Equipment attaches to creatures; other artifacts make mana or give effects.", why: "Artifacts fit in any deck because most have no colour.", leadsTo: [{ label: "Planeswalker", target: "type-planeswalker" }] },
  { id: "type-planeswalker", title: "Planeswalker", summary: "An ally with loyalty counters. Once per turn, use one loyalty ability. Opponents can attack it.", why: "A planeswalker left alone will win the game by itself, so it draws attacks.", leadsTo: [{ label: "Battle", target: "type-battle" }] },
  { id: "type-battle", title: "Battle", summary: "A newer type. It enters with defense counters and an opponent protects it. Attack it to remove counters; when they are gone, it flips into a reward.", why: "You will see battles in recent sets, so it helps to know they are attacked, not cast at someone.", leadsTo: [{ label: "Land", target: "type-land" }] },
  { id: "type-land", title: "Land", summary: "Not cast: played, one per turn, for free. Tap it for mana.", why: "The one-land-a-turn rule paces the whole game.", leadsTo: [{ label: "Mana", target: "mana" }] },
];

export const TURN: FlowStep[] = [
  { id: "untap", title: "Untap", summary: "Untap everything you control.", detail: "Tapped cards turn sideways when used. At the start of your turn they all stand back up." , terms: [{ word: "Tap", plain: "Turn a card sideways to show it has been used this turn." }] },
  { id: "upkeep", title: "Upkeep", summary: "Some cards trigger here.", detail: "Most turns nothing happens. Cards that say \"at the beginning of your upkeep\" happen now." },
  { id: "draw", title: "Draw", summary: "Draw one card.", detail: "The player who goes first skips this draw on their first turn. Drawing from an empty library loses the game." },
  { id: "main1", title: "First main phase", summary: "Play a land, cast creatures and sorceries.", detail: "You may play one land per turn, in either main phase. Creatures cast now can't attack this turn (summoning sickness), so most players cast them before combat anyway to have mana left for later.", terms: [{ word: "Summoning sickness", plain: "A creature can't attack or use tap abilities until you have controlled it since the start of your turn." }] },
  { id: "combat", title: "Combat", summary: "Attack with untapped creatures.", detail: "Combat has its own steps: choose attackers, the defender chooses blockers, then damage. See the worked example below." },
  { id: "main2", title: "Second main phase", summary: "Cast more, or play your land now.", detail: "Anything you could do in the first main phase you can do here. Many players hold the land until now in case combat changed the plan." },
  { id: "end", title: "End step", summary: "End-of-turn triggers, then clean-up.", detail: "Damage on creatures heals, \"until end of turn\" effects stop, and you discard down to seven cards in hand if you have more." },
];

export const COMBAT: FlowStep[] = [
  { id: "declare-attack", title: "Declare attackers", summary: "Your 2/2 Lantern Fox attacks. It would tap, but Vigilance keeps it untapped.", detail: "Attacking creatures normally tap. You choose which opponent or planeswalker each one attacks." },
  { id: "declare-block", title: "Declare blockers", summary: "The defender blocks with a 1/3 creature.", detail: "Each blocker blocks one attacker. An unblocked attacker deals its damage to the player." },
  { id: "instant", title: "A spell in response", summary: "You cast an instant: Lantern Fox gets +2/+2 until end of turn. It goes on the stack.", detail: "The stack is the waiting line for spells and abilities. The last thing added resolves first. Your opponent could respond before it resolves; here they pass.", terms: [{ word: "The stack", plain: "Where spells wait before they happen. Last in, first out." }, { word: "Respond", plain: "Cast an instant or use an ability while something is on the stack, so yours happens first." }] },
  { id: "damage", title: "Combat damage", summary: "Lantern Fox is now 4/4. It deals 4 to the 1/3 blocker, which is destroyed. The blocker deals 1 to the Fox, which survives.", detail: "Damage is dealt at the same time. A creature with damage equal to or more than its toughness is destroyed. Damage heals at the end of the turn." },
  { id: "after", title: "After combat", summary: "The Fox stays untapped thanks to Vigilance, so it can still block next turn.", detail: "Now you are in the second main phase: cast more, or play a land if you haven't." },
];

export const PARTS: { id: string; title: string }[] = [
  { id: "win", title: "How you win" }, { id: "anatomy", title: "Parts of a card" }, { id: "mana", title: "Mana and colours" }, { id: "types", title: "Card types" }, { id: "turn", title: "A full turn" }, { id: "stack", title: "Combat and the stack" },
];
