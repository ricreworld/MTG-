// The lesson diagrams, one per step id. Each is an original SVG picture built from the primitives.
// The step's altText becomes the picture's accessible name, so the drawing can stay purely visual.
import type { ReactNode } from "react";
import { Arrow, Art, C, Card, Check, Chip, Cross, Felt, Generic, H, Label, Mana, Pile, Player, W, Zone } from "./primitives";

type Diagram = () => ReactNode;

const phasesRow = (active?: number) => {
  const names = ["Beginning", "Main 1", "Combat", "Main 2", "Ending"];
  return names.map((n, i) => {
    const x = 14 + i * 68;
    const on = i === active;
    return (
      <g key={n}>
        <rect x={x} y={70} width={60} height={34} rx={6} fill={on ? C.accent : C.surface} stroke={on ? C.accent : C.border} strokeWidth={1.5} />
        <text x={x + 30} y={87} fontSize={10.5} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={on ? C.accentInk : C.text}>{n}</text>
        {i < 4 && <Arrow x1={x + 61} y1={87} x2={x + 68} y2={87} color={C.muted} width={2} />}
      </g>
    );
  });
};

const twoPlayers = (lifeA: number | string = 20, lifeB: number | string = 20) => (
  <Felt>
    <Player x={60} y={60} name="You" life={lifeA} />
    <Player x={300} y={60} name="Opponent" life={lifeB} color={C.hint} />
    <Pile x={100} y={110} count={23} label="Your library" />
    <Pile x={214} y={110} count={23} label="Their library" />
  </Felt>
);

export const DIAGRAMS: Record<string, Diagram> = {
  /* ---------- 1 What is Magic ---------- */
  welcome: () => twoPlayers(),
  "life-total": () => (
    <Felt>
      <Player x={90} y={70} name="You" />
      <Player x={270} y={70} name="Opponent" color={C.hint} />
      <Chip x={90} y={135} text="Life 20" size={16} />
      <Chip x={270} y={135} text="Life 20" size={16} />
      <Label x={180} y={170} anchor="middle" fill={C.feltInk} size={12}>First to 0 loses</Label>
    </Felt>
  ),
  "other-ways-to-lose": () => (
    <g>
      <Zone x={20} y={30} w={140} h={140} label="Library: empty" dashed>
        <rect x={62} y={70} width={46} height={64} rx={5} fill="none" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" />
        <Cross x={85} y={102} />
      </Zone>
      <Zone x={200} y={30} w={140} h={140} label="10 poison counters">
        {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={225 + (i % 5) * 24} cy={85 + Math.floor(i / 5) * 30} r={9} fill={C.mtg.G} stroke={C.border} />)}
        <Label x={270} y={150} anchor="middle" size={11}>that's a loss too</Label>
      </Zone>
    </g>
  ),

  /* ---------- 2 Reading a card ---------- */
  "type-line": () => (
    <g>
      <Card x={40} y={14} w={120} h={170} color="R" name="Brazen Scourge" pt="3/3" glyph={<Art color="R" kind="dog" />} />
      <rect x={44} y={110} width={112} height={14} rx={2} fill={C.accentSoft} stroke={C.focus} strokeWidth={2.5} />
      <text x={100} y={117} fontSize={8} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.text}>Creature — Gremlin</text>
      <Arrow x1={210} y1={117} x2={162} y2={117} />
      <Label x={218} y={110} size={12} weight={700}>Type line</Label>
      <Label x={218} y={128} size={11} fill={C.muted}>card type, then subtype</Label>
    </g>
  ),
  "text-box": () => (
    <g>
      <Card x={40} y={14} w={120} h={170} color="R" name="Brazen Scourge" pt="3/3" glyph={<Art color="R" kind="dog" />} />
      <rect x={44} y={128} width={112} height={48} rx={2} fill={C.accentSoft} stroke={C.focus} strokeWidth={2.5} />
      <text x={50} y={140} fontSize={9} fontWeight={700} fill={C.text} dominantBaseline="middle">Haste</text>
      <text x={50} y={156} fontSize={7} fill={C.muted} dominantBaseline="middle">(It can attack the turn</text>
      <text x={50} y={166} fontSize={7} fill={C.muted} dominantBaseline="middle">it arrives.)</text>
      <Arrow x1={210} y1={150} x2={162} y2={150} />
      <Label x={218} y={142} size={12} weight={700}>Text box</Label>
      <Label x={218} y={160} size={11} fill={C.muted}>what the card does</Label>
    </g>
  ),
  "power-and-toughness": () => (
    <g>
      <Card x={40} y={14} w={120} h={170} color="R" name="Brazen Scourge" glyph={<Art color="R" kind="dog" />} />
      <rect x={122} y={162} width={34} height={18} rx={3} fill={C.surface} stroke={C.focus} strokeWidth={2.5} />
      <text x={139} y={171} fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.text} fontFamily="ui-monospace, monospace">3/3</text>
      <Arrow x1={215} y1={150} x2={160} y2={168} />
      <Label x={222} y={128} size={12} weight={700}>Power / Toughness</Label>
      <Label x={222} y={146} size={11} fill={C.muted}>3 damage dealt</Label>
      <Label x={222} y={162} size={11} fill={C.muted}>3 damage to destroy it</Label>
    </g>
  ),

  /* ---------- 3 Mana and lands ---------- */
  "lands-make-mana": () => (
    <Felt>
      <Card x={50} y={50} w={60} h={84} color="G" name="Forest" glyph={<Art color="G" kind="land" />} />
      <Label x={80} y={155} anchor="middle" fill={C.feltInk} size={11}>untapped</Label>
      <Arrow x1={125} y1={92} x2={175} y2={92} color={C.feltInk} />
      <Card x={200} y={50} w={60} h={84} color="G" name="Forest" tapped glyph={<Art color="G" kind="land" />} />
      <Label x={230} y={155} anchor="middle" fill={C.feltInk} size={11}>tapped</Label>
      <Mana x={300} y={70} color="G" r={14} />
      <Label x={300} y={98} anchor="middle" fill={C.feltInk} size={11}>one green mana</Label>
    </Felt>
  ),
  "one-land-per-turn": () => (
    <g>
      {[1, 2, 3].map((turn) => (
        <g key={turn}>
          <Label x={30 + (turn - 1) * 112} y={22} size={12} weight={700}>Turn {turn}</Label>
          {Array.from({ length: turn }, (_, i) => <Card key={i} x={30 + (turn - 1) * 112 + i * 26} y={40} w={44} h={62} color="G" glyph={<Art color="G" kind="land" />} />)}
          <g>{Array.from({ length: turn }, (_, i) => <Mana key={i} x={44 + (turn - 1) * 112 + i * 22} y={130} color="G" r={9} />)}</g>
          <Label x={30 + (turn - 1) * 112} y={160} size={11} fill={C.muted}>{turn} mana</Label>
        </g>
      ))}
    </g>
  ),
  "five-colours": () => (
    <g>
      {(["W", "U", "B", "R", "G"] as const).map((c, i) => {
        const names = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
        const x = 18 + i * 68;
        return (
          <g key={c}>
            <Card x={x} y={24} w={54} h={76} color={c} name={names[c]} glyph={<Art color={c} kind="land" />} />
            <Mana x={x + 27} y={122} color={c} r={11} />
            <Label x={x + 27} y={148} anchor="middle" size={11}>{{ W: "white", U: "blue", B: "black", R: "red", G: "green" }[c]}</Label>
          </g>
        );
      })}
    </g>
  ),
  "reading-a-cost": () => (
    <g>
      <Label x={20} y={26} size={12} weight={700}>Cost:</Label>
      <Generic x={70} y={26} n={2} r={11} />
      <Mana x={98} y={26} color="G" r={11} />
      <Mana x={126} y={26} color="G" r={11} />
      <Arrow x1={98} y1={42} x2={70} y2={80} />
      <Arrow x1={126} y1={42} x2={140} y2={80} />
      <Arrow x1={70} y1={42} x2={250} y2={80} dashed />
      <Card x={44} y={90} w={50} h={70} color="G" name="Forest" glyph={<Art color="G" kind="land" />} />
      <Card x={114} y={90} w={50} h={70} color="G" name="Forest" glyph={<Art color="G" kind="land" />} />
      <Card x={222} y={90} w={50} h={70} color="R" name="Mountain" glyph={<Art color="R" kind="land" />} />
      <Card x={282} y={90} w={50} h={70} color="U" name="Island" glyph={<Art color="U" kind="land" />} />
      <Label x={94} y={178} anchor="middle" size={11}>must be green</Label>
      <Label x={277} y={178} anchor="middle" size={11}>any colour works</Label>
    </g>
  ),
  "use-it-or-lose-it": () => (
    <Felt>
      {[0, 1, 2].map((i) => <Card key={i} x={30 + i * 50} y={40} w={44} h={62} color="G" tapped glyph={<Art color="G" kind="land" />} />)}
      <Mana x={60} y={140} color="G" r={11} /><Mana x={90} y={140} color="G" r={11} />
      <g opacity={0.35}><Mana x={120} y={140} color="G" r={11} /></g>
      <Arrow x1={110} y1={120} x2={200} y2={80} color={C.feltInk} />
      <Card x={210} y={40} w={60} h={84} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Label x={75} y={168} anchor="middle" fill={C.feltInk} size={11}>2 spent</Label>
      <Label x={140} y={168} anchor="middle" fill={C.feltInk} size={11}>1 fades</Label>
      <Label x={300} y={100} anchor="middle" fill={C.feltInk} size={11}>costs {"{1}{G}"}</Label>
    </Felt>
  ),

  /* ---------- 4 Card types ---------- */
  permanents: () => (
    <Felt>
      <Label x={20} y={22} fill={C.feltInk} size={12} weight={700}>Stay on the table</Label>
      <Card x={20} y={36} w={46} h={64} color="G" name="Creature" glyph={<Art color="G" kind="beast" />} />
      <Card x={74} y={36} w={46} h={64} color="G" name="Land" glyph={<Art color="G" kind="land" />} />
      <Card x={128} y={36} w={46} h={64} color="C" name="Artifact" glyph={<Art color="C" kind="hammer" />} />
      <Card x={182} y={36} w={46} h={64} color="W" name="Enchant." glyph={<Art color="W" kind="glow" />} />
      <Label x={20} y={128} fill={C.feltInk} size={12} weight={700}>Happen, then go to the graveyard</Label>
      <Card x={20} y={140} w={46} h={56} color="R" name="Instant" glyph={<Art color="R" kind="bolt" />} />
      <Card x={74} y={140} w={46} h={56} color="U" name="Sorcery" glyph={<Art color="U" kind="star" />} />
      <Arrow x1={130} y1={168} x2={250} y2={168} color={C.feltInk} />
      <Pile x={262} y={132} w={40} h={56} label="Graveyard" />
    </Felt>
  ),
  creatures: () => (
    <Felt>
      <Card x={40} y={40} w={70} h={100} color="R" name="Pup" pt="2/1" glyph={<Art color="R" kind="dog" />} />
      <Card x={145} y={40} w={70} h={100} color="G" name="Spider" pt="1/3" glyph={<Art color="G" kind="spider" />} />
      <Card x={250} y={40} w={70} h={100} color="G" name="Beast" pt="4/4" glyph={<Art color="G" kind="beast" />} />
      <Label x={180} y={168} anchor="middle" fill={C.feltInk} size={12}>power / toughness in the corner</Label>
    </Felt>
  ),
  "instants-and-sorceries": () => (
    <g>
      {phasesRow()}
      <Label x={20} y={30} size={12} weight={700}>Your turn</Label>
      <rect x={82} y={118} width={60} height={14} rx={3} fill={C.mtg.U} />
      <rect x={218} y={118} width={60} height={14} rx={3} fill={C.mtg.U} />
      <Label x={20} y={125} size={11}>Sorcery:</Label>
      <rect x={14} y={142} width={332} height={14} rx={3} fill={C.mtg.R} />
      <Label x={20} y={175} size={11}>Instant: almost any time, even on their turn</Label>
    </g>
  ),
  "artifacts-and-enchantments": () => (
    <Felt>
      <Card x={60} y={40} w={70} h={100} color="G" name="Beast" pt="4/4" glyph={<Art color="G" kind="beast" />} />
      <Card x={110} y={70} w={48} h={66} color="C" name="Hammer" glyph={<Art color="C" kind="hammer" />} />
      <Label x={100} y={162} anchor="middle" fill={C.feltInk} size={11}>Equipment attached</Label>
      <Card x={230} y={40} w={70} h={100} color="W" name="Blessing" glyph={<Art color="W" kind="glow" />} />
      <Label x={265} y={162} anchor="middle" fill={C.feltInk} size={11}>Enchantment</Label>
    </Felt>
  ),
  "planeswalkers-and-lands": () => (
    <Felt>
      <Card x={70} y={30} w={80} h={112} color="U" name="Planeswalker" glyph={<Art color="U" kind="crown" />} />
      <Chip x={140} y={132} text="4" />
      <Label x={110} y={165} anchor="middle" fill={C.feltInk} size={11}>loyalty in the corner</Label>
      <Card x={220} y={30} w={80} h={112} color="G" name="Forest" glyph={<Art color="G" kind="land" />} />
      <Label x={260} y={165} anchor="middle" fill={C.feltInk} size={11}>a land: never a spell</Label>
    </Felt>
  ),

  /* ---------- 5 Zones ---------- */
  "where-cards-live": () => (
    <Felt>
      <Zone x={14} y={14} w={60} h={80} label="Library" fill={C.surface2}><Card x={21} y={30} w={46} h={58} faceDown /></Zone>
      <Zone x={84} y={14} w={192} h={80} label="Battlefield" fill={C.surface2}>
        <Card x={96} y={30} w={40} h={56} color="G" glyph={<Art color="G" kind="beast" />} />
        <Card x={144} y={30} w={40} h={56} color="G" glyph={<Art color="G" kind="land" />} />
        <Card x={192} y={30} w={40} h={56} color="R" glyph={<Art color="R" kind="land" />} />
      </Zone>
      <Zone x={286} y={14} w={60} h={80} label="Exile" fill={C.surface2}><Card x={293} y={30} w={46} h={58} color="C" dashed /></Zone>
      <Zone x={14} y={104} w={60} h={80} label="Graveyard" fill={C.surface2}><Card x={21} y={120} w={46} h={58} color="B" /></Zone>
      <Zone x={84} y={104} w={192} h={80} label="Hand (secret)" fill={C.surface2}>
        {[0, 1, 2, 3, 4].map((i) => <Card key={i} x={100 + i * 32} y={122} w={40} h={56} color={(["W", "U", "G", "R", "G"] as const)[i]!} />)}
      </Zone>
      <Zone x={286} y={104} w={60} h={80} label="Stack" fill={C.surface2}><Card x={293} y={120} w={46} h={58} color="U" glyph={<Art color="U" kind="star" />} /></Zone>
    </Felt>
  ),
  "library-and-hand": () => (
    <Felt>
      <Pile x={50} y={50} count={23} label="Library: face down" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i} transform={`rotate(${(i - 3) * 7} 245 180)`}><Card x={220} y={50} w={50} h={70} color={(["W", "U", "B", "R", "G", "G", "W"] as const)[i]!} /></g>
      ))}
      <Label x={245} y={170} anchor="middle" fill={C.feltInk} size={11} weight={700}>Hand: seven cards, only you see them</Label>
    </Felt>
  ),
  "battlefield-and-graveyard": () => (
    <Felt>
      <Zone x={20} y={30} w={180} h={120} label="Battlefield" fill={C.surface2}>
        <Card x={40} y={52} w={60} h={84} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
        <Chip x={70} y={60} text="-3" />
      </Zone>
      <Arrow x1={110} y1={94} x2={250} y2={94} color={C.feltInk} />
      <Label x={180} y={80} anchor="middle" fill={C.feltInk} size={11}>destroyed</Label>
      <Zone x={250} y={30} w={90} h={120} label="Graveyard" fill={C.surface2}>
        <Card x={265} y={52} w={60} h={84} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      </Zone>
      <Label x={295} y={168} anchor="middle" fill={C.feltInk} size={11}>face up, anyone can look</Label>
    </Felt>
  ),
  "exile-and-stack": () => (
    <Felt>
      <Zone x={20} y={40} w={110} h={110} label="Exile" fill={C.surface2}><Card x={45} y={62} w={60} h={80} color="C" dashed name="Removed" /></Zone>
      <Label x={75} y={170} anchor="middle" fill={C.feltInk} size={11}>usually gone for good</Label>
      <Zone x={210} y={40} w={130} h={110} label="The stack" fill={C.surface2}>
        <Card x={240} y={70} w={60} h={70} color="G" name="Creature" glyph={<Art color="G" kind="beast" />} />
        <Chip x={270} y={60} text="waiting to happen" mono={false} />
      </Zone>
    </Felt>
  ),

  /* ---------- 6 Starting a game ---------- */
  "setting-up": () => (
    <Felt>
      <Player x={50} y={55} name="You" life={20} />
      <Player x={310} y={55} name="Opponent" life={20} color={C.hint} />
      <circle cx={180} cy={50} r={16} fill={C.focus} stroke={C.border} />
      <text x={180} y={51} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={C.accentInk}>flip</text>
      <Label x={180} y={78} anchor="middle" fill={C.feltInk} size={10}>who goes first?</Label>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <Card key={i} x={96 + i * 26} y={120} w={40} h={56} color={(["G", "G", "R", "G", "R", "G", "R"] as const)[i]!} />)}
      <Label x={180} y={190} anchor="middle" fill={C.feltInk} size={11} weight={700}>shuffle, then draw seven</Label>
    </Felt>
  ),
  mulligans: () => (
    <g>
      <Label x={16} y={18} size={12} weight={700}>Hand 1: only one land</Label>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <Card key={i} x={16 + i * 22} y={30} w={34} h={48} color={i === 0 ? "G" : (["R", "R", "G", "R", "G", "R"] as const)[i - 1]!} glyph={i === 0 ? <Art color="G" kind="land" /> : undefined} />)}
      <Cross x={190} y={54} />
      <Arrow x1={16} y1={92} x2={16} y2={110} color={C.muted} />
      <Label x={28} y={100} size={11} fill={C.muted}>shuffle, draw seven again, then put one on the bottom</Label>
      <Label x={16} y={122} size={12} weight={700}>Hand 2: six cards kept</Label>
      {[0, 1, 2, 3, 4, 5].map((i) => <Card key={i} x={16 + i * 22} y={134} w={34} h={48} color={(["G", "G", "G", "R", "R", "R"] as const)[i]!} glyph={i < 3 ? <Art color="G" kind="land" /> : undefined} />)}
      <Check x={170} y={158} />
      <Arrow x1={200} y1={158} x2={262} y2={158} color={C.muted} />
      <Pile x={270} y={126} w={34} h={48} />
      <Label x={287} y={188} anchor="middle" size={10} fill={C.muted}>bottom of library</Label>
    </g>
  ),
  "first-turn": () => (
    <g>
      <Label x={20} y={22} size={12} weight={700}>Turn 1: first player</Label>
      <Pile x={20} y={36} w={40} h={56} />
      <Arrow x1={70} y1={64} x2={110} y2={64} color={C.muted} dashed />
      <Cross x={128} y={64} />
      <Label x={148} y={64} size={11}>no draw on the very first turn</Label>
      <Label x={20} y={118} size={12} weight={700}>Turn 2: other player</Label>
      <Pile x={20} y={132} w={40} h={56} />
      <Arrow x1={70} y1={160} x2={110} y2={160} />
      <Card x={120} y={132} w={40} h={56} color="G" />
      <Check x={180} y={160} />
      <Label x={200} y={160} size={11}>draws a card, as usual</Label>
    </g>
  ),

  /* ---------- 7 The turn ---------- */
  "five-phases": () => (
    <g>
      {phasesRow()}
      <path d="M 346 104 Q 356 150 180 150 Q 4 150 14 104" fill="none" stroke={C.muted} strokeWidth={2} strokeDasharray="6 4" />
      <polygon points="14,100 8,112 20,112" fill={C.muted} />
      <Label x={180} y={166} anchor="middle" size={11} fill={C.muted}>then it's the other player's turn, in the same order</Label>
    </g>
  ),
  "beginning-phase": () => (
    <g>
      {phasesRow(0)}
      <Label x={20} y={30} size={12} weight={700}>Untap, Upkeep, Draw</Label>
      <Card x={30} y={118} w={36} h={50} color="G" tapped glyph={<Art color="G" kind="land" />} />
      <Arrow x1={76} y1={143} x2={96} y2={143} color={C.muted} width={2} />
      <Card x={102} y={118} w={36} h={50} color="G" glyph={<Art color="G" kind="land" />} />
      <Label x={120} y={182} anchor="middle" size={10}>1. untap</Label>
      <Chip x={190} y={143} text="upkeep" mono={false} />
      <Label x={190} y={182} anchor="middle" size={10}>2. upkeep</Label>
      <Pile x={250} y={118} w={36} h={50} />
      <Arrow x1={292} y1={143} x2={310} y2={143} width={2} />
      <Card x={312} y={118} w={36} h={50} color="R" />
      <Label x={300} y={182} anchor="middle" size={10}>3. draw</Label>
    </g>
  ),
  "first-main-phase": () => (
    <g>
      {phasesRow(1)}
      <Label x={20} y={30} size={12} weight={700}>Play a land, cast spells</Label>
      <Card x={60} y={116} w={44} h={62} color="G" name="Forest" glyph={<Art color="G" kind="land" />} />
      <Label x={82} y={190} anchor="middle" size={10}>one land</Label>
      <Card x={160} y={116} w={44} h={62} color="G" name="Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Label x={182} y={190} anchor="middle" size={10}>a creature</Label>
      <Card x={260} y={116} w={44} h={62} color="U" name="Sorcery" glyph={<Art color="U" kind="star" />} />
      <Label x={282} y={190} anchor="middle" size={10}>a sorcery</Label>
    </g>
  ),
  "combat-phase": () => (
    <g>
      {phasesRow(2)}
      <Label x={20} y={30} size={12} weight={700}>Attack, block, damage</Label>
      <Card x={40} y={116} w={40} h={56} color="R" tapped pt="2/1" glyph={<Art color="R" kind="dog" />} />
      <Card x={100} y={116} w={40} h={56} color="G" tapped pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Arrow x1={150} y1={144} x2={200} y2={144} />
      <Card x={210} y={116} w={40} h={56} color="G" pt="1/3" glyph={<Art color="G" kind="spider" />} />
      <Label x={230} y={186} anchor="middle" size={10}>blocks one</Label>
      <Arrow x1={150} y1={126} x2={290} y2={126} dashed />
      <Player x={310} y={130} name="Opp." color={C.hint} />
    </g>
  ),
  "second-main-phase": () => (
    <g>
      {phasesRow(3)}
      <Label x={20} y={30} size={12} weight={700}>After combat: more spells</Label>
      <Card x={60} y={116} w={40} h={56} color="R" tapped pt="2/1" glyph={<Art color="R" kind="dog" />} />
      <Label x={80} y={186} anchor="middle" size={10}>already attacked</Label>
      <Arrow x1={150} y1={144} x2={200} y2={144} />
      <Card x={210} y={116} w={44} h={62} color="G" name="Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Label x={232} y={190} anchor="middle" size={10}>cast now</Label>
    </g>
  ),
  "ending-phase": () => (
    <g>
      {phasesRow(4)}
      <Label x={20} y={30} size={12} weight={700}>End step, then cleanup</Label>
      <Card x={40} y={116} w={40} h={56} color="G" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <g opacity={0.4}><Chip x={60} y={122} text="-1" /></g>
      <Label x={60} y={186} anchor="middle" size={10}>damage clears</Label>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Card key={i} x={150 + i * 18} y={120} w={26} h={38} color={i === 7 ? "R" : "G"} dashed={i === 7} />)}
      <Arrow x1={300} y1={140} x2={330} y2={140} color={C.muted} width={2} />
      <Label x={240} y={186} anchor="middle" size={10}>discard down to seven</Label>
    </g>
  ),

  /* ---------- 8 Combat ---------- */
  attacking: () => (
    <Felt>
      <Card x={60} y={60} w={54} h={76} color="R" pt="2/1" tapped glyph={<Art color="R" kind="dog" />} />
      <Card x={140} y={60} w={54} h={76} color="G" pt="2/2" tapped glyph={<Art color="G" kind="beast" />} />
      <Arrow x1={210} y1={98} x2={270} y2={98} color={C.feltInk} />
      <Player x={310} y={95} name="Opponent" life={16} color={C.hint} />
      <Label x={127} y={160} anchor="middle" fill={C.feltInk} size={11}>attackers turn sideways</Label>
    </Felt>
  ),
  "summoning-sickness": () => (
    <Felt>
      <Card x={50} y={50} w={60} h={84} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Chip x={80} y={44} text="arrived this turn" mono={false} />
      <Cross x={80} y={150} />
      <Label x={80} y={175} anchor="middle" fill={C.feltInk} size={11}>waits a turn</Label>
      <Card x={200} y={50} w={60} h={84} color="R" name="Scourge" pt="3/3" tapped glyph={<Art color="R" kind="dog" />} />
      <Chip x={230} y={44} text="Haste" mono={false} />
      <Check x={230} y={150} />
      <Label x={230} y={175} anchor="middle" fill={C.feltInk} size={11}>attacks right away</Label>
    </Felt>
  ),
  blocking: () => (
    <Felt>
      <Card x={40} y={30} w={50} h={70} color="R" pt="2/1" tapped glyph={<Art color="R" kind="dog" />} />
      <Card x={40} y={115} w={50} h={70} color="G" pt="2/2" tapped glyph={<Art color="G" kind="beast" />} />
      <Arrow x1={100} y1={65} x2={170} y2={65} color={C.feltInk} />
      <Card x={180} y={30} w={50} h={70} color="G" pt="1/3" glyph={<Art color="G" kind="spider" />} />
      <Label x={205} y={115} anchor="middle" fill={C.feltInk} size={11}>blocked</Label>
      <Arrow x1={100} y1={150} x2={280} y2={150} color={C.feltInk} dashed />
      <Player x={310} y={145} name="Opponent" life={18} color={C.hint} />
      <Label x={190} y={170} anchor="middle" fill={C.feltInk} size={11}>unblocked: 2 damage</Label>
    </Felt>
  ),
  "combat-damage": () => (
    <Felt>
      <Card x={60} y={40} w={60} h={84} color="G" name="3/3" pt="3/3" glyph={<Art color="G" kind="beast" />} />
      <Chip x={90} y={34} text="-2" />
      <Check x={90} y={150} /><Label x={90} y={175} anchor="middle" fill={C.feltInk} size={11}>survives</Label>
      <Arrow x1={130} y1={70} x2={200} y2={70} color={C.feltInk} /><Arrow x1={200} y1={95} x2={130} y2={95} color={C.feltInk} />
      <Label x={165} y={82} anchor="middle" fill={C.feltInk} size={10}>at once</Label>
      <Card x={210} y={40} w={60} h={84} color="R" name="2/2" pt="2/2" glyph={<Art color="R" kind="dog" />} />
      <Chip x={240} y={34} text="-3" />
      <Cross x={240} y={150} /><Label x={240} y={175} anchor="middle" fill={C.feltInk} size={11}>destroyed</Label>
    </Felt>
  ),
  "combat-keywords": () => (
    <g>
      {[["Flying", "U", "bird", "only Flying or Reach blocks it"], ["Trample", "G", "beast", "extra damage goes through"], ["Deathtouch", "B", "snake", "any damage destroys"], ["First strike", "W", "knight", "hits first"]].map(([k, c, g, d], i) => {
        const x = 12 + i * 87;
        return (
          <g key={k}>
            <Card x={x + 14} y={16} w={56} h={78} color={c as "U"} name={k} glyph={<Art color={c as "U"} kind={g as "bird"} />} />
            <text x={x + 42} y={116} fontSize={9.5} textAnchor="middle" fill={C.text}>{d!.split(" ").slice(0, 3).join(" ")}</text>
            <text x={x + 42} y={130} fontSize={9.5} textAnchor="middle" fill={C.text}>{d!.split(" ").slice(3).join(" ")}</text>
          </g>
        );
      })}
      <Label x={180} y={172} anchor="middle" size={11} fill={C.muted}>Lifelink, Vigilance and Reach are in the glossary</Label>
    </g>
  ),

  /* ---------- 9 The stack ---------- */
  "the-stack": () => (
    <Felt>
      <Zone x={110} y={20} w={140} h={160} label="The stack" fill={C.surface2}>
        <Card x={150} y={92} w={60} h={70} color="G" name="Creature" glyph={<Art color="G" kind="beast" />} />
        <Card x={150} y={44} w={60} h={70} color="U" name="Counter" glyph={<Art color="U" kind="star" />} />
      </Zone>
      <Chip x={290} y={60} text="happens first" mono={false} />
      <Arrow x1={262} y1={66} x2={214} y2={70} />
      <Chip x={290} y={140} text="was cast first" mono={false} />
      <Arrow x1={262} y1={134} x2={214} y2={126} />
    </Felt>
  ),
  priority: () => (
    <Felt>
      <Player x={60} y={80} name="You" />
      <Player x={300} y={80} name="Opponent" color={C.hint} />
      <Arrow x1={95} y1={60} x2={265} y2={60} color={C.feltInk} />
      <Arrow x1={265} y1={90} x2={95} y2={90} color={C.feltInk} />
      <Chip x={180} y={48} text="Pass" mono={false} /><Chip x={180} y={102} text="Pass" mono={false} />
      <Label x={180} y={140} anchor="middle" fill={C.feltInk} size={11} weight={700}>both pass in a row</Label>
      <Arrow x1={180} y1={150} x2={180} y2={170} color={C.feltInk} />
      <Label x={180} y={186} anchor="middle" fill={C.feltInk} size={11}>the top of the stack happens</Label>
    </Felt>
  ),
  responding: () => (
    <Felt>
      <Card x={30} y={40} w={54} h={76} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Label x={57} y={135} anchor="middle" fill={C.feltInk} size={10}>1. you cast</Label>
      <Arrow x1={92} y1={78} x2={128} y2={78} color={C.feltInk} />
      <Card x={136} y={50} w={54} h={76} color="G" name="Bear Cub" pt="2/2" glyph={<Art color="G" kind="beast" />} />
      <Card x={146} y={30} w={54} h={76} color="U" name="Cancel" glyph={<Art color="U" kind="star" />} />
      <Label x={168} y={135} anchor="middle" fill={C.feltInk} size={10}>2. they respond</Label>
      <Arrow x1={208} y1={78} x2={244} y2={78} color={C.feltInk} />
      <Card x={252} y={40} w={54} h={76} color="G" name="Bear Cub" pt="2/2" dashed glyph={<Art color="G" kind="beast" />} />
      <Cross x={279} y={78} />
      <Label x={279} y={135} anchor="middle" fill={C.feltInk} size={10}>3. countered</Label>
      <Label x={180} y={172} anchor="middle" fill={C.feltInk} size={11}>Cancel happens first, so the Cub never arrives</Label>
    </Felt>
  ),
  "why-it-matters": () => (
    <g>
      {[["Save a creature", "G", "beast", "+3/+3 in response"], ["Pump after blocks", "G", "beast", "they can't un-block"], ["Counter a spell", "U", "star", "it never happens"]].map(([t, c, g, d], i) => {
        const x = 20 + i * 112;
        return (
          <g key={t}>
            <Zone x={x} y={20} w={100} h={150} label={t} fill={C.surface2}>
              <Card x={x + 24} y={44} w={52} h={72} color={c as "G"} glyph={<Art color={c as "G"} kind={g as "beast"} />} />
            </Zone>
            <text x={x + 50} y={140} fontSize={9.5} textAnchor="middle" fill={C.text}>{d}</text>
          </g>
        );
      })}
    </g>
  ),

  /* ---------- 10 The five colours ---------- */
  "what-is-the-colour-pie": () => pie(false),
  white: () => colourScene("W", "sun", [["knight", "2/2"], ["knight", "2/2"], ["bird", "1/1"]], "a team of small creatures"),
  blue: () => colourScene("U", "water drop", [["bird", "2/2"], ["star", ""]], "flyers and counterspells"),
  black: () => colourScene("B", "skull", [["snake", "1/1"], ["bolt", ""]], "removal and deathtouch"),
  red: () => colourScene("R", "flame", [["dog", "3/3"], ["bolt", ""]], "haste and burn"),
  green: () => colourScene("G", "tree", [["beast", "4/4"], ["land", ""]], "big creatures and extra mana"),
  "mixing-colours": () => pie(true),

  /* ---------- 11 Formats and next steps ---------- */
  "what-is-a-format": () => (
    <g>
      <Zone x={14} y={14} w={150} h={170} label="Standard: two players" fill={C.surface2}>
        <Player x={60} y={70} name="You" life={20} />
        <Player x={120} y={70} name="Opp." life={20} color={C.hint} />
        <Label x={89} y={160} anchor="middle" size={10}>60-card decks</Label>
      </Zone>
      <Zone x={196} y={14} w={150} h={170} label="Commander: four players" fill={C.surface2}>
        <Player x={230} y={60} name="A" life={40} />
        <Player x={312} y={60} name="B" life={40} color={C.hint} />
        <Player x={230} y={118} name="C" life={40} color={C.success} />
        <Player x={312} y={118} name="D" life={40} color={C.focus} />
      </Zone>
    </g>
  ),
  standard: () => (
    <g>
      <Pile x={40} y={50} count={60} label="60 cards" />
      <Label x={150} y={40} size={12} weight={700}>At most four of a card</Label>
      {[0, 1, 2, 3].map((i) => <Card key={i} x={150 + i * 34} y={56} w={40} h={56} color="R" name="Goblin" highlight />)}
      <g opacity={0.35}><Card x={290} y={56} w={40} h={56} color="R" name="Goblin" dashed /></g>
      <Cross x={310} y={84} />
      <Label x={150} y={135} size={11} fill={C.muted}>except basic lands: as many as you like</Label>
      <Chip x={240} y={165} text="Life 20" size={12} />
    </g>
  ),
  "commander-basics": () => (
    <Felt>
      <Card x={40} y={40} w={64} h={90} color="W" name="Commander" glyph={<Art color="W" kind="crown" />} highlight />
      <Label x={72} y={150} anchor="middle" fill={C.feltInk} size={10}>legendary, face up</Label>
      <Pile x={160} y={50} count={99} label="99 others, all different" />
      <Chip x={290} y={70} text="Life 40" size={13} />
      <Label x={290} y={100} anchor="middle" fill={C.feltInk} size={10}>100 cards in all</Label>
    </Felt>
  ),
  "commander-rules": () => (
    <Felt>
      <Zone x={20} y={30} w={120} h={130} label="Command zone" fill={C.surface2}><Card x={50} y={56} w={60} h={84} color="W" name="Commander" glyph={<Art color="W" kind="crown" />} /></Zone>
      <Arrow x1={150} y1={80} x2={200} y2={80} color={C.feltInk} /><Label x={175} y={66} anchor="middle" fill={C.feltInk} size={10}>cast</Label>
      <Arrow x1={200} y1={110} x2={150} y2={110} color={C.feltInk} dashed /><Label x={175} y={126} anchor="middle" fill={C.feltInk} size={10}>comes back</Label>
      <Card x={210} y={56} w={60} h={84} color="W" name="Commander" glyph={<Art color="W" kind="crown" />} />
      <Chip x={310} y={70} text="+2 each cast" mono={false} />
      <Label x={180} y={180} anchor="middle" fill={C.feltInk} size={11}>destroyed? it may return to the command zone</Label>
    </Felt>
  ),
  "commander-deck-recipe": () => (
    <g>
      {[["Lands", 37, "G"], ["Ramp", 10, "G"], ["Card draw", 10, "U"], ["Removal", 8, "B"], ["Board wipes", 5, "W"], ["Your plan", 30, "R"]].map(([n, v, c], i) => {
        const y = 18 + i * 28;
        const w = (Number(v) / 37) * 190;
        return (
          <g key={String(n)}>
            <Label x={14} y={y + 9} size={11}>{n}</Label>
            <rect x={100} y={y} width={w} height={18} rx={4} fill={C.mtg[c as "G"]} stroke={C.border} />
            <Label x={106 + w} y={y + 9} size={11} fill={C.muted}>{v}</Label>
          </g>
        );
      })}
      <Label x={180} y={192} anchor="middle" size={10} fill={C.muted}>a starting point for 100 cards, not a rule</Label>
    </g>
  ),
  "where-next": () => (
    <g>
      <rect x={30} y={30} width={70} height={130} rx={12} fill={C.surface2} stroke={C.border} strokeWidth={2} />
      <rect x={38} y={44} width={54} height={100} rx={4} fill={C.felt} />
      <Label x={65} y={178} anchor="middle" size={10}>this app</Label>
      <Arrow x1={108} y1={95} x2={136} y2={95} color={C.muted} width={2} />
      <rect x={146} y={60} width={70} height={60} rx={6} fill={C.rail} />
      <Player x={162} y={78} name="" color={C.accent} /><Player x={200} y={78} name="" color={C.hint} />
      <Label x={181} y={178} anchor="middle" size={10}>a game shop</Label>
      <Arrow x1={224} y1={95} x2={252} y2={95} color={C.muted} width={2} />
      <rect x={262} y={50} width={70} height={90} rx={6} fill={C.surface2} stroke={C.border} strokeWidth={2} />
      <Card x={280} y={64} w={34} h={48} color="G" />
      <Label x={297} y={178} anchor="middle" size={10}>a starter deck</Label>
    </g>
  ),

  /* ---------- 12 Commander ---------- */
  "what-is-commander": () => (
    <Felt>
      <Player x={180} y={40} name="" color={C.hint} /><Card x={165} y={62} w={30} h={42} color="U" />
      <Player x={60} y={100} name="" color={C.success} /><Card x={85} y={80} w={30} h={42} color="G" />
      <Player x={300} y={100} name="" color={C.focus} /><Card x={245} y={80} w={30} h={42} color="R" />
      <Player x={180} y={160} name="" color={C.accent} /><Card x={165} y={112} w={30} h={42} color="W" />
      <Label x={180} y={188} anchor="middle" fill={C.feltInk} size={11}>four players, four commanders, 40 life each</Label>
    </Felt>
  ),
  "casting-your-commander": () => (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Label x={30 + i * 112} y={22} size={12} weight={700}>Cast {i + 1}</Label>
          <Card x={30 + i * 112} y={36} w={54} h={76} color="W" name="Syr Alin" glyph={<Art color="W" kind="knight" />} />
          <g>
            <Generic x={44 + i * 112} y={136} n={3 + 2 * i} r={10} />
            <Mana x={68 + i * 112} y={136} color="W" r={10} />
            <Mana x={92 + i * 112} y={136} color="W" r={10} />
          </g>
          {i > 0 && <Chip x={70 + i * 112} y={168} text={`tax +${2 * i}`} mono={false} />}
        </g>
      ))}
    </g>
  ),
  "commander-comes-back": () => (
    <Felt>
      <Card x={40} y={50} w={60} h={84} color="W" name="Commander" glyph={<Art color="W" kind="crown" />} />
      <Chip x={70} y={44} text="destroyed" mono={false} />
      <Arrow x1={108} y1={92} x2={160} y2={60} color={C.feltInk} />
      <Zone x={168} y={24} w={100} h={76} label="Command zone" fill={C.surface2}><Check x={248} y={70} /></Zone>
      <Arrow x1={108} y1={100} x2={160} y2={140} color={C.feltInk} dashed />
      <Zone x={168} y={110} w={100} h={76} label="Graveyard" fill={C.surface2}><Label x={218} y={160} anchor="middle" size={9} fill={C.muted}>also allowed</Label></Zone>
      <Label x={315} y={62} anchor="middle" fill={C.feltInk} size={10}>your choice</Label>
    </Felt>
  ),
  "ways-to-lose": () => (
    <g>
      <Chip x={70} y={50} text="Life 40" size={16} />
      <Label x={70} y={80} anchor="middle" size={11}>reaches 0</Label>
      <Pile x={158} y={26} w={44} h={60} /><Cross x={180} y={56} />
      <Label x={180} y={100} anchor="middle" size={11}>empty library</Label>
      <Chip x={290} y={50} text="21" size={16} />
      <Label x={290} y={80} anchor="middle" size={11}>commander damage</Label>
      <Label x={290} y={96} anchor="middle" size={10} fill={C.muted}>from one commander</Label>
      <Label x={180} y={160} anchor="middle" size={12} weight={700}>any one of these loses</Label>
    </g>
  ),
  "four-player-turns": () => (
    <Felt>
      <Player x={180} y={36} name="B" color={C.hint} />
      <Player x={60} y={100} name="A" color={C.accent} />
      <Player x={300} y={100} name="C" color={C.focus} />
      <Player x={180} y={160} name="D" color={C.success} />
      <path d="M 95 70 A 90 60 0 0 1 150 44" fill="none" stroke={C.feltInk} strokeWidth={2} strokeDasharray="5 4" />
      <path d="M 210 44 A 90 60 0 0 1 268 72" fill="none" stroke={C.feltInk} strokeWidth={2} strokeDasharray="5 4" />
      <Label x={180} y={100} anchor="middle" fill={C.feltInk} size={10}>turns go clockwise</Label>
      <Arrow x1={90} y1={120} x2={160} y2={160} color={C.feltInk} />
      <Arrow x1={90} y1={112} x2={270} y2={112} color={C.feltInk} />
      <Label x={120} y={185} anchor="middle" fill={C.feltInk} size={10}>A attacks C and D</Label>
    </Felt>
  ),
  "opening-hand": () => (
    <g>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => { const land = i < 4; return <Card key={i} x={20 + i * 46} y={40} w={42} h={60} color={land ? "G" : "W"} highlight={land} glyph={land ? <Art color="G" kind="land" /> : undefined} />; })}
      <Check x={320} y={130} />
      <Label x={300} y={130} anchor="end" size={12} weight={700}>four lands: keep it</Label>
      <Label x={20} y={170} size={11} fill={C.muted}>3 to 5 lands is a good Commander hand</Label>
    </g>
  ),
  "table-talk": () => (
    <Felt>
      <Player x={60} y={70} name="A" />
      <Player x={60} y={150} name="B" color={C.hint} />
      <Player x={180} y={170} name="C" color={C.success} />
      {[0, 1, 2, 3, 4].map((i) => <Card key={i} x={230 + i * 22} y={30} w={30} h={42} color="R" />)}
      <Player x={300} y={110} name="D" color={C.focus} />
      <Chip x={290} y={150} text="biggest threat" mono={false} />
      <Arrow x1={90} y1={70} x2={226} y2={60} color={C.feltInk} />
      <Arrow x1={90} y1={140} x2={226} y2={70} color={C.feltInk} />
      <Arrow x1={200} y1={150} x2={240} y2={84} color={C.feltInk} />
    </Felt>
  ),
  "before-the-game": () => (
    <g>
      {["Exhibition", "Core", "Upgraded", "Optimized", "cEDH"].map((n, i) => {
        const y = 160 - i * 34;
        return (
          <g key={n}>
            <rect x={60} y={y} width={200} height={26} rx={5} fill={i < 2 ? C.accentSoft : C.surface2} stroke={i < 2 ? C.accent : C.border} strokeWidth={1.5} />
            <Label x={70} y={y + 13} size={11} weight={700}>{i + 1}. {n}</Label>
          </g>
        );
      })}
      <Chip x={310} y={173} text="start here" mono={false} />
      <Arrow x1={290} y1={173} x2={266} y2={173} />
    </g>
  ),

  /* ---------- 13 Ways to play ---------- */
  "limited-vs-constructed": () => (
    <g>
      <Zone x={14} y={14} w={160} h={170} label="Constructed: built at home" fill={C.surface2}>
        <Pile x={70} y={50} count={60} label="your own deck" />
      </Zone>
      <Zone x={186} y={14} w={160} h={170} label="Limited: built from packs" fill={C.surface2}>
        {[0, 1, 2].map((i) => <rect key={i} x={210 + i * 42} y={50} width={34} height={56} rx={4} fill={C.mtg.U} stroke={C.border} />)}
        <Label x={266} y={130} anchor="middle" size={10}>open, then build 40</Label>
      </Zone>
    </g>
  ),
  "booster-draft": () => (
    <Felt>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        const x = 180 + Math.cos(a) * 110, y = 100 + Math.sin(a) * 64;
        return <g key={i}><circle cx={x} cy={y} r={11} fill={i === 0 ? C.accent : C.surface} stroke={C.border} /><Card x={x - 9} y={y + 14} w={18} h={24} color="C" /></g>;
      })}
      <path d="M 180 46 A 110 64 0 0 1 290 100" fill="none" stroke={C.feltInk} strokeWidth={2} strokeDasharray="5 4" />
      <polygon points="290,100 282,88 296,88" fill={C.feltInk} />
      <Label x={180} y={100} anchor="middle" fill={C.feltInk} size={10} weight={700}>pick one, pass the rest</Label>
    </Felt>
  ),
  sealed: () => (
    <g>
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={20 + i * 38} y={30} width={32} height={52} rx={4} fill={C.mtg.U} stroke={C.border} />)}
      <Label x={134} y={100} anchor="middle" size={11}>six packs, all yours</Label>
      <Arrow x1={134} y1={112} x2={134} y2={134} />
      <Pile x={110} y={140} w={44} h={50} count={40} />
      <Label x={250} y={150} anchor="middle" size={11} weight={700}>Prerelease:</Label>
      <Label x={250} y={168} anchor="middle" size={10} fill={C.muted}>new set, relaxed, great first event</Label>
    </g>
  ),
  "building-a-limited-deck": () => (
    <g>
      <Label x={14} y={24} size={12} weight={700}>40 cards</Label>
      <rect x={14} y={40} width={170} height={28} rx={5} fill={C.mtg.G} stroke={C.border} /><Label x={99} y={54} anchor="middle" size={11} fill={C.ink.G} weight={700}>17 lands</Label>
      <rect x={186} y={40} width={110} height={28} rx={5} fill={C.mtg.R} stroke={C.border} /><Label x={241} y={54} anchor="middle" size={11} fill={C.ink.R} weight={700}>15 creatures</Label>
      <rect x={298} y={40} width={48} height={28} rx={5} fill={C.mtg.U} stroke={C.border} /><Label x={322} y={54} anchor="middle" size={10} fill={C.ink.U} weight={700}>8 other</Label>
      <Label x={14} y={100} size={11}>two colours, from where your best cards are</Label>
      <Mana x={30} y={130} color="G" r={12} /><Mana x={62} y={130} color="R" r={12} />
      <Label x={14} y={168} size={10} fill={C.muted}>costs from 2 to 5, a few removal spells</Label>
    </g>
  ),
  "constructed-formats": () => (
    <g>
      <circle cx={180} cy={110} r={82} fill={C.surface2} stroke={C.border} strokeWidth={1.5} />
      <circle cx={180} cy={120} r={56} fill={C.accentSoft} stroke={C.border} strokeWidth={1.5} />
      <circle cx={180} cy={130} r={30} fill={C.accent} stroke={C.border} strokeWidth={1.5} />
      <Label x={180} y={130} anchor="middle" size={11} weight={700} fill={C.accentInk}>Standard</Label>
      <Label x={180} y={80} anchor="middle" size={11} weight={700}>Pioneer: since 2012</Label>
      <Label x={180} y={42} anchor="middle" size={11} weight={700}>Modern: since 2003</Label>
      <Label x={290} y={150} anchor="middle" size={10} fill={C.muted}>Standard rotates;</Label>
      <Label x={290} y={164} anchor="middle" size={10} fill={C.muted}>the others don't</Label>
    </g>
  ),
  pauper: () => (
    <g>
      {[0, 1, 2, 3].map((i) => <Card key={i} x={40 + i * 10} y={40 - i * 6} w={70} h={98} color="U" name="Common" />)}
      <circle cx={100} cy={120} r={9} fill={C.bg} stroke={C.border} /><Label x={100} y={120} anchor="middle" size={8} fill={C.text}>C</Label>
      <Label x={100} y={160} anchor="middle" size={10}>black set symbol = common</Label>
      <rect x={210} y={60} width={110} height={44} rx={6} fill={C.successSoft} stroke={C.success} strokeWidth={1.5} />
      <Label x={265} y={82} anchor="middle" size={12} weight={700} fill={C.success}>cheap to build</Label>
      <Label x={265} y={128} anchor="middle" size={10} fill={C.muted}>sharp to play</Label>
    </g>
  ),
  "deck-shape": () => (
    <g>
      <Label x={14} y={24} size={12} weight={700}>100 cards</Label>
      <rect x={14} y={40} width={124} height={28} rx={5} fill={C.mtg.G} stroke={C.border} /><Label x={76} y={54} anchor="middle" size={11} fill={C.ink.G} weight={700}>37 lands</Label>
      <rect x={140} y={40} width={36} height={28} rx={5} fill={C.mtg.U} stroke={C.border} /><Label x={158} y={54} anchor="middle" size={9} fill={C.ink.U} weight={700}>10 ramp</Label>
      <rect x={178} y={40} width={42} height={28} rx={5} fill={C.mtg.W} stroke={C.border} /><Label x={199} y={54} anchor="middle" size={9} fill={C.ink.W} weight={700}>12 draw</Label>
      <rect x={222} y={40} width={42} height={28} rx={5} fill={C.mtg.B} stroke={C.border} /><Label x={243} y={54} anchor="middle" size={9} fill={C.ink.B} weight={700}>12 answers</Label>
      <rect x={266} y={40} width={80} height={28} rx={5} fill={C.mtg.R} stroke={C.border} /><Label x={306} y={54} anchor="middle" size={9} fill={C.ink.R} weight={700}>29 yours</Label>
      <Label x={14} y={96} size={11}>skeleton first, then the cards that make it yours</Label>
      <Label x={14} y={126} size={11} weight={700}>cost 6 or more: only 3 or 4</Label>
      {[1, 2, 3, 4, 5, 6, 7].map((mv, i) => { const h = [6, 14, 18, 14, 9, 4, 2][i]!; return <g key={mv}><rect x={200 + i * 20} y={170 - h * 2.4} width={16} height={h * 2.4} rx={2} fill={mv >= 6 ? C.hint : C.accent} /><Label x={208 + i * 20} y={182} anchor="middle" size={9} fill={C.muted}>{mv}</Label></g>; })}
      <Label x={200} y={126} size={9} fill={C.muted}>cards per cost</Label>
    </g>
  ),
  "the-five-jobs": () => (
    <g>
      {[["Ramp", "Add {G}", "G"], ["Draw", "draw a card", "U"], ["Removal", "destroy target", "B"], ["Wipe", "destroy all", "W"], ["Finisher", "7/7 trample", "R"]].map(([job, text, col], i) => (
        <g key={job}>
          <rect x={14} y={16 + i * 36} width={88} height={28} rx={6} fill={C.mtg[col as "G"]} stroke={C.border} /><Label x={58} y={30 + i * 36} anchor="middle" size={11} weight={700} fill={C.ink[col as "G"]}>{job}</Label>
          <Arrow x1={106} y1={30 + i * 36} x2={126} y2={30 + i * 36} color={C.muted} width={2} />
          <Chip x={132} y={20 + i * 36} text={`"${text}"`} />
        </g>
      ))}
      <Label x={250} y={100} size={10} fill={C.muted}>read the text,</Label>
      <Label x={250} y={114} size={10} fill={C.muted}>not the name</Label>
    </g>
  ),
  "points-of-contact": () => (
    <g>
      <Card x={14} y={30} w={60} h={84} color="G" name="Commander" glyph="G" />
      <Chip x={84} y={34} text="lands entering" /><Chip x={84} y={56} text="draw a card" /><Chip x={84} y={78} text="gain life" />
      <Card x={210} y={14} w={46} h={60} color="G" name="Fetch 2 lands" />
      <Check x={268} y={44} r={9} /><Label x={282} y={48} size={10} weight={700}>3 points</Label>
      <Card x={210} y={80} w={46} h={60} color="R" name="3 damage" />
      <Label x={268} y={112} size={10} fill={C.muted}>1 point: passenger</Label>
      <Card x={210} y={146} w={46} h={52} color="C" name="4/4 no text" />
      <Cross x={268} y={172} r={9} /><Label x={282} y={176} size={10} weight={700}>0 points: cut</Label>
    </g>
  ),
  "ways-to-win": () => (
    <g>
      {[["Combat", "R"], ["Voltron 21", "W"], ["Go wide", "G"], ["Drain", "B"], ["Big X", "U"]].map(([name, col], i) => (
        <g key={name}><rect x={14 + i * 68} y={60} width={60} height={40} rx={6} fill={C.mtg[col as "G"]} stroke={C.border} /><Label x={44 + i * 68} y={80} anchor="middle" size={10} weight={700} fill={C.ink[col as "G"]}>{name}</Label></g>
      ))}
      <Label x={14} y={30} size={12} weight={700}>3 or 4 real ways to close</Label>
      <Label x={14} y={134} size={10} fill={C.muted}>from a normal board, not a dream one</Label>
      <Label x={14} y={170} size={10} fill={C.muted}>"double your life at 80" is not one of them</Label>
    </g>
  ),
  "what-sets-the-bracket": () => (
    <g>
      {[1, 2, 3, 4, 5].map((b) => (<g key={b}><rect x={14 + (b - 1) * 68} y={20} width={60} height={30} rx={6} fill={b === 2 ? C.accent : C.surface} stroke={C.border} /><Label x={44 + (b - 1) * 68} y={35} anchor="middle" size={11} weight={700} fill={b === 2 ? C.accentInk : C.text}>B{b}</Label></g>))}
      <Label x={14} y={72} size={10} weight={700}>none of the signals: Bracket 2</Label>
      <Chip x={14} y={90} text="1 to 3 Game Changers" /><Arrow x1={150} y1={100} x2={170} y2={100} color={C.muted} width={2} /><Label x={176} y={104} size={10}>at least B3</Label>
      <Chip x={14} y={118} text="4+ Game Changers" /><Arrow x1={150} y1={128} x2={170} y2={128} color={C.muted} width={2} /><Label x={176} y={132} size={10}>B4</Label>
      <Chip x={14} y={146} text="early infinite combo" /><Arrow x1={150} y1={156} x2={170} y2={156} color={C.muted} width={2} /><Label x={176} y={160} size={10}>B4</Label>
      <Chip x={14} y={174} text="land destruction, extra turns" /><Arrow x1={190} y1={184} x2={210} y2={184} color={C.muted} width={2} /><Label x={216} y={188} size={10}>B4</Label>
    </g>
  ),
  "stars-are-not-power": () => (
    <g>
      <rect x={14} y={30} width={150} height={110} rx={8} fill={C.surface} stroke={C.border} />
      <Label x={89} y={52} anchor="middle" size={12} weight={700}>Bracket 2</Label>
      <Label x={89} y={82} anchor="middle" size={16} weight={700} fill={C.accent}>★★★★★</Label>
      <Label x={89} y={110} anchor="middle" size={10} fill={C.muted}>the best B2 deck</Label>
      <rect x={196} y={30} width={150} height={110} rx={8} fill={C.surface} stroke={C.border} />
      <Label x={271} y={52} anchor="middle" size={12} weight={700}>Bracket 4</Label>
      <Label x={271} y={82} anchor="middle" size={16} weight={700} fill={C.accent}>★★☆☆☆</Label>
      <Label x={271} y={110} anchor="middle" size={10} fill={C.muted}>a rough B4 deck</Label>
      <Arrow x1={170} y1={160} x2={300} y2={160} color={C.hint} width={3} />
      <Label x={14} y={164} size={11} weight={700}>more powerful</Label>
      <Label x={14} y={188} size={10} fill={C.muted}>stars rate a deck inside its bracket; the bracket is the power</Label>
    </g>
  ),
  "where-to-play": () => (
    <g>
      <rect x={30} y={40} width={60} height={110} rx={10} fill={C.surface2} stroke={C.border} strokeWidth={2} />
      <rect x={38} y={52} width={44} height={84} rx={4} fill={C.felt} />
      <Label x={60} y={170} anchor="middle" size={10}>Arena</Label>
      <Arrow x1={98} y1={95} x2={128} y2={95} color={C.muted} width={2} />
      <rect x={138} y={60} width={84} height={60} rx={6} fill={C.rail} />
      <Player x={158} y={80} name="" color={C.accent} /><Player x={202} y={80} name="" color={C.hint} />
      <Label x={180} y={170} anchor="middle" size={10}>a game shop</Label>
      <Arrow x1={230} y1={95} x2={260} y2={95} color={C.muted} width={2} />
      <ellipse cx={300} cy={100} rx={40} ry={22} fill={C.rail} />
      <Card x={282} y={84} w={18} h={26} color="G" /><Card x={304} y={84} w={18} h={26} color="R" />
      <Label x={300} y={170} anchor="middle" size={10}>kitchen table</Label>
    </g>
  ),
};

/** The colour pie, with ally and enemy lines when asked. */
function pie(lines: boolean): ReactNode {
  const order: ("W" | "U" | "B" | "R" | "G")[] = ["W", "U", "B", "R", "G"];
  const cx = 180, cy = 100, r = 70;
  const pt = (i: number, rad = r) => { const a = (Math.PI * 2 * i) / 5 - Math.PI / 2; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as const; };
  return (
    <g>
      {order.map((c, i) => {
        const [x1, y1] = pt(i - 0.5), [x2, y2] = pt(i + 0.5);
        return <path key={c} d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`} fill={C.mtg[c]} stroke={C.bg} strokeWidth={2} />;
      })}
      {order.map((c, i) => { const [x, y] = pt(i, r * 0.62); return <Mana key={c} x={x} y={y} color={c} r={11} />; })}
      {lines && order.map((_, i) => { const [x1, y1] = pt(i, r + 14), [x2, y2] = pt(i + 1, r + 14); return <line key={`a${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.success} strokeWidth={3} strokeLinecap="round" />; })}
      {lines && order.map((_, i) => { const [x1, y1] = pt(i, r + 14), [x2, y2] = pt(i + 2, r + 14); return <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.muted} strokeWidth={2} strokeDasharray="5 4" />; })}
      {lines && <g><line x1={20} y1={180} x2={50} y2={180} stroke={C.success} strokeWidth={3} /><Label x={56} y={180} size={10}>allies (next door)</Label><line x1={180} y1={180} x2={210} y2={180} stroke={C.muted} strokeWidth={2} strokeDasharray="5 4" /><Label x={216} y={180} size={10}>enemies (across)</Label></g>}
      {!lines && <Label x={180} y={190} anchor="middle" size={11} fill={C.muted}>each slice has its own personality</Label>}
    </g>
  );
}

/** A colour's scene: its mana symbol, a few typical cards, and a caption. */
function colourScene(c: "W" | "U" | "B" | "R" | "G", symbolName: string, cards: [string, string][], caption: string): ReactNode {
  return (
    <g>
      <Mana x={40} y={40} color={c} r={22} />
      <Label x={70} y={40} size={12} weight={700}>{symbolName} symbol</Label>
      {cards.map(([g, pt], i) => <Card key={i} x={40 + i * 76} y={74} w={60} h={84} color={c} pt={pt || undefined} glyph={<Art color={c} kind={g as "beast"} />} />)}
      <Label x={180} y={182} anchor="middle" size={11}>{caption}</Label>
    </g>
  );
}

export const H_VIEW = H;
export const W_VIEW = W;
