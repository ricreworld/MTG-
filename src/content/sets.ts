// Where cards come from. Examples are named in text only, never with logos, characters or art.
// Facts checked 2026-11-01; set lists and legality change, so every entry carries the date.

export const SETS_LAST_VERIFIED = "2026-11-01";

export interface SetType {
  id: string;
  name: string;
  summary: string;
  why: string;
  examples: string[];
  legalIn: { label: string; target: string }[];
  changes?: string;
  lastVerified: string;
}

const V = SETS_LAST_VERIFIED;

export const SET_TYPES: SetType[] = [
  { id: "expansion", name: "Main expansion sets", summary: "The regular releases. Each one moves the story forward and brings new mechanics.", why: "These are the sets you see at a prerelease and in Standard. If a shop runs a Draft night, it is almost always one of these.", examples: ["Lorwyn Eclipsed (2026)", "Reality Fracture (2026)"], legalIn: [{ label: "Standard", target: "standard" }, { label: "Pioneer", target: "pioneer" }, { label: "Modern", target: "modern" }, { label: "Commander", target: "commander" }, { label: "Draft and Sealed", target: "draft" }], changes: "New sets arrive several times a year. Check the official release calendar.", lastVerified: V },
  { id: "beyond", name: "Universes Beyond", summary: "Crossover sets with other stories and franchises. They are real Magic cards and are legal in Standard like a main set.", why: "A familiar world can be the easiest way in. The cards follow the same rules as any other set; only the setting is borrowed.", examples: ["Marvel Super Heroes (2026)", "The Hobbit (2026)", "Star Trek (2026)"], legalIn: [{ label: "Standard", target: "standard" }, { label: "Pioneer", target: "pioneer" }, { label: "Modern", target: "modern" }, { label: "Commander", target: "commander" }], changes: "Which crossover sets are Standard-legal depends on the set. Check its official page.", lastVerified: V },
  { id: "foundations", name: "Foundations", summary: "The baseline set for newcomers: the core rules cards and well-known reprints, legal in Standard for an extended period.", why: "Because it stays legal through at least 2029, cards you buy from it keep working in Standard far longer than other sets. This app's practice decks are built from it.", examples: ["Foundations (2024)"], legalIn: [{ label: "Standard", target: "standard" }, { label: "Pioneer", target: "pioneer" }, { label: "Modern", target: "modern" }, { label: "Commander", target: "commander" }], changes: "Its Standard end date is set by Wizards. Check the official Standard page.", lastVerified: V },
  { id: "supplemental", name: "Supplemental products", summary: "Commander decks, Masters sets and Modern Horizons. Not legal in Standard, which surprises new players.", why: "These products are made for other formats: ready-made Commander decks for Commander, Masters reprints and Modern Horizons for Modern and older formats. A card from them may look new but can't go in a Standard deck.", examples: ["Commander preconstructed decks", "Masters sets", "Modern Horizons sets"], legalIn: [{ label: "Commander", target: "commander" }, { label: "Modern (Modern Horizons)", target: "modern" }, { label: "Legacy", target: "legacy" }], changes: "Each product states its own legality. Check the card's official page.", lastVerified: V },
];
