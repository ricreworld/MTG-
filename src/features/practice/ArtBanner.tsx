// A decorative strip of official card art on the felt. Purely visual (aria-hidden); nothing depends on it.
import { artUrl, CARDS } from "../../game/cards";

export function ArtBanner({ cards }: { cards: string[] }) {
  return (
    <div aria-hidden="true" className="felt rail flex items-end gap-s2 overflow-hidden rounded-xl p-s3">
      {cards.filter((id) => CARDS[id]).map((id, i) => (
        <img key={id} src={artUrl(id)} alt="" loading="lazy" decoding="async" className="card-shadow h-16 w-20 shrink-0 rounded-md border-2 border-border-strong object-cover sm:h-20 sm:w-28" style={{ transform: `rotate(${(i - (cards.length - 1) / 2) * 3}deg) translateY(${Math.abs(i - (cards.length - 1) / 2) * 3}px)` }} />
      ))}
    </div>
  );
}
