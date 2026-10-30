// Parser for the tiny markdown subset used in step bodies (see src/content/README.md).
// Pure and dependency-free, so it's easy to test and impossible to inject HTML through.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "term"; id: string; label: string | undefined }
  | { kind: "mana"; symbol: string }; // one mana symbol: W U B R G C, or a number (generic mana)

export type Block =
  | { kind: "p"; inline: Inline[] }
  | { kind: "ul"; items: Inline[][] };

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\[\[[a-z0-9-]+(?:\|[^\]]+)?\]\]|\{(?:[WUBRGC]|\d{1,2})\})/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  for (const part of text.split(INLINE_TOKEN)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ kind: "bold", children: parseInline(part.slice(2, -2)) });
    } else if (/^\{(?:[WUBRGC]|\d{1,2})\}$/.test(part)) {
      out.push({ kind: "mana", symbol: part.slice(1, -1) });
    } else if (part.startsWith("[[") && part.endsWith("]]")) {
      const [id = "", label] = part.slice(2, -2).split("|");
      out.push({ kind: "term", id, label });
    } else {
      out.push({ kind: "text", text: part });
    }
  }
  return out;
}

const LIST_LINE = /^\s*-\s+/;

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of markdown.trim().split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    let items: Inline[][] = [];
    const flushP = () => { if (paragraph.length) blocks.push({ kind: "p", inline: parseInline(paragraph.join(" ")) }); paragraph = []; };
    const flushUl = () => { if (items.length) blocks.push({ kind: "ul", items }); items = []; };
    for (const line of chunk.split("\n")) {
      if (LIST_LINE.test(line)) { flushP(); items.push(parseInline(line.replace(LIST_LINE, ""))); }
      else if (line.trim()) { flushUl(); paragraph.push(line.trim()); }
    }
    flushP();
    flushUl();
  }
  return blocks;
}

/** All glossary ids used in a block, in order, without repeats. */
export function termsInBlock(block: Block): string[] {
  const ids: string[] = [];
  const walk = (nodes: Inline[]) => nodes.forEach((n) => {
    if (n.kind === "term" && !ids.includes(n.id)) ids.push(n.id);
    if (n.kind === "bold") walk(n.children);
  });
  if (block.kind === "p") walk(block.inline); else block.items.forEach(walk);
  return ids;
}
