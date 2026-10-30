// Original artwork for the 17 practice cards: simple, bold SVG shapes drawn in the card's ink colour.
// Nothing here is official Wizards of the Coast art. Each picture is decorative (the card text carries the meaning).
import type { ReactNode } from "react";

const ART: Record<string, ReactNode> = {
  forest: (
    <>
      <path d="M8 44 L18 20 L28 44 Z" />
      <path d="M26 44 L38 12 L50 44 Z" opacity="0.8" />
      <path d="M46 44 L54 28 L62 44 Z" opacity="0.6" />
      <rect x="36" y="42" width="4" height="8" />
    </>
  ),
  mountain: (
    <>
      <path d="M4 48 L24 14 L34 30 L44 10 L66 48 Z" />
      <path d="M24 14 L20 22 L28 22 Z" fill="#fff" opacity="0.6" />
      <path d="M44 10 L39 19 L49 19 Z" fill="#fff" opacity="0.6" />
    </>
  ),
  island: (
    <>
      <path d="M0 40 Q10 34 20 40 T40 40 T60 40 T72 40 L72 50 L0 50 Z" opacity="0.7" />
      <path d="M22 38 Q35 20 48 38 Z" />
      <circle cx="54" cy="12" r="6" opacity="0.8" />
    </>
  ),
  plains: (
    <>
      <circle cx="36" cy="18" r="9" />
      <path d="M0 42 Q18 34 36 42 T72 42 L72 50 L0 50 Z" opacity="0.7" />
      <path d="M0 36 Q18 30 36 36 T72 36" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </>
  ),
  swamp: (
    <>
      <path d="M0 40 L72 40 L72 50 L0 50 Z" opacity="0.7" />
      <path d="M14 40 L14 20 M20 40 L20 14 M26 40 L26 24 M50 40 L50 18 M56 40 L56 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="38" cy="30" rx="6" ry="3" opacity="0.5" />
    </>
  ),
  pup: (
    <>
      <circle cx="36" cy="28" r="14" />
      <path d="M22 22 L16 8 L28 16 Z M50 22 L56 8 L44 16 Z" />
      <circle cx="30" cy="26" r="2.5" fill="#fff" />
      <circle cx="42" cy="26" r="2.5" fill="#fff" />
      <path d="M33 34 Q36 38 39 34" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  boar: (
    <>
      <ellipse cx="34" cy="30" rx="22" ry="13" />
      <circle cx="54" cy="24" r="9" />
      <path d="M60 28 L68 24" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 42 L18 50 M30 42 L30 50 M40 42 L40 50 M50 42 L50 50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  viper: (
    <>
      <path d="M8 40 Q16 24 28 32 T48 24 T66 30" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <circle cx="64" cy="29" r="5" />
      <path d="M68 29 L74 27 M68 29 L74 31" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  spider: (
    <>
      <circle cx="36" cy="30" r="11" />
      <circle cx="36" cy="16" r="6" />
      {[-30, -15, 15, 30].map((a) => (
        <path key={a} d={`M36 30 l${Math.cos(((a - 90) * Math.PI) / 180) * 26} ${Math.sin(((a - 90) * Math.PI) / 180) * 26 + 24}`} stroke="currentColor" strokeWidth="2.5" fill="none" />
      ))}
      <path d="M36 30 L8 26 M36 30 L64 26 M36 30 L12 44 M36 30 L60 44" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </>
  ),
  rhino: (
    <>
      <path d="M10 44 L10 26 Q22 12 44 16 L56 10 L60 20 L66 26 L60 34 Q58 44 50 44 Z" />
      <path d="M58 10 L64 2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="52" cy="22" r="2" fill="#fff" />
    </>
  ),
  guard: (
    <>
      <path d="M36 6 L56 14 L54 34 Q48 46 36 50 Q24 46 18 34 L16 14 Z" />
      <path d="M36 14 L36 42 M24 24 L48 24" stroke="#fff" strokeWidth="3" opacity="0.7" />
    </>
  ),
  knight: (
    <>
      <path d="M30 48 L30 14 L26 8 L34 4 L42 8 L38 14 L38 48 Z" />
      <path d="M16 30 L52 30 L52 36 L16 36 Z" />
      <circle cx="56" cy="16" r="8" opacity="0.6" />
    </>
  ),
  bat: (
    <>
      <path d="M36 28 L26 18 L14 22 L4 14 L10 30 L4 42 L18 36 L30 42 Z" />
      <path d="M36 28 L46 18 L58 22 L68 14 L62 30 L68 42 L54 36 L42 42 Z" />
      <circle cx="36" cy="30" r="5" />
    </>
  ),
  ghoul: (
    <>
      <path d="M8 46 L64 46 L64 52 L8 52 Z" opacity="0.6" />
      <path d="M30 46 L30 28 Q30 20 36 20 Q42 20 42 28 L42 46 Z" />
      <path d="M36 20 L36 10 M28 14 L44 14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 30 L30 34 M48 30 L42 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  surge: (
    <>
      <path d="M36 50 Q20 40 22 22 Q36 18 40 4 Q52 20 50 36 Q46 48 36 50 Z" />
      <path d="M36 50 Q34 30 40 12" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="14" cy="14" r="3" /><circle cx="60" cy="10" r="2.5" /><circle cx="62" cy="40" r="3" />
    </>
  ),
  jolt: (
    <>
      <path d="M42 2 L20 30 L34 30 L28 52 L54 22 L40 22 Z" />
      <circle cx="12" cy="12" r="3" opacity="0.7" /><circle cx="62" cy="44" r="3" opacity="0.7" />
    </>
  ),
  denial: (
    <>
      <circle cx="36" cy="28" r="20" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M22 14 L50 42" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M8 48 Q16 42 24 48 T40 48 T56 48 T72 48" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
    </>
  ),
};

export function CardArt({ cardId }: { cardId: string }) {
  const art = ART[cardId];
  return (
    <svg viewBox="0 0 72 56" preserveAspectRatio="xMidYMid meet" className="h-full w-full" fill="currentColor" aria-hidden="true" focusable="false">
      {art ?? <circle cx="36" cy="28" r="14" />}
    </svg>
  );
}
