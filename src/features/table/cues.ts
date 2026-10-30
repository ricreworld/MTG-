// Plays a CueBatch against the live DOM: FLIP slides for cards that moved, tap turns, floating numbers,
// ghosts for destroyed cards, pooled particles (Full only) and a brief shake on a lethal blow (Full only).
// Transforms and opacity only, via the Web Animations API, so the work stays on the compositor.
import type { CueBatch } from "../../table/director";
import { EASING_CSS, TIMINGS, type MotionLevel } from "../../table/motion";
import { Pool } from "../../table/pool";
import { playSound, type SoundCue } from "../../table/audio";

export interface Ghost { uid: string; card: string; left: number; top: number; width: number; height: number; toCommandZone: boolean }

interface FloatEl { el: HTMLSpanElement }
interface ParticleEl { el: HTMLDivElement }

/** Holds the pools of DOM elements used by floating numbers and particles. Created once per table. */
export class EffectsLayer {
  readonly numbers: Pool<FloatEl>;
  readonly particles: Pool<ParticleEl>;
  readonly root: HTMLDivElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "pointer-events-none fixed inset-0 z-20";
    this.root.setAttribute("aria-hidden", "true");
    this.numbers = new Pool(16, () => {
      const el = document.createElement("span");
      el.className = "absolute rounded-md px-2 py-[2px] font-mono text-lg font-bold opacity-0";
      this.root.appendChild(el);
      return { el };
    }, (n) => { n.el.style.opacity = "0"; n.el.textContent = ""; });
    this.particles = new Pool(24, () => {
      const el = document.createElement("div");
      el.className = "absolute h-2 w-2 rounded-full opacity-0";
      this.root.appendChild(el);
      return { el };
    }, (p) => { p.el.style.opacity = "0"; });
  }

  mount(parent: HTMLElement) { parent.appendChild(this.root); }
  unmount() { this.root.remove(); }

  float(text: string, x: number, y: number, tone: "bad" | "good" | "plain", dur: number) {
    const n = this.numbers.acquire();
    if (!n) return;
    const el = n.el;
    el.textContent = text;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.background = tone === "bad" ? "rgb(var(--color-surface))" : tone === "good" ? "rgb(var(--color-success-soft))" : "rgb(var(--color-surface-2))";
    el.style.color = tone === "good" ? "rgb(var(--color-success))" : "rgb(var(--color-text))";
    el.style.border = "2px solid rgb(var(--color-border-strong))";
    el.style.opacity = "1";
    const anim = el.animate([{ transform: "translate(-50%, -50%)", opacity: 1 }, { transform: "translate(-50%, -140%)", opacity: 0 }], { duration: dur, easing: EASING_CSS.out, fill: "forwards" });
    anim.onfinish = () => this.numbers.release(n);
    anim.oncancel = () => this.numbers.release(n);
  }

  burst(x: number, y: number, color: string, count: number, dur: number) {
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire();
      if (!p) return;
      const a = (Math.PI * 2 * i) / count + (i % 2 ? 0.3 : 0);
      const dist = 26 + (i % 3) * 10;
      p.el.style.left = `${x}px`; p.el.style.top = `${y}px`; p.el.style.background = color; p.el.style.opacity = "1";
      const anim = p.el.animate([{ transform: "translate(-50%, -50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(0.2)`, opacity: 0 }], { duration: dur, easing: EASING_CSS.out, fill: "forwards" });
      anim.onfinish = () => this.particles.release(p);
      anim.oncancel = () => this.particles.release(p);
    }
  }
}

export interface PlayOptions {
  root: HTMLElement;             // the table container with [data-uid] cards and [data-life] badges
  batch: CueBatch;
  motion: MotionLevel;
  sound: boolean;
  prevRects: Map<string, DOMRect>;
  nowRects: Map<string, DOMRect>;
  prevCards: Map<string, string>; // uid -> card id, for ghosts
  effects: EffectsLayer;
  setGhosts: (g: Ghost[]) => void;
  onDone: () => void;
}

/** Starts playing a batch. Returns a function that skips to the end (finishing every animation at once). */
export function playBatch(o: PlayOptions): () => void {
  const t = TIMINGS[o.motion];
  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
  const el = (uid: string) => o.root.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
  const sfx = (c: SoundCue) => { if (o.sound) playSound(c); };
  const full = o.motion === "full";

  // FLIP: anything that moved slides from where it was; anything new settles in.
  for (const [uid, rect] of o.nowRects) {
    const node = el(uid);
    if (!node) continue;
    const prev = o.prevRects.get(uid);
    if (prev) {
      const dx = prev.left - rect.left, dy = prev.top - rect.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: t.move, easing: EASING_CSS.out, composite: "add" });
    } else {
      node.animate([{ opacity: 0, transform: "translateY(10px) scale(0.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: t.move, easing: EASING_CSS.out, composite: "add" });
    }
  }

  const ghosts: Ghost[] = [];
  for (const cue of o.batch.cues) {
    const e = cue.event;
    switch (e.kind) {
      case "tapped": {
        const node = el(e.uid);
        later(cue.at, () => { node?.animate([{ transform: `rotate(${e.tapped ? -6 : 6}deg)` }, { transform: "rotate(0deg)" }], { duration: cue.dur, easing: EASING_CSS.out, composite: "add" }); if (e.tapped) sfx("tap"); });
        break;
      }
      case "spellCast": {
        const node = el(e.uid);
        later(cue.at, () => { node?.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: cue.dur, easing: EASING_CSS.spring, composite: "add" }); sfx("cast"); });
        break;
      }
      case "cardMoved": {
        if (e.to === "battlefield" && e.from === "hand") later(cue.at, () => sfx("land"));
        break;
      }
      case "attack": {
        later(cue.at, () => {
          for (const uid of e.attackers) el(uid)?.animate([{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }], { duration: cue.dur, easing: EASING_CSS.spring, composite: "add" });
          sfx("attack");
        });
        break;
      }
      case "lifeChanged": {
        later(cue.at, () => {
          const badge = o.root.querySelector<HTMLElement>(`[data-life="${e.player}"]`);
          const r = badge?.getBoundingClientRect();
          if (r) o.effects.float(`${e.to - e.from > 0 ? "+" : ""}${e.to - e.from}`, r.left + r.width / 2, r.top, e.to < e.from ? "bad" : "good", cue.dur);
          badge?.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: Math.min(cue.dur, 360), easing: EASING_CSS.out });
          sfx(e.to < e.from ? "damage" : "gain");
        });
        break;
      }
      case "creatureDamaged": {
        later(cue.at, () => { const r = o.nowRects.get(e.uid); if (r) o.effects.float(`-${e.amount}`, r.left + r.width / 2, r.top + r.height * 0.4, "bad", cue.dur); });
        break;
      }
      case "destroyed": {
        const r = o.prevRects.get(e.uid);
        if (r) ghosts.push({ uid: e.uid, card: e.card, left: r.left, top: r.top, width: r.width, height: r.height, toCommandZone: e.toCommandZone });
        later(cue.at, () => {
          const g = o.root.ownerDocument.querySelector<HTMLElement>(`[data-ghost="${e.uid}"]`);
          g?.animate([{ opacity: 1, transform: "translateY(0) rotate(0deg)" }, { opacity: 0, transform: `translateY(${e.toCommandZone ? -30 : 30}px) rotate(${e.toCommandZone ? 0 : 8}deg)` }], { duration: cue.dur, easing: EASING_CSS.inOut, fill: "forwards" });
          if (full && r) o.effects.burst(r.left + r.width / 2, r.top + r.height / 2, "rgb(var(--color-text-muted))", 8, cue.dur);
          sfx("destroy");
        });
        break;
      }
      case "countered": later(cue.at, () => sfx("counter")); break;
      case "turnChanged": if (e.step === "main1") later(cue.at, () => sfx("turn")); break;
      case "result": {
        later(cue.at, () => {
          sfx(e.result === "win" ? "win" : "lose");
          if (o.batch.shake) o.root.animate([{ transform: "translate(0,0)" }, { transform: "translate(-4px, 2px)" }, { transform: "translate(4px, -2px)" }, { transform: "translate(-2px, 1px)" }, { transform: "translate(0,0)" }], { duration: t.shake, easing: "linear" });
          if (full) { const r = o.root.getBoundingClientRect(); o.effects.burst(r.left + r.width / 2, r.top + Math.min(r.height / 2, 320), e.result === "win" ? "rgb(var(--color-success))" : "rgb(var(--color-text-muted))", 16, 700); }
        });
        break;
      }
      default: break;
    }
  }
  if (ghosts.length) o.setGhosts(ghosts);

  // The main button pulses once when a batch ends, so the eye lands on the next thing to do.
  later(o.batch.total, () => {
    const main = o.root.ownerDocument.querySelector<HTMLElement>("[data-main-button]");
    main?.animate([{ boxShadow: "0 0 0 0 rgb(var(--color-accent) / 0.6)" }, { boxShadow: "0 0 0 14px rgb(var(--color-accent) / 0)" }], { duration: t.pulse, easing: EASING_CSS.out });
    o.setGhosts([]);
    o.onDone();
  });

  return () => {
    for (const id of timers) window.clearTimeout(id);
    for (const a of o.root.getAnimations({ subtree: true })) a.finish();
    o.effects.numbers.releaseAll();
    o.effects.particles.releaseAll();
    o.setGhosts([]);
    o.onDone();
  };
}
