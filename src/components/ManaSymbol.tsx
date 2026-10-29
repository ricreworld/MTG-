// The five MTG colors plus colorless. Each one has its own symbol, so color is
// never the only signal. These are original simple shapes, not official Wizards symbols.

export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

export const MANA: Record<ManaColor, { name: string; symbolName: string; fill: string; ink: string }> = {
  W: { name: "White", symbolName: "sun", fill: "bg-mtg-white", ink: "text-mtg-white-ink" },
  U: { name: "Blue", symbolName: "water drop", fill: "bg-mtg-blue", ink: "text-mtg-blue-ink" },
  B: { name: "Black", symbolName: "skull", fill: "bg-mtg-black", ink: "text-mtg-black-ink" },
  R: { name: "Red", symbolName: "flame", fill: "bg-mtg-red", ink: "text-mtg-red-ink" },
  G: { name: "Green", symbolName: "tree", fill: "bg-mtg-green", ink: "text-mtg-green-ink" },
  C: { name: "Colorless", symbolName: "diamond", fill: "bg-mtg-colorless", ink: "text-mtg-colorless-ink" },
};

function Glyph({ color }: { color: ManaColor }) {
  switch (color) {
    case "W":
      return (
        <g fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="3.5" x2="12" y2="6" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      );
    case "U":
      return <path fill="currentColor" d="M12 3.5c-.6.9-6 7.2-6 11a6 6 0 0 0 12 0c0-3.8-5.4-10.1-6-11z" />;
    case "B":
      return (
        <g fill="currentColor">
          <path d="M12 4a7 7 0 0 0-7 7c0 2.3 1.1 3.9 2.6 4.9V19h8.8v-3.1c1.5-1 2.6-2.6 2.6-4.9a7 7 0 0 0-7-7z" />
          <circle cx="9.3" cy="11.3" r="1.7" className="fill-mtg-black" />
          <circle cx="14.7" cy="11.3" r="1.7" className="fill-mtg-black" />
        </g>
      );
    case "R":
      return <path fill="currentColor" d="M12.5 3c.5 3-2.8 4.6-2.8 7.7 0 .9.4 1.7 1 2.2-.2-1.6.9-2.8 2.1-3.6.1 2.2 2.9 3 2.9 5.6a3.7 3.7 0 0 1-7.4 0c0-.4 0-.8.1-1.1C7.2 14.6 7 15.5 7 16.3A5 5 0 0 0 17 16.3c0-5.4-3.6-8.3-4.5-13.3z" />;
    case "G":
      return (
        <g fill="currentColor">
          <path d="M12 3.5 5.5 13h3L6 17h12l-2.5-4h3z" />
          <rect x="11" y="16.5" width="2" height="4" />
        </g>
      );
    case "C":
      return <path fill="currentColor" d="M12 4 19 12 12 20 5 12z" />;
  }
}

interface ManaSymbolProps {
  color: ManaColor;
  /** Size in rem, so it scales with the learner's font size. */
  size?: number;
  /** Show the color name next to the symbol (recommended: color is never the only signal). */
  showLabel?: boolean;
}

export function ManaSymbol({ color, size = 1.5, showLabel = false }: ManaSymbolProps) {
  const m = MANA[color];
  const icon = (
    <svg
      viewBox="0 0 24 24"
      width={`${size}rem`}
      height={`${size}rem`}
      className={`${m.fill} ${m.ink} rounded-full shrink-0`}
      role={showLabel ? "presentation" : "img"}
      aria-hidden={showLabel ? true : undefined}
      aria-label={showLabel ? undefined : `${m.name} mana (${m.symbolName})`}
    >
      <Glyph color={color} />
    </svg>
  );
  if (!showLabel) return icon;
  return (
    <span className="inline-flex items-center gap-s2">
      {icon}
      <span>{m.name}</span>
    </span>
  );
}
