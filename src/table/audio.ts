// Opt-in sound cues, synthesised with Web Audio so there are no audio files to download.
// Short, soft, never surprising: nothing plays unless the learner turned sound on in Settings.
export type SoundCue = "tap" | "cast" | "land" | "attack" | "damage" | "gain" | "destroy" | "counter" | "win" | "lose" | "turn";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18; // quiet by design
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return master ? { ctx, master } : null;
}

/** A single short tone with a soft envelope. */
function tone(freq: number, dur: number, type: OscillatorType, at = 0, gain = 1, slideTo?: number) {
  const a = ensure();
  if (!a) return;
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playSound(cue: SoundCue): void {
  switch (cue) {
    case "tap": tone(660, 0.06, "triangle", 0, 0.6); break;
    case "land": tone(220, 0.12, "sine", 0, 0.8); tone(330, 0.1, "sine", 0.05, 0.5); break;
    case "cast": tone(392, 0.14, "triangle", 0, 0.7, 587); break;
    case "attack": tone(196, 0.1, "sawtooth", 0, 0.35, 247); break;
    case "damage": tone(110, 0.16, "triangle", 0, 0.9, 70); break;
    case "gain": tone(523, 0.1, "sine", 0, 0.5); tone(659, 0.12, "sine", 0.07, 0.5); break;
    case "destroy": tone(330, 0.2, "triangle", 0, 0.6, 165); break;
    case "counter": tone(880, 0.08, "square", 0, 0.25, 440); break;
    case "turn": tone(440, 0.07, "sine", 0, 0.35); break;
    case "win": tone(523, 0.12, "triangle", 0, 0.6); tone(659, 0.12, "triangle", 0.12, 0.6); tone(784, 0.22, "triangle", 0.24, 0.6); break;
    case "lose": tone(392, 0.16, "triangle", 0, 0.5); tone(330, 0.24, "triangle", 0.16, 0.5); break;
  }
}
