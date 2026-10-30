// The Foundations card library: every card in the set, searchable and filterable, one calm list.
// Text comes from the official Oracle text (via Scryfall). Pictures load from Scryfall when online;
// offline, the text still works. Cards that the Practice Table can play are marked.
import { forwardRef, useDeferredValue, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import foundations from "../../content/foundations.json";
import { CARDS } from "../../game/cards";

interface LibraryCard {
  id: string;
  name: string;
  cost?: string;
  type: string;
  text?: string;
  pt?: string;
  colors?: string;
  rarity: "c" | "u" | "r" | "m";
  num: string;
  artist?: string;
}

const ALL = foundations as LibraryCard[];
const PLAYABLE = new Set(Object.values(CARDS).map((c) => c.name));
const RARITY: Record<LibraryCard["rarity"], string> = { c: "Common", u: "Uncommon", r: "Rare", m: "Mythic rare" };
const COLOR_FILTERS: { id: string; label: string; color?: ManaColor }[] = [
  { id: "W", label: "White", color: "W" }, { id: "U", label: "Blue", color: "U" }, { id: "B", label: "Black", color: "B" },
  { id: "R", label: "Red", color: "R" }, { id: "G", label: "Green", color: "G" }, { id: "C", label: "Colourless" }, { id: "M", label: "Two or more colours" },
];
const TYPE_FILTERS = ["Creature", "Instant", "Sorcery", "Land", "Artifact", "Enchantment", "Planeswalker"];
const ART = (id: string) => `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
const FULL = (id: string) => `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`;

/** Renders a mana cost or rules text, turning {W}, {2}, {T} and friends into symbols or small pills. */
function ManaText({ text, size = 1 }: { text: string; size?: number }) {
  const parts = text.split(/(\{[^}]+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{([^}]+)\}$/.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        const sym = m[1]!;
        if (/^[WUBRG]$/.test(sym)) return <ManaSymbol key={i} color={sym as ManaColor} size={size} />;
        const label = sym === "T" ? "Tap" : sym === "Q" ? "Untap" : sym === "E" ? "Energy" : sym;
        return <span key={i} className="mx-[1px] inline-grid min-w-[1.25em] place-items-center rounded-full bg-mtg-colorless px-[0.3em] align-middle font-mono text-[0.75em] font-bold leading-[1.5em] text-mtg-colorless-ink" role="img" aria-label={/^\d+$/.test(sym) ? `${sym} generic mana` : label}>{label}</span>;
      })}
    </>
  );
}

function CardRow({ card, open, onToggle }: { card: LibraryCard; open: boolean; onToggle: () => void }) {
  const [full, setFull] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const playable = PLAYABLE.has(card.name);
  return (
    <li className="rounded-md border border-border bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid min-h-tap w-full grid-cols-[1fr_auto] items-center gap-s2 px-s3 py-s2 text-left">
        <span>
          <span className="font-bold">{card.name}</span>
          {playable && <span className="ml-s2 rounded-sm bg-success-soft px-1 text-xs font-bold text-success">On the table</span>}
          <span className="block text-sm text-text-muted">{card.type}{card.pt ? ` · ${card.pt}` : ""}</span>
        </span>
        <span className="inline-flex items-center gap-[2px]">{card.cost && <ManaText text={card.cost} size={1.1} />}</span>
      </button>
      {open && (
        <div className="grid gap-s2 border-t border-border p-s3">
          {!imgFailed ? (
            <img
              src={full ? FULL(card.id) : ART(card.id)}
              alt={full ? `${card.name}, full card` : `${card.name}, artwork`}
              onError={() => setImgFailed(true)}
              className={`${full ? "max-w-[20rem]" : "max-h-[12rem] w-full object-cover"} rounded-md border border-border-strong`}
            />
          ) : (
            <p className="rounded-md bg-surface-2 p-s3 text-sm text-text-muted">The picture needs an internet connection. The text below still works offline.</p>
          )}
          {!imgFailed && <div><button type="button" onClick={() => setFull((v) => !v)} className="inline-flex min-h-tap items-center rounded-md border-2 border-border-strong px-s3 text-sm font-bold">{full ? "Show artwork only" : "Show the full card"}</button></div>}
          <p className="whitespace-pre-line leading-relaxed">{card.text ? <ManaText text={card.text} /> : <span className="text-text-muted">No rules text.</span>}</p>
          <p className="text-sm text-text-muted">{RARITY[card.rarity]} · Foundations #{card.num}{card.artist ? ` · Art by ${card.artist}` : ""}</p>
        </div>
      )}
    </li>
  );
}

interface Props { onBack: () => void }

export const CardLibrary = forwardRef<HTMLHeadingElement, Props>(function CardLibrary({ onBack }, headingRef) {
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [onlyPlayable, setOnlyPlayable] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const q = useDeferredValue(query.trim().toLowerCase());

  const results = useMemo(() => ALL.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q) && !(c.text ?? "").toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return false;
    if (colors.length) {
      const ci = c.colors ?? "";
      const ok = colors.some((f) => (f === "C" ? ci === "" : f === "M" ? ci.length >= 2 : ci.includes(f)));
      if (!ok) return false;
    }
    if (types.length && !types.some((t) => c.type.includes(t))) return false;
    if (onlyPlayable && !PLAYABLE.has(c.name)) return false;
    return true;
  }), [q, colors, types, onlyPlayable]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const chip = (on: boolean) => `inline-flex min-h-tap items-center gap-s1 rounded-md border-2 px-s2 text-sm font-bold ${on ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`;
  const shown = results.slice(0, limit);

  return (
    <section aria-labelledby="library-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s2">
        <h2 id="library-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Card library</h2>
        <button type="button" onClick={onBack} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s3 font-bold"><Icon name="back" /> Practice</button>
      </div>
      <p>Every card in Foundations ({ALL.length} cards), with its official rules text. Tap a card to see its picture and text. Cards marked <strong>On the table</strong> can be played on the Practice Table.</p>

      <label className="grid gap-s1">
        <span className="font-bold">Search by name, type or text</span>
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(60); }} placeholder="e.g. flying, dragon, counter target" className="min-h-tap rounded-md border-2 border-border-strong bg-bg px-s3" />
      </label>

      <fieldset className="grid gap-s2">
        <legend className="font-bold">Colour</legend>
        <div className="flex flex-wrap gap-s2">
          {COLOR_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={colors.includes(f.id)} onClick={() => { toggle(colors, setColors, f.id); setLimit(60); }} className={chip(colors.includes(f.id))}>
              {f.color && <ManaSymbol color={f.color} size={1} />} {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-s2">
        <legend className="font-bold">Type</legend>
        <div className="flex flex-wrap gap-s2">
          {TYPE_FILTERS.map((t) => (
            <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => { toggle(types, setTypes, t); setLimit(60); }} className={chip(types.includes(t))}>{t}</button>
          ))}
          <button type="button" aria-pressed={onlyPlayable} onClick={() => { setOnlyPlayable((v) => !v); setLimit(60); }} className={chip(onlyPlayable)}><Icon name="play" size={1} /> On the table only</button>
        </div>
      </fieldset>

      <p className="text-sm text-text-muted" aria-live="polite">{results.length} card{results.length === 1 ? "" : "s"}{results.length > shown.length ? `, showing the first ${shown.length}` : ""}.</p>
      <ol className="grid gap-s2">
        {shown.map((c) => <CardRow key={c.id} card={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />)}
      </ol>
      {results.length > shown.length && (
        <div><button type="button" onClick={() => setLimit((n) => n + 60)} className="inline-flex min-h-tap items-center rounded-md bg-accent px-s4 font-bold text-accent-ink">Show 60 more</button></div>
      )}
      <p className="text-sm text-text-muted">Card names, text and pictures are © Wizards of the Coast LLC, used under the Fan Content Policy. Data via Scryfall.</p>
    </section>
  );
});
