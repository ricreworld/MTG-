// Building blocks for the lesson diagrams: small SVG parts that use the app's colour tokens,
// so every picture works in both themes and with every font setting. All original artwork.
import type { ReactNode } from "react";
import { Glyph, type ManaColor } from "../../../components/ManaSymbol";

export const C = {
  bg: "rgb(var(--color-bg))",
  surface: "rgb(var(--color-surface))",
  surface2: "rgb(var(--color-surface-2))",
  border: "rgb(var(--color-border-strong))",
  text: "rgb(var(--color-text))",
  muted: "rgb(var(--color-text-muted))",
  accent: "rgb(var(--color-accent))",
  accentInk: "rgb(var(--color-accent-ink))",
  accentSoft: "rgb(var(--color-accent-soft))",
  success: "rgb(var(--color-success))",
  successSoft: "rgb(var(--color-success-soft))",
  hint: "rgb(var(--color-hint))",
  focus: "rgb(var(--color-focus))",
  felt: "rgb(var(--felt))",
  feltLight: "rgb(var(--felt-light))",
  feltInk: "rgb(var(--felt-ink))",
  rail: "rgb(var(--rail))",
  mtg: { W: "rgb(var(--mtg-white))", U: "rgb(var(--mtg-blue))", B: "rgb(var(--mtg-black))", R: "rgb(var(--mtg-red))", G: "rgb(var(--mtg-green))", C: "rgb(var(--mtg-colorless))" } as Record<ManaColor, string>,
  ink: { W: "rgb(var(--mtg-white-ink))", U: "rgb(var(--mtg-blue-ink))", B: "rgb(var(--mtg-black-ink))", R: "rgb(var(--mtg-red-ink))", G: "rgb(var(--mtg-green-ink))", C: "rgb(var(--mtg-colorless-ink))" } as Record<ManaColor, string>,
};

export const W = 360;
export const H = 200;

/** Text that inherits the app font. */
export function Label({ x, y, children, size = 12, weight = 400, anchor = "start", fill = C.text }: { x: number; y: number; children: ReactNode; size?: number; weight?: number; anchor?: "start" | "middle" | "end"; fill?: string }) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={fill} dominantBaseline="middle">{children}</text>;
}

/** A small card. Colour fills the frame; a lighter art box sits inside; the name goes in the name bar. */
export function Card({ x, y, w = 54, h = 76, color = "C", name, pt, tapped = false, faceDown = false, highlight = false, dashed = false, glyph }: {
  x: number; y: number; w?: number; h?: number; color?: ManaColor; name?: string | undefined; pt?: string | undefined; tapped?: boolean; faceDown?: boolean; highlight?: boolean; dashed?: boolean; glyph?: ReactNode;
}) {
  const t = tapped ? `rotate(90 ${x + w / 2} ${y + h / 2})` : undefined;
  if (faceDown) {
    return (
      <g transform={t}>
        <rect x={x} y={y} width={w} height={h} rx={5} fill={C.rail} stroke={C.border} strokeWidth={1.5} />
        <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={3} fill="none" stroke="rgb(var(--rail-light))" strokeWidth={1.5} />
        <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * 0.18} fill="none" stroke="rgb(var(--rail-light))" strokeWidth={1.5} />
      </g>
    );
  }
  const fill = C.mtg[color];
  return (
    <g transform={t}>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={fill} stroke={highlight ? C.focus : C.border} strokeWidth={highlight ? 3 : 1.5} strokeDasharray={dashed ? "4 3" : undefined} />
      <rect x={x + 4} y={y + 4} width={w - 8} height={13} rx={2} fill={C.surface} />
      {name && <text x={x + w / 2} y={y + 11} fontSize={Math.min(9, (w - 10) / (name.length * 0.55))} fontWeight={700} textAnchor="middle" fill={C.text} dominantBaseline="middle">{name}</text>}
      <rect x={x + 4} y={y + 20} width={w - 8} height={h * 0.42} rx={2} fill={C.surface2} />
      {glyph && <g transform={`translate(${x + w / 2} ${y + 20 + h * 0.21})`}>{glyph}</g>}
      {h - (20 + h * 0.42 + 3) - 4 > 0 && <rect x={x + 4} y={y + 20 + h * 0.42 + 3} width={w - 8} height={h - (20 + h * 0.42 + 3) - 4} rx={2} fill={C.surface} />}
      {pt && <text x={x + w - 6} y={y + h - 8} fontSize={9} fontWeight={700} textAnchor="end" fill={C.text} fontFamily="ui-monospace, monospace">{pt}</text>}
    </g>
  );
}

/** A mana symbol: coloured disc with the app's glyph. r is the radius. */
export function Mana({ x, y, color, r = 9 }: { x: number; y: number; color: ManaColor; r?: number }) {
  return (
    <g transform={`translate(${x - r} ${y - r}) scale(${(r * 2) / 24})`}>
      <circle cx={12} cy={12} r={12} fill={C.mtg[color]} />
      <g style={{ color: C.ink[color] }}><Glyph color={color} /></g>
    </g>
  );
}

/** A generic mana symbol with a number. */
export function Generic({ x, y, n, r = 9 }: { x: number; y: number; n: number | string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.mtg.C} />
      <text x={x} y={y + 0.5} fontSize={r * 1.2} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.ink.C} fontFamily="ui-monospace, monospace">{n}</text>
    </g>
  );
}

export function Arrow({ x1, y1, x2, y2, dashed = false, color = C.accent, width = 2.5 }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean; color?: string; width?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x2 - 9 * Math.cos(a), hy = y2 - 9 * Math.sin(a);
  return (
    <g>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={width} strokeDasharray={dashed ? "6 4" : undefined} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${x2 - 10 * Math.cos(a - 0.5)},${y2 - 10 * Math.sin(a - 0.5)} ${x2 - 10 * Math.cos(a + 0.5)},${y2 - 10 * Math.sin(a + 0.5)}`} fill={color} />
    </g>
  );
}

/** A player: head and shoulders, a name, and an optional life chip. */
export function Player({ x, y, name, life, color = C.accent }: { x: number; y: number; name: string; life?: number | string; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 10} r={9} fill={color} />
      <path d={`M${x - 16} ${y + 14} a16 16 0 0 1 32 0z`} fill={color} />
      <text x={x} y={y + 26} fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.text}>{name}</text>
      {life !== undefined && <Chip x={x} y={y + 41} text={`Life ${life}`} />}
    </g>
  );
}

/** A small labelled chip (life totals, counters, tags). */
export function Chip({ x, y, text, fill = C.surface, ink = C.text, mono = true, size = 10 }: { x: number; y: number; text: string; fill?: string; ink?: string; mono?: boolean; size?: number }) {
  const w = text.length * size * 0.62 + 12;
  return (
    <g>
      <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={4} fill={fill} stroke={C.border} strokeWidth={1} />
      <text x={x} y={y + 0.5} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={ink} fontFamily={mono ? "ui-monospace, monospace" : undefined}>{text}</text>
    </g>
  );
}

/** A labelled zone box. */
export function Zone({ x, y, w, h, label, dashed = true, fill = "none", children }: { x: number; y: number; w: number; h: number; label?: string | undefined; dashed?: boolean; fill?: string; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={C.border} strokeWidth={1.5} strokeDasharray={dashed ? "5 4" : undefined} />
      {label && <text x={x + 6} y={y + 11} fontSize={10} fontWeight={700} fill={C.muted} dominantBaseline="middle">{label}</text>}
      {children}
    </g>
  );
}

/** A felt table background covering the whole picture. */
export function Felt({ children }: { children?: ReactNode }) {
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} rx={10} fill={C.felt} />
      <ellipse cx={W / 2} cy={H * 0.35} rx={W * 0.55} ry={H * 0.5} fill={C.feltLight} opacity={0.5} />
      {children}
    </g>
  );
}

export function Check({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.successSoft} stroke={C.success} strokeWidth={2} />
      <path d={`M${x - r * 0.45} ${y} l${r * 0.3} ${r * 0.35} l${r * 0.6} -${r * 0.7}`} fill="none" stroke={C.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function Cross({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.surface2} stroke={C.border} strokeWidth={2} />
      <path d={`M${x - r * 0.4} ${y - r * 0.4} l${r * 0.8} ${r * 0.8} M${x + r * 0.4} ${y - r * 0.4} l-${r * 0.8} ${r * 0.8}`} stroke={C.muted} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

/** A stack of face-down cards with a count. */
export function Pile({ x, y, count, label, w = 46, h = 64 }: { x: number; y: number; count?: number | string; label?: string; w?: number; h?: number }) {
  return (
    <g>
      <Card x={x + 4} y={y - 4} w={w} h={h} faceDown />
      <Card x={x + 2} y={y - 2} w={w} h={h} faceDown />
      <Card x={x} y={y} w={w} h={h} faceDown />
      {count !== undefined && <Chip x={x + w / 2} y={y + h / 2} text={String(count)} />}
      {label && <text x={x + w / 2} y={y + h + 12} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.text}>{label}</text>}
    </g>
  );
}

/* ---------- small creature glyphs for art boxes (drawn in the card's ink colour) ---------- */
export const Glyphs = {
  dog: <g fill="currentColor"><circle cx={0} cy={0} r={8} /><path d="M-7 -3 L-12 -12 L-4 -8 Z M7 -3 L12 -12 L4 -8 Z" /></g>,
  spider: <g fill="currentColor"><circle cx={0} cy={1} r={6} /><circle cx={0} cy={-7} r={3.5} /><path d="M0 1 L-13 -5 M0 1 L13 -5 M0 1 L-14 6 M0 1 L14 6" stroke="currentColor" strokeWidth={2} /></g>,
  beast: <g fill="currentColor"><path d="M-12 8 L-12 -2 Q-6 -10 6 -8 L14 -11 L16 -4 L12 8 Z" /><path d="M14 -11 L18 -16" stroke="currentColor" strokeWidth={3} strokeLinecap="round" /></g>,
  bird: <g fill="currentColor"><path d="M0 2 L-10 -4 L-16 0 L-8 2 L-14 8 L-4 6 Z M0 2 L10 -4 L16 0 L8 2 L14 8 L4 6 Z" /><circle cx={0} cy={3} r={3} /></g>,
  knight: <g fill="currentColor"><path d="M-3 12 L-3 -8 L-6 -12 L0 -15 L6 -12 L3 -8 L3 12 Z" /><rect x={-10} y={-2} width={20} height={4} /></g>,
  snake: <g><path d="M-14 6 Q-8 -6 0 2 T14 -4" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" /><circle cx={14} cy={-4} r={3.5} fill="currentColor" /></g>,
  hammer: <g fill="currentColor"><rect x={-2} y={-4} width={4} height={18} /><rect x={-11} y={-12} width={22} height={9} rx={2} /></g>,
  glow: <g fill="currentColor"><circle cx={0} cy={0} r={5} /><circle cx={0} cy={0} r={10} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.6} /><circle cx={0} cy={0} r={15} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.3} /></g>,
  bolt: <path d="M3 -14 L-8 2 L-1 2 L-4 14 L8 -2 L1 -2 Z" fill="currentColor" />,
  star: <path d="M0 -13 L3.5 -4 L13 -3.5 L5.5 2.5 L8 12 L0 6.5 L-8 12 L-5.5 2.5 L-13 -3.5 L-3.5 -4 Z" fill="currentColor" />,
  land: <g fill="currentColor"><path d="M-16 10 L-6 -6 L0 2 L6 -10 L16 10 Z" /></g>,
  crown: <path d="M-12 8 L-12 -4 L-5 2 L0 -10 L5 2 L12 -4 L12 8 Z" fill="currentColor" />,
};

/** A creature art glyph, coloured for the card. */
export function Art({ color, kind }: { color: ManaColor; kind: keyof typeof Glyphs }) {
  return <g style={{ color: C.ink[color] }}>{Glyphs[kind]}</g>;
}
