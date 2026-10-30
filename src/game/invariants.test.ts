// Plays many games the way the Practice Table does (auto-paying mana, auto-resolving the learner's spells)
// and checks state invariants after every action, so UI crashes like "Unknown card" show up here first.
import { describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { advise } from "./coach";
import { reduce, tapLandsFor, type Action, type GameState } from "./engine";
import { makeMatch } from "./match";
import { step } from "./scenarios";

function checkInvariants(s: GameState, where: string) {
  for (const uid of [...s.you.hand, ...s.opp.hand]) expect(s.cards[uid], `${where}: hand uid ${uid} has no card`).toBeTruthy();
  for (const item of s.stack) expect(CARDS[item.card], `${where}: stack card ${item.card}`).toBeTruthy();
  if (s.step === "blockers" || s.step === "damage") {
    for (const [a, b] of Object.entries(s.attackers)) {
      expect(s.battlefield.some((p) => p.uid === a), `${where}: attacker ${a} not on battlefield`).toBe(true);
      if (b) expect(s.battlefield.some((p) => p.uid === b), `${where}: blocker ${b} not on battlefield`).toBe(true);
    }
  }
  if (s.pendingBlocker) expect(s.battlefield.some((p) => p.uid === s.pendingBlocker)).toBe(true);
  if (s.pendingTarget) expect(s.cards[s.pendingTarget]).toBeTruthy();
}

describe("state invariants hold through whole games played like the table does", () => {
  it("across decks, modes and seeds", () => {
    const pairs: [string, string, "standard" | "commander"][] = [
      ["red-fire", "green-growth", "standard"], ["white-legion", "black-red-blood", "standard"], ["blue-white-sky", "red-fire", "standard"],
      ["green-growth", "white-legion", "commander"], ["black-red-blood", "green-growth", "commander"], ["white-legion", "black-red-blood", "commander"],
    ];
    let games = 0;
    for (const [yourDeck, oppDeck, mode] of pairs) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const match = makeMatch({ yourDeck, oppDeck, seed, mode });
        let s = match.setup();
        const act = (action: Action, from: GameState = s) => {
          let next = step(match, from, action);
          if (next.refusal) throw new Error(`${yourDeck} vs ${oppDeck} seed ${seed}: refused ${action.type}: ${next.refusal}`);
          let guard = 0;
          while (!next.result && next.stack.length && next.stack[next.stack.length - 1]?.caster === "you" && guard++ < 5) {
            const r = step(match, next, { type: "pass" }); if (r.refusal) break; next = r;
          }
          checkInvariants(next, `${yourDeck} vs ${oppDeck} seed ${seed} after ${action.type}`);
          s = next;
        };
        const pay = (cost: string | undefined) => (cost && !canPayNow(s, cost) ? tapLandsFor(s, "you", cost) ?? s : s);
        let guard = 0;
        while (!s.result && guard++ < 600) {
          const a = advise(s);
          if (!a) throw new Error(`no advice at ${s.turn} ${s.step}`);
          const m = a.move;
          if (s.stack.length) act({ type: "pass" });
          else if (m.startsWith("Play ")) act({ type: "playLand", uid: s.you.hand.find((u) => CARDS[s.cards[u]!]?.kind === "land")! });
          else if (m.includes("from the command zone")) { const cz = s.you.commandZone!; const cost = `${(CARDS[cz.card]!.cost ?? "").replace(/\d+/g, "")}`; const generic = Number((CARDS[cz.card]!.cost ?? "").match(/\d+/)?.[0] ?? 0) + 2 * cz.casts; act({ type: "castCommander" }, pay(`${generic || ""}${cost}`)); }
          else if (m.startsWith("Cast ")) { const name = m.slice(5, -1); const uid = s.you.hand.find((u) => CARDS[s.cards[u]!]?.name === name)!; act({ type: "cast", uid }, pay(CARDS[s.cards[uid]!]!.cost)); }
          else if (m.startsWith("Go to combat")) { act({ type: "goToCombat" }); const names = m.replace("Go to combat and attack with ", "").replace(/\.$/, "").split(" and "); for (const nm of names) { const p = s.battlefield.find((p) => p.owner === "you" && CARDS[p.card]!.name === nm && !s.selectedAttackers.includes(p.uid) && !p.tapped && (!p.summoningSick || CARDS[p.card]!.keywords?.includes("Haste"))); if (p) act({ type: "toggleAttacker", uid: p.uid }); } act({ type: "declareAttackers" }); }
          else if (m.startsWith("Skip combat")) { act({ type: "skipCombat" }); act({ type: "endTurn" }); }
          else if (m.startsWith("End your turn")) act({ type: "endTurn" });
          else if (m.startsWith("Continue to damage")) act(s.step === "blockers" ? { type: "declareBlockers" } : { type: "dealDamage" });
          else if (s.turn === "opp" && s.step === "blockers") {
            for (const part of m.split("; ")) { const mm = /^(.*) blocks (.*?)\.?$/.exec(part); if (!mm) continue; const bl = s.battlefield.find((p) => p.owner === "you" && CARDS[p.card]!.name === mm[1] && !p.tapped && !Object.values(s.attackers).includes(p.uid)); const at = s.battlefield.find((p) => p.owner === "opp" && CARDS[p.card]!.name === mm[2] && !s.attackers[p.uid]); if (bl && at) { act({ type: "pickBlocker", uid: bl.uid }); act({ type: "assignBlock", attackerUid: at.uid }); } }
            act({ type: "declareBlockers" });
          }
          else if (m.startsWith("Don't attack") || m.startsWith("Attack with")) act({ type: "declareAttackers" });
          else throw new Error(`unhandled advice: ${m}`);
        }
        expect(s.result, `${yourDeck} vs ${oppDeck} seed ${seed} never ended`).not.toBeNull();
        games++;
      }
    }
    expect(games).toBe(36);
  });
});

function canPayNow(s: GameState, cost: string): boolean {
  const need: Record<string, number> = {}; let generic = 0;
  for (const sym of cost.match(/\d+|[WUBRG]/g) ?? []) { if (/\d/.test(sym)) generic += Number(sym); else need[sym] = (need[sym] ?? 0) + 1; }
  let spare = 0;
  for (const c of ["W", "U", "B", "R", "G"]) { const have = s.you.pool[c as "W"] ?? 0; const want = need[c] ?? 0; if (have < want) return false; spare += have - want; }
  return spare >= generic;
}
void reduce;
