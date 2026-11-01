// Screen C: Where cards come from. Four kinds of set, examples in text only, and links to the formats each fits.
import { forwardRef } from "react";
import { Callout } from "../../components/ui/Callout";
import { SetTypeCard } from "../../components/ui/SetTypeCard";
import { SETS_LAST_VERIFIED, SET_TYPES } from "../../content/sets";

interface Props { onJump: (target: string) => void; initial?: string | null | undefined }

export const SetsScreen = forwardRef<HTMLHeadingElement, Props>(function SetsScreen({ onJump, initial }, ref) {
  return (
    <section aria-labelledby="sets-heading" className="grid gap-s4">
      <div className="grid gap-s2">
        <h2 id="sets-heading" ref={ref} tabIndex={-1} className="text-2xl">Where cards come from</h2>
        <p>Cards arrive in sets. Four kinds matter to a new player, and each kind fits different formats. Set names are given in words only.</p>
      </div>
      {SET_TYPES.map((s) => <div key={s.id} className={initial === s.id ? "rounded-lg ring-4 ring-accent" : ""}><SetTypeCard set={s} onJump={onJump} /></div>)}
      <Callout kind="changes" lastVerified={SETS_LAST_VERIFIED}>New sets arrive several times a year and legality is set per product. The official release calendar is the source of truth.</Callout>
    </section>
  );
});
