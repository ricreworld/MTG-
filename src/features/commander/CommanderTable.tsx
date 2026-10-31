// The four-player Commander table: three opponents across the felt, you at the bottom, one sticky bar
// that always says what to do. All rules live in the engine; all pacing in CommanderMachine.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "../../components/Icon";
import { type CDef } from "../../game/commander/cards";
import { advise, threatLabel } from "../../game/commander/coach";
import { activated, allBlocksIn, canActivate, canAttack, canBlock, canPlayLand, castable, commanderCost, canAfford, def, describeSpec, find, isCreature, isLand, isMain, player, type Action, type CState, type Perm, type Seat, type Step, type Target } from "../../game/commander/engine";
import { CommanderMachine, type CSnapshot } from "../../table/cmachine";
import { useSettings } from "../../theme/SettingsContext";
import { EffectsLayer, playBatch, type Ghost } from "../table/cues";
import { CommanderCard } from "./CommanderCard";

const PHASES: { step: Step; label: string }[] = [
  { step: "main1", label: "Main 1" }, { step: "attackers", label: "Attack" }, { step: "blockers", label: "Block" }, { step: "main2", label: "Main 2" }, { step: "end", label: "End" },
];

interface Props {
  initial: CState;
  deckId: string;
  onExit: () => void;
  onNewGame: () => void;
  onReadMore: (moduleId: string) => void;
}

const sameTarget = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b);

export const CommanderTable = forwardRef<HTMLHeadingElement, Props>(function CommanderTable({ initial, deckId, onExit, onNewGame, onReadMore }, headingRef) {
  const { settings } = useSettings();
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motion = reducedMotion ? "off" : settings.motion;
  const machine = useMemo(() => { const m = new CommanderMachine({ initial, deckId, motion, sound: settings.sound, autoResolve: settings.autoPlay, save: true }); m.start(); return m; }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { machine.configure({ motion, sound: settings.sound, autoResolve: settings.autoPlay }); }, [machine, motion, settings.sound, settings.autoPlay]);
  const snap = useSyncExternalStore((fn) => machine.subscribe(fn), () => machine.snapshot(), () => machine.snapshot());
  const { state, mode, feedback, pending } = snap as CSnapshot;

  const [handPick, setHandPick] = useState<string | null>(null);
  const [permPick, setPermPick] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [openSeat, setOpenSeat] = useState<Seat | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const prevCards = useRef<Map<string, string>>(new Map());
  const effects = useMemo(() => new EffectsLayer(), []);
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => { effects.mount(document.body); return () => effects.unmount(); }, [effects]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nowRects = new Map<string, DOMRect>();
    const nowCards = new Map<string, string>();
    root.querySelectorAll<HTMLElement>("[data-uid]").forEach((el) => { const uid = el.dataset.uid!; nowRects.set(uid, el.getBoundingClientRect()); nowCards.set(uid, el.dataset.card ?? ""); });
    if (pending && pending.total > 0 && !skipRef.current) {
      const skip = playBatch({ root, batch: pending, motion, sound: settings.sound, prevRects: prevRects.current, nowRects, prevCards: prevCards.current, effects, setGhosts, onDone: () => { if (skipRef.current !== skip) return; skipRef.current = null; machine.cuesDone(); } });
      skipRef.current = skip;
    }
    prevRects.current = nowRects;
    prevCards.current = nowCards;
  }, [snap, pending, motion, settings.sound, effects, machine]);
  useEffect(() => () => { skipRef.current?.(); }, []);

  const busy = !!pending && pending.total > 0;
  const skipCues = () => { skipRef.current?.(); };
  const act = (a: Action) => { if (busy) skipCues(); setHandPick(null); setPermPick(null); machine.act(a); };
  const undo = () => { skipRef.current?.(); machine.undo(); setHandPick(null); setPermPick(null); };

  /* ---------- derived ---------- */
  const me = state.human;
  const my = player(state, me);
  const myTurn = state.turn === me;
  const advice = useMemo(() => advise(state), [state]);
  const seatsClockwise = state.seats.slice(state.seats.indexOf(me) + 1).concat(state.seats.slice(0, state.seats.indexOf(me)));
  const mine = state.battlefield.filter((p) => p.controller === me);
  const creatures = (list: Perm[]) => list.filter((p) => isCreature(state, p));
  const lands = (list: Perm[]) => list.filter((p) => isLand(state, p));
  const others = (list: Perm[]) => list.filter((p) => !isCreature(state, p) && !isLand(state, p));
  const stackTop = state.stack[state.stack.length - 1];
  const pend = state.pending;
  const canCast = useMemo(() => new Set(castable(state, me)), [state, me]);
  const inCombat = state.step === "blockers" || state.step === "damage";
  const defendingMe = state.step === "blockers" && !myTurn && Object.values(state.attackers).some((a) => a.defender === me) && !state.blocksDone.includes(me);
  const nameOf = (seat: Seat) => (seat === me ? "You" : player(state, seat).name);
  const cardOf = (uid: string): CDef => def(state, state.cards[uid] ?? "");
  const isCandidate = (t: Target) => !!pend && pend.candidates.some((c) => sameTarget(c, t)) && !pend.chosen.some((c) => sameTarget(c, t));

  const permBadge = (p: Perm): string | undefined => {
    const a = state.attackers[p.uid];
    if (a && inCombat) { const bl = a.blockers.map((b) => def(state, find(state, b)?.card ?? "").name).filter(Boolean); return `Attacking ${a.defender === me ? "you" : nameOf(a.defender)}${bl.length ? ` · blocked by ${bl.join(", ")}` : ""}`; }
    if (a) return `Attacking ${a.defender === me ? "you" : nameOf(a.defender)}`;
    const blocks = inCombat ? Object.entries(state.attackers).find(([, x]) => x.blockers.includes(p.uid)) : undefined;
    if (blocks) return `Blocks ${def(state, find(state, blocks[0])?.card ?? "").name}`;
    if (state.selectedAttackers.includes(p.uid)) return "Will attack";
    if (state.pendingBlocker === p.uid) return "Chosen to block";
    if (p.attachedTo) { const host = find(state, p.attachedTo); if (host) return `On ${def(state, host.card).name}`; }
    const bits: string[] = [];
    if (p.isCommander) bits.push("Commander");
    if (p.summoningSick && isCreature(state, p) && !def(state, p.card).abilities.some((x) => x.kind === "keyword" && x.name === "Haste")) bits.push("Arrived this turn");
    if (p.bonus.pacified) bits.push("Can't attack or block");
    return bits.length ? bits.join(" · ") : undefined;
  };

  const permTap = (p: Perm): { label: string; onClick: () => void; prompt?: string } => {
    const card = def(state, p.card);
    const t: Target = { kind: "perm", uid: p.uid };
    if (pend) {
      if (isCandidate(t)) return { label: `Choose ${card.name} as the target of ${pend.cardName}`, onClick: () => act({ type: "chooseTarget", target: t }), prompt: "Target" };
      return { label: "Not a legal target", onClick: () => machine.say(`${pend.cardName} can't target ${card.name}: it needs ${describeSpec(pend.specs[Math.min(pend.chosen.length, pend.specs.length - 1)] ?? "")}.`) };
    }
    if (p.controller === me) {
      if (myTurn && state.step === "attackers" && isCreature(state, p)) {
        const chosen = state.selectedAttackers.includes(p.uid) || !!state.attackers[p.uid];
        return { label: chosen ? "Remove from the attack" : "Choose as an attacker", onClick: () => act({ type: "toggleAttacker", uid: p.uid }), ...(canAttack(state, p) && !chosen ? { prompt: "Can attack" } : {}) };
      }
      if (defendingMe && isCreature(state, p)) {
        const blocking = Object.values(state.attackers).some((a) => a.blockers.includes(p.uid));
        return { label: state.pendingBlocker === p.uid ? "Unselect blocker" : blocking ? "Remove this block" : "Choose as a blocker", onClick: () => act({ type: "pickBlocker", uid: p.uid }), ...(!p.tapped && !blocking && state.pendingBlocker !== p.uid && !p.bonus.cantBlock ? { prompt: "Can block" } : {}) };
      }
      const usable = activated(state, p).filter(({ ability }) => canActivate(state, me, p, ability));
      return { label: usable.length ? `Options for ${card.name}` : `About ${card.name}`, onClick: () => { setHandPick(null); setPermPick(permPick === p.uid ? null : p.uid); }, ...(usable.length ? { prompt: "Can use" } : {}) };
    }
    if (defendingMe && state.attackers[p.uid]?.defender === me && state.pendingBlocker) {
      const blocker = find(state, state.pendingBlocker);
      return { label: `Block ${card.name}`, onClick: () => act({ type: "assignBlock", attackerUid: p.uid }), ...(blocker && canBlock(state, blocker, p) ? { prompt: "Tap to block it" } : {}) };
    }
    return { label: `About ${card.name}`, onClick: () => machine.say(`${card.name} belongs to ${nameOf(p.controller)}.${card.text ? ` It says: ${card.text.replace(/\n/g, " ")}` : ""}`) };
  };

  const sprite = (p: Perm, size: "sm" | "md" = "md") => {
    const t = permTap(p);
    return (
      <div key={p.uid} data-uid={p.uid} data-card={p.card} className="card-shadow">
        <CommanderCard card={def(state, p.card)} state={state} perm={p} size={size} badge={permBadge(p)} selected={state.selectedAttackers.includes(p.uid) || state.pendingBlocker === p.uid || !!(pend && pend.chosen.some((c) => c.kind === "perm" && c.uid === p.uid))} action={t.label} onClick={t.onClick} highlight={t.prompt} />
      </div>
    );
  };

  const targetText = (sp: { targets: Target[] }) => sp.targets.map((t) => (t.kind === "player" ? (t.seat === me ? "you" : nameOf(t.seat)) : t.kind === "perm" ? def(state, find(state, t.uid)?.card ?? "").name : def(state, state.stack.find((x) => x.uid === t.uid)?.card ?? "").name)).filter(Boolean).join(" and ");

  /** The one thing to do now. */
  const now = ((): { text: string; button: string; action: Action | (() => void); secondary?: { label: string; action: Action | (() => void) } } => {
    if (busy) return { text: "Watch what happens, or skip ahead.", button: "Skip ahead", action: skipCues };
    if (mode === "VICTORY") return { text: "You're the last player standing. You won!", button: "New game", action: onNewGame };
    if (mode === "DEFEAT") return { text: state.winner ? `${nameOf(state.winner)} won this game.` : "You're out of this game. Undo to try another line, or start a new game.", button: "New game", action: onNewGame, ...(state.winner ? {} : { secondary: { label: "Watch how it ends", action: () => machine.continueOthers() } }) };
    if (pend) {
      const spec = pend.specs[Math.min(pend.chosen.length, pend.specs.length - 1)] ?? "";
      const left = pend.max > 1 ? ` (up to ${pend.max})` : "";
      return { text: `${pend.cardName}: tap ${describeSpec(spec)}${left}.${pend.chosen.length ? ` Chosen so far: ${targetText({ targets: pend.chosen })}.` : ""}`, button: pend.chosen.length || pend.optional ? "Done choosing" : `Cancel ${pend.cardName}`, action: pend.chosen.length || pend.optional ? { type: "doneTargets" } : { type: "cancelTarget" }, ...(pend.chosen.length || pend.optional ? { secondary: { label: `Cancel ${pend.cardName}`, action: { type: "cancelTarget" } } } : {}) };
    }
    if (stackTop && stackTop.caster !== me) {
      const resp = my.hand.filter((u) => canCast.has(u) && cardOf(u).kind !== "land");
      return { text: `${nameOf(stackTop.caster)} cast ${def(state, stackTop.card).name}${stackTop.targets.length ? `, aimed at ${targetText(stackTop)}` : ""}. ${resp.length ? `You can respond with ${cardOf(resp[0]!).name} from your hand, or let it happen.` : "Let it happen."}`, button: `Let ${def(state, stackTop.card).name} happen`, action: { type: "pass" } };
    }
    if (stackTop) return { text: `${def(state, stackTop.card).name} is on the stack. Continue to let it happen.`, button: "Continue", action: { type: "pass" } };
    if (!myTurn && defendingMe) {
      const incoming = Object.entries(state.attackers).filter(([, a]) => a.defender === me);
      const blocks = incoming.filter(([, a]) => a.blockers.length).length;
      return { text: state.pendingBlocker ? "Now tap the attacker it should block." : `${nameOf(state.turn)} attacks you with ${incoming.map(([u]) => def(state, find(state, u)?.card ?? "").name).join(", ")}. Tap one of your creatures, then the attacker it blocks (${blocks} block${blocks === 1 ? "" : "s"} set). Or take the damage.`, button: blocks ? `Confirm ${blocks} block${blocks === 1 ? "" : "s"}` : "No blocks, take the damage", action: { type: "declareBlockers" } };
    }
    if (!myTurn) return { text: `${nameOf(state.turn)} is taking their turn.`, button: "Continue", action: () => machine.continueOthers() };
    if (state.step === "main1" || state.step === "main2") {
      const parts: string[] = [];
      if (my.hand.some((u) => cardOf(u).kind === "land") && canPlayLand(state, me)) parts.push("play a land");
      if (my.hand.some((u) => canCast.has(u) && cardOf(u).kind !== "land")) parts.push("cast a card from your hand");
      const cc = commanderCost(state, me);
      if (cc !== null && canAfford(state, me, cc)) parts.push("cast your commander");
      if (mine.some((p) => activated(state, p).some(({ ability }) => canActivate(state, me, p, ability)))) parts.push("use a card on the table");
      const todo = parts.length ? `You can ${parts.join(", ")}. ` : "";
      if (state.step === "main1") {
        const ready = creatures(mine).filter((p) => canAttack(state, p));
        if (ready.length) return { text: `${todo}When you're ready, go to combat.`, button: "Go to combat", action: { type: "goToCombat" }, secondary: { label: "Skip combat and end the turn", action: () => { if (busy) skipCues(); setHandPick(null); setPermPick(null); machine.endTurnFromMain1(); } } };
        return { text: `${todo}No creature of yours can attack this turn, so end the turn when you're done.`, button: "End turn", action: () => { if (busy) skipCues(); setHandPick(null); setPermPick(null); machine.endTurnFromMain1(); } };
      }
      return { text: todo ? `${todo}Then end your turn.` : "Nothing left to do. End your turn.", button: "End turn", action: { type: "endTurn" } };
    }
    if (state.step === "attackers") {
      const n = state.selectedAttackers.length;
      const assigned = Object.keys(state.attackers).length;
      if (n) return { text: `${n} creature${n === 1 ? "" : "s"} chosen. Now tap the opponent they should attack (the buttons on their seats).`, button: assigned ? `Attack with ${assigned}` : "Don't attack", action: { type: "declareAttackers" } };
      return { text: assigned ? `${assigned} attacker${assigned === 1 ? "" : "s"} set. Tap more creatures to send them at someone else, or attack now.` : "Tap the creatures that should attack, then the opponent they attack.", button: assigned ? `Attack with ${assigned}` : "Don't attack", action: { type: "declareAttackers" } };
    }
    if (state.step === "blockers" && allBlocksIn(state)) return { text: "Blocks are set (shown on the cards). Continue to see the damage.", button: "Continue to damage", action: { type: "dealDamage" } };
    if (state.step === "blockers") return { text: "Your opponents are choosing blocks.", button: "Continue", action: () => machine.continueOthers() };
    if (state.step === "damage") return { text: "Combat damage happens now.", button: "Continue", action: { type: "dealDamage" } };
    return { text: "End your turn.", button: "End turn", action: { type: "endTurn" } };
  })();

  const btn = "inline-flex min-h-tap items-center justify-center gap-s2 rounded-md px-s3 font-bold";
  const primary = `${btn} bg-accent text-accent-ink`;
  const secondary = `${btn} border-2 border-border-strong bg-surface`;
  const run = (a: Action | (() => void)) => (typeof a === "function" ? a() : act(a));
  const cmdDamageText = (d: Record<string, number>) => { const e = Object.entries(d); return e.length ? e.map(([card, n]) => `${n} of 21 from ${def(state, card).name}`).join("; ") : "none yet"; };

  const seatCard = (seat: Seat) => {
    const pl = player(state, seat);
    const theirs = state.battlefield.filter((p) => p.controller === seat);
    const cz = pl.commandZone;
    const playerTarget: Target = { kind: "player", seat };
    const canAttackThem = myTurn && state.step === "attackers" && state.selectedAttackers.length > 0 && !pl.out;
    const open = openSeat === seat;
    return (
      <div key={seat} className={`grid gap-s2 rounded-md border p-s2 ${pl.out ? "border-felt-ink/20 opacity-70" : state.turn === seat ? "border-accent" : "border-felt-ink/40"}`} aria-label={`${pl.name}'s seat`}>
        <p className="flex flex-wrap items-center gap-s2 font-bold">
          <span className="on-felt rounded-sm px-s2">{pl.name}{state.turn === seat ? " · their turn" : ""}</span>
          <span data-life={seat} className="on-felt inline-block rounded-sm px-s2 font-mono">Life {pl.life}</span>
          {pl.out ? <span className="on-felt rounded-sm px-s2 text-sm font-normal">Out of the game</span> : <span className="on-felt rounded-sm px-s2 text-sm font-normal">{threatLabel(state, seat) || "In the game"} · Hand {pl.hand.length} · Library {pl.library.length}</span>}
        </p>
        {!pl.out && (
          <div className="flex flex-wrap items-start gap-s2">
            <div data-uid={`cz-${seat}`} data-card={cz.card} className="card-shadow">
              <CommanderCard card={def(state, cz.card)} size="sm" badge={cz.inZone ? (cz.casts ? `In command zone · tax +${2 * cz.casts}` : "In command zone") : "On the battlefield"} />
            </div>
            <div className="grid gap-s1 text-sm">
              <span className="on-felt rounded-sm px-s2">Commander damage taken: {cmdDamageText(pl.commanderDamage)}</span>
              <span className="on-felt rounded-sm px-s2">{lands(theirs).length} land{lands(theirs).length === 1 ? "" : "s"} ({lands(theirs).filter((p) => !p.tapped).length} untapped), {others(theirs).length} other permanent{others(theirs).length === 1 ? "" : "s"}</span>
              {canAttackThem && <button type="button" onClick={() => act({ type: "attackPlayer", seat })} className={primary}>Attack {pl.name}</button>}
              {pend && isCandidate(playerTarget) && <button type="button" onClick={() => act({ type: "chooseTarget", target: playerTarget })} className={primary}>Target {pl.name}</button>}
            </div>
          </div>
        )}
        {!pl.out && (
          <div className="flex flex-wrap gap-s2">
            {creatures(theirs).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No creatures.</p>}
            {creatures(theirs).map((p) => sprite(p, "sm"))}
          </div>
        )}
        {!pl.out && (others(theirs).length > 0 || lands(theirs).length > 0) && (
          <div>
            <button type="button" onClick={() => setOpenSeat(open ? null : seat)} aria-expanded={open} className="on-felt rounded-sm px-s2 text-sm underline">{open ? "Hide" : "Show"} their lands and other cards</button>
            {open && <div className="mt-s2 flex flex-wrap gap-s2">{[...others(theirs), ...lands(theirs)].map((p) => sprite(p, "sm"))}</div>}
          </div>
        )}
      </div>
    );
  };

  const myCandidate = isCandidate({ kind: "player", seat: me });

  return (
    <section aria-labelledby="cmd-heading" className="grid gap-s3 pb-[13rem]" ref={rootRef}>
      <p className="sr-only" aria-live="polite">{pending?.announce ?? ""}</p>

      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <div className="flex flex-wrap items-center justify-between gap-s2">
          <h2 id="cmd-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold">Commander: four players</h2>
          <button type="button" onClick={onExit} className={secondary}><Icon name="back" /> Leave (game is saved)</button>
        </div>
        <ol className="flex flex-wrap gap-s1" aria-label="Turn phases">
          {PHASES.map((ph) => {
            const current = ph.step === state.step || (state.step === "damage" && ph.step === "blockers");
            return <li key={ph.step} aria-current={current ? "step" : undefined} className={`rounded-sm px-s2 py-s1 text-sm ${current ? "bg-accent font-bold text-accent-ink" : "bg-surface-2 text-text-muted"}`}>{current ? "▸ " : ""}{ph.label}</li>;
          })}
          <li className="ml-auto self-center text-sm text-text-muted">Turn {state.turnNumber} · {myTurn ? "Your turn" : `${nameOf(state.turn)}'s turn`}</li>
        </ol>
      </div>

      <div className="felt rail grid gap-s3 rounded-xl p-s3">
        <div className="grid gap-s2 lg:grid-cols-3">{seatsClockwise.map(seatCard)}</div>

        {state.stack.length > 0 && (
          <div className="on-felt grid gap-s1 rounded-lg border-2 border-dashed border-accent p-s3">
            <p className="font-bold">On the stack <span className="text-sm font-normal text-text-muted">(top happens first)</span></p>
            <ol className="grid gap-s1">
              {[...state.stack].reverse().map((item, i) => {
                const t: Target = { kind: "spell", uid: item.uid };
                return <li key={item.uid} className="flex flex-wrap items-center gap-s2 text-sm">{i === 0 ? "▸ " : ""}{item.caster === me ? "Your" : `${nameOf(item.caster)}'s`} <strong>{def(state, item.card).name}</strong>{item.targets.length ? ` → ${targetText(item)}` : ""}{pend && isCandidate(t) && <button type="button" onClick={() => act({ type: "chooseTarget", target: t })} className={`${primary} min-h-[2.25rem]`}>Target this spell</button>}</li>;
              })}
            </ol>
          </div>
        )}

        <div className="h-px bg-felt-ink/25" aria-hidden="true" />

        <div className="grid gap-s2" aria-label="Your seat">
          <p className="flex flex-wrap items-center gap-s2 font-bold">
            <span className="on-felt rounded-sm px-s2">You{myTurn ? " · your turn" : ""}</span>
            <span data-life={me} className="on-felt inline-block rounded-sm px-s2 font-mono">Life {my.life}</span>
            <span className="on-felt rounded-sm px-s2 text-sm font-normal">Library {my.library.length} · Graveyard {my.graveyard.length}</span>
            <span className="on-felt rounded-sm px-s2 text-sm font-normal">Commander damage taken: {cmdDamageText(my.commanderDamage)}</span>
            {myCandidate && <button type="button" onClick={() => act({ type: "chooseTarget", target: { kind: "player", seat: me } })} className={primary}>Target yourself</button>}
          </p>
          <div className="flex flex-wrap gap-s2">
            {creatures(mine).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No creatures on the battlefield.</p>}
            {creatures(mine).map((p) => sprite(p))}
          </div>
          {others(mine).length > 0 && <div className="flex flex-wrap gap-s2">{others(mine).map((p) => sprite(p, "sm"))}</div>}
          <div className="flex flex-wrap items-end gap-s2">
            {lands(mine).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No lands yet.</p>}
            {lands(mine).map((p) => sprite(p, "sm"))}
            {Object.values(my.pool).some(Boolean) && <p className="on-felt rounded-sm px-s2 text-sm">Mana pool: {Object.entries(my.pool).filter(([, n]) => n).map(([c, n]) => `${n} ${c}`).join(", ")}</p>}
          </div>
          {permPick && find(state, permPick) && (() => {
            const p = find(state, permPick)!; const card = def(state, p.card);
            const abilities = activated(state, p);
            return (
              <div className="on-felt grid gap-s2 rounded-md p-s2" role="group" aria-label={`Options for ${card.name}`}>
                <span className="text-sm"><strong>{card.name}</strong>{card.text ? `: ${card.text.replace(/\n/g, " ")}` : ""}</span>
                <div className="flex flex-wrap gap-s2">
                  {abilities.map(({ index, ability }) => {
                    const ok = canActivate(state, me, p, ability);
                    const label = ability.kind === "equip" ? `Equip a creature (${typeof ability.cost === "string" ? `{${ability.cost}}` : ""})` : `Use: ${card.text.split("\n").find((l) => l.includes(":"))?.split(":")[0] ?? "ability"}`;
                    return <button key={index} type="button" disabled={!ok} onClick={() => act({ type: "activate", uid: p.uid, index })} className={`${ok ? primary : secondary} disabled:opacity-50`}>{label}</button>;
                  })}
                  <button type="button" onClick={() => setPermPick(null)} className={secondary}>Close</button>
                </div>
                {!abilities.length && <span className="text-sm text-text-muted">{isLand(state, p) ? "Lands are tapped for mana automatically when you cast something." : isCreature(state, p) ? "Creatures attack in your attack step and block when someone attacks you." : "This card works on its own."}</span>}
              </div>
            );
          })()}
          <div className="flex flex-wrap items-start gap-s3 rounded-md border border-dashed border-felt-ink/40 p-s2">
            <span className="on-felt rounded-sm px-s2 text-sm font-bold">Your command zone</span>
            {my.commandZone.inZone ? (() => {
              const cz = my.commandZone; const cost = commanderCost(state, me) ?? ""; const ok = myTurn && isMain(state) && !state.stack.length && canAfford(state, me, cost);
              return <>
                <div data-uid={`cz-${me}`} data-card={cz.card} className="card-shadow"><CommanderCard card={def(state, cz.card)} size="sm" badge={cz.casts ? `Tax +${2 * cz.casts}` : undefined} highlight={ok ? "Can cast" : undefined} action={`Cast commander for ${cost}`} onClick={() => act({ type: "castCommander" })} /></div>
                <span className="on-felt grid gap-s1 rounded-sm px-s2 py-s1 text-sm"><span>Costs <strong>{`{${cost}}`}</strong> now{cz.casts ? ` (${2 * cz.casts} of it is commander tax)` : ""}.</span><button type="button" onClick={() => act({ type: "castCommander" })} className={ok ? primary : secondary}>Cast commander</button></span>
              </>;
            })() : <span className="on-felt rounded-sm px-s2 text-sm">{def(state, my.commandZone.card).name} is on the battlefield. If it leaves, it comes back here.</span>}
          </div>
        </div>
      </div>

      <div className="tray grid gap-s2 rounded-lg p-s3">
        <p className="font-bold">Your hand <span className="text-sm font-normal opacity-90">({my.hand.length} card{my.hand.length === 1 ? "" : "s"})</span><span className="block text-sm font-normal opacity-90">Tap a card to play it. Mana is paid for you.</span></p>
        <div className="flex flex-wrap gap-s2">
          {my.hand.length === 0 && <p className="text-sm">Your hand is empty.</p>}
          {my.hand.map((uid) => {
            const card = cardOf(uid); const can = canCast.has(uid) && !pend;
            return (
              <div key={uid} data-uid={uid} data-card={card.id} className="card-shadow">
                <CommanderCard card={card} selected={handPick === uid} highlight={can ? (card.kind === "land" ? "Can play" : "Can cast") : undefined} action={can ? `${card.kind === "land" ? "Play" : "Cast"} ${card.name}` : "Open options"} onClick={() => (can ? act(card.kind === "land" ? { type: "playLand", uid } : { type: "cast", uid }) : (setPermPick(null), setHandPick(handPick === uid ? null : uid)))} />
              </div>
            );
          })}
        </div>
        {handPick && my.hand.includes(handPick) && (() => {
          const card = cardOf(handPick); const can = canCast.has(handPick) && !pend;
          return (
            <div className="on-felt grid gap-s2 rounded-md p-s2" role="group" aria-label={`Options for ${card.name}`}>
              <span className="text-sm"><strong>{card.name}</strong> · {card.type}{card.text ? `: ${card.text.replace(/\n/g, " ")}` : ""}</span>
              {!can && <span className="text-sm text-text-muted">{card.kind === "land" ? (my.landsPlayed >= 1 && myTurn ? "You've already played a land this turn." : "Lands are played in your own main phase.") : card.kind === "instant" ? "You can't cast it right now: not enough mana, or nothing for it to target." : myTurn && isMain(state) ? `You need {${card.cost}}. Play more lands first.` : "Cast it in your own main phase, when nothing is on the stack."}</span>}
              <div className="flex flex-wrap gap-s2">
                <button type="button" onClick={() => act(card.kind === "land" ? { type: "playLand", uid: handPick } : { type: "cast", uid: handPick })} className={can ? primary : secondary}>{card.kind === "land" ? "Play this land" : `Cast ${card.name}${card.cost ? ` ({${card.cost}})` : ""}`}</button>
                <button type="button" onClick={() => setHandPick(null)} className={secondary}>Close</button>
              </div>
            </div>
          );
        })()}
      </div>

      {ghosts.map((g) => (
        <div key={g.uid} data-ghost={g.uid} aria-hidden="true" className="pointer-events-none fixed z-10" style={{ left: g.left, top: g.top, width: g.width, height: g.height }}>
          <CommanderCard card={def(state, g.card)} size={g.width < 90 ? "sm" : "md"} />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-s2">
        {!confirmNew ? <button type="button" onClick={() => setConfirmNew(true)} className={secondary}>Start a new game</button> : <>
          <span className="text-sm">This replaces the saved game. Sure?</span>
          <button type="button" onClick={onNewGame} className={primary}>Yes, start over</button>
          <button type="button" onClick={() => setConfirmNew(false)} className={secondary}>Keep playing</button>
        </>}
        <button type="button" onClick={() => onReadMore("commander")} className={secondary}><Icon name="book" /> Read the Commander lesson</button>
        <span className="text-sm text-text-muted">Saved on this device after every move.</span>
      </div>
      <details className="rounded-lg border border-border bg-surface p-s3">
        <summary className="min-h-tap cursor-pointer content-center font-bold">Full game log</summary>
        <ol className="mt-s2 grid gap-s1 text-sm">{state.log.slice(-200).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
      <p className="text-sm text-text-muted">Real Foundations cards with their official rules text and art. © Wizards of the Coast LLC, used under the Fan Content Policy. Data via Scryfall.</p>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-s2 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-[64rem] gap-s2">
          {feedback && !busy && (
            <div role="status" className={`grid gap-s1 rounded-md p-s2 text-sm ${feedback.kind === "done" ? "bg-success-soft" : feedback.kind === "opp" ? "bg-surface-2" : "bg-hint-soft"}`}>
              <p className="flex items-start gap-s2"><span className={feedback.kind === "done" ? "text-success" : "text-hint"}><Icon name={feedback.kind === "done" ? "check" : "info"} size={1.1} /></span><span>{feedback.text}</span></p>
              {feedback.lines && <ul className="grid gap-[2px] pl-s5">{feedback.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              {feedback.kind === "coach" && snap.canUndo && <div><button type="button" onClick={undo} className={`${secondary} min-h-[2.25rem]`}>Undo that move</button></div>}
            </div>
          )}
          {advice && !state.winner && !busy && mode === "PLAYING" && (
            <p className="text-sm"><strong>Coach:</strong> {advice.move} <button type="button" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="underline">{showWhy ? "Hide why" : "Why?"}</button>{showWhy && <span className="block text-text-muted">{advice.why}</span>}</p>
          )}
          <p className="text-sm"><strong>Now:</strong> {now.text}</p>
          <div className="grid grid-cols-[auto_auto_1fr] gap-s2">
            <button type="button" onClick={undo} disabled={!snap.canUndo} className={`${secondary} disabled:opacity-50`}><Icon name="back" /> Undo</button>
            <button type="button" onClick={() => machine.hint()} className={secondary}><Icon name="info" /> Hint</button>
            <button type="button" data-main-button onClick={() => run(now.action)} className={primary}>{now.button} <Icon name="next" /></button>
          </div>
          {now.secondary && !busy && <div><button type="button" onClick={() => run(now.secondary!.action)} className="text-sm underline">{now.secondary.label}</button></div>}
        </div>
      </div>
    </section>
  );
});
