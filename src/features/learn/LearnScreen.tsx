// Screen A: Learn to play. A pinned example card lights the part being taught; the rest unfolds below.
import { forwardRef, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Callout } from "../../components/ui/Callout";
import { EXAMPLE_CARDS, ExampleCard, type CardShape, type ZoneId } from "../../components/ui/ExampleCard";
import { LessonStep } from "../../components/ui/LessonStep";
import { ProgressMarker } from "../../components/ui/ProgressMarker";
import { StepFlow } from "../../components/ui/StepFlow";
import { ANATOMY, COMBAT, LEARN_LAST_VERIFIED, MANA, PARTS, TURN, TYPES, WIN, type Idea } from "../../content/learn";

interface Props { onJump: (target: string) => void }

const SHAPES: { id: CardShape; label: string }[] = [{ id: "creature", label: "Creature" }, { id: "planeswalker", label: "Planeswalker" }, { id: "land", label: "Land" }];

export const LearnScreen = forwardRef<HTMLHeadingElement, Props>(function LearnScreen({ onJump }, ref) {
  const [shape, setShape] = useState<CardShape>("creature");
  const [lit, setLit] = useState<ZoneId | null>(null);
  const [part, setPart] = useState(0);
  const [scrolledPast, setScrolledPast] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const compact = scrolledPast && !keepOpen;
  const sentinel = useRef<HTMLDivElement>(null);

  // Shrink the card to a strip once the reader scrolls past the first screen; never on a timer.
  useEffect(() => {
    const el = sentinel.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { const past = !(e?.isIntersecting ?? true); setScrolledPast(past); if (!past) setKeepOpen(false); }, { threshold: 0 });
    io.observe(el); return () => io.disconnect();
  }, []);

  // Keep the progress marker honest: the part whose heading is nearest the top is "current".
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = PARTS.map((p) => document.getElementById(`part-${p.id}`)).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { const i = PARTS.findIndex((p) => `part-${p.id}` === e.target.id); if (i >= 0) setPart(i); } }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((e) => io.observe(e)); return () => io.disconnect();
  }, []);

  const jump = (target: string) => {
    const local = document.getElementById(target) ?? document.getElementById(`part-${target}`);
    if (local) { local.scrollIntoView({ block: "start" }); (local.querySelector<HTMLElement>("h3, h2") ?? local).focus?.(); return; }
    onJump(target);
  };
  const card = EXAMPLE_CARDS[shape];
  const anatomyFor = ANATOMY.filter((i) => {
    if (i.zone === "pt") return shape === "creature";
    if (i.zone === "loyalty") return shape === "planeswalker";
    if (i.zone === "mana-ability") return shape === "land";
    if (i.zone === "cost" || i.zone === "flavor") return shape !== "land" || i.zone === "cost";
    return true;
  }).filter((i) => !(shape === "land" && (i.zone === "cost" || i.zone === "flavor")) && !(shape === "planeswalker" && i.zone === "flavor"));

  const ideas = (list: Idea[]) => list.map((i) => (
    <LessonStep key={i.id} id={i.id} title={i.title} summary={i.summary} why={i.why} leadsTo={i.leadsTo} onJump={jump} active={!!i.zone && lit === i.zone} onActivate={i.zone ? () => setLit(i.zone!) : undefined} />
  ));

  return (
    <section aria-labelledby="learn-heading" className="grid gap-s4">
      <div className="grid gap-s2">
        <h2 id="learn-heading" ref={ref} tabIndex={-1} className="text-2xl">Learn to play</h2>
        <p>Six short parts. Tap any part of the example card to read about it. Nothing moves on its own.</p>
      </div>
      {/* Sits above the sticky card, so the card changing size can never move it: no flicker loop. */}
      <div ref={sentinel} aria-hidden="true" />

      <div className="sticky top-0 z-10 grid gap-s2 bg-bg py-s2">
        <ProgressMarker label={PARTS[part]?.title ?? ""} index={part} total={PARTS.length} />
        <div className="flex flex-wrap gap-s2" role="group" aria-label="Example card to show">
          {SHAPES.map((s) => <Button key={s.id} pressed={shape === s.id} onClick={() => { setShape(s.id); setLit(null); }}>{s.label}</Button>)}
        </div>
        <ExampleCard card={card} lit={lit} onPick={(z) => { setLit(z); const idea = ANATOMY.find((i) => i.zone === z); if (idea) jump(idea.id); }} compact={compact} onExpand={() => setKeepOpen(true)} />
      </div>
      <nav aria-label="Parts of this page" className="flex flex-wrap gap-s2">
        {PARTS.map((p, i) => <Button key={p.id} look="quiet" pressed={i === part} onClick={() => jump(`part-${p.id}`)}>{p.title}</Button>)}
      </nav>

      <section id="part-win" aria-labelledby="h-win" className="grid gap-s3"><h3 id="h-win" tabIndex={-1} className="text-xl">How you win</h3><p>Three ways. The first is the one you'll see most.</p>{ideas(WIN)}</section>
      <section id="part-anatomy" aria-labelledby="h-anatomy" className="grid gap-s3"><h3 id="h-anatomy" tabIndex={-1} className="text-xl">Parts of a card</h3><p>Tap a part of the card above, or a title below, and that part lights up.</p>{ideas(anatomyFor)}</section>
      <section id="part-mana" aria-labelledby="h-mana" className="grid gap-s3"><h3 id="h-mana" tabIndex={-1} className="text-xl">Mana and colours</h3>{ideas(MANA)}</section>
      <section id="part-types" aria-labelledby="h-types" className="grid gap-s3"><h3 id="h-types" tabIndex={-1} className="text-xl">Card types</h3>{ideas(TYPES)}</section>
      <section id="part-turn" aria-labelledby="h-turn" className="grid gap-s3"><h3 id="h-turn" tabIndex={-1} className="text-xl">A full turn</h3><p>Seven steps, always in this order. Step through at your own pace.</p><div id="turn"><StepFlow label="Your turn" steps={TURN} /></div></section>
      <section id="part-stack" aria-labelledby="h-stack" className="grid gap-s3"><h3 id="h-stack" tabIndex={-1} className="text-xl">Combat and the stack</h3><p>One worked example with the Lantern Fox: an attack, a block, and an instant cast in response.</p><div id="combat"><StepFlow label="One combat" steps={COMBAT} /></div><div id="stack" /></section>

      <Callout kind="changes" lastVerified={LEARN_LAST_VERIFIED}>These are the core rules. Wizards updates the Comprehensive Rules with each set.</Callout>
      <div className="flex flex-wrap gap-s2">
        <Button look="primary" icon="play" onClick={() => onJump("play:commander")}>Try a four-player game</Button>
        <Button onClick={() => onJump("ways")}>Ways to play</Button>
        <Button onClick={() => onJump("sets")}>Where cards come from</Button>
      </div>
    </section>
  );
});
