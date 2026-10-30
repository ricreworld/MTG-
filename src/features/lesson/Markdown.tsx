// Renders a step body. Glossary terms are underlined buttons; their definitions open
// inline, directly below the paragraph or list they appear in. No popups.
import { Fragment, useId, useState, type ReactNode } from "react";
import type { GlossaryEntry } from "../../content/schema";
import { Icon } from "../../components/Icon";
import { parseBlocks, termsInBlock, type Block, type Inline } from "./markdown";

interface Props {
  body: string;
  glossary: ReadonlyMap<string, GlossaryEntry>;
}

export function Markdown({ body, glossary }: Props) {
  const blocks = parseBlocks(body);
  return (
    <div className="grid gap-s4">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} glossary={glossary} />
      ))}
    </div>
  );
}

function BlockView({ block, glossary }: { block: Block; glossary: ReadonlyMap<string, GlossaryEntry> }) {
  const [open, setOpen] = useState<string[]>([]);
  const baseId = useId();
  const defId = (termId: string) => `${baseId}-def-${termId}`;
  const toggle = (termId: string) => setOpen((o) => (o.includes(termId) ? o.filter((x) => x !== termId) : [...o, termId]));

  const renderInline = (nodes: Inline[]): ReactNode =>
    nodes.map((n, i) => {
      if (n.kind === "text") return <Fragment key={i}>{n.text}</Fragment>;
      if (n.kind === "bold") return <strong key={i}>{renderInline(n.children)}</strong>;
      const entry = glossary.get(n.id);
      const label = n.label ?? entry?.term.toLowerCase() ?? n.id;
      if (!entry) return <Fragment key={i}>{label}</Fragment>;
      const expanded = open.includes(n.id);
      return (
        <button
          key={i}
          type="button"
          onClick={() => toggle(n.id)}
          aria-expanded={expanded}
          aria-controls={defId(n.id)}
          className="-my-s2 inline rounded-sm px-[0.1rem] py-s2 font-[inherit] text-[inherit] underline decoration-2 underline-offset-4 decoration-accent hover:bg-accent-soft active:bg-accent-soft"
        >
          {label}
          <span className="sr-only"> (show definition)</span>
        </button>
      );
    });

  const definitions = termsInBlock(block)
    .filter((id) => open.includes(id))
    .map((id) => {
      const entry = glossary.get(id);
      if (!entry) return null;
      return (
        <div key={id} id={defId(id)} className="flex items-start gap-s3 rounded-md border-l-4 border-accent bg-accent-soft p-s3">
          <Icon name="book" />
          <div className="grid gap-s1">
            <p>
              <strong>{entry.term}:</strong> {entry.definition}
            </p>
            {entry.ruleRef && <p className="text-sm text-text-muted">Rule reference: {entry.ruleRef}</p>}
          </div>
          <button
            type="button"
            onClick={() => toggle(id)}
            className="ml-auto inline-flex min-h-tap min-w-tap items-center justify-center rounded-md"
            aria-label={`Hide the definition of ${entry.term}`}
          >
            <Icon name="close" />
          </button>
        </div>
      );
    });

  return (
    <div className="grid gap-s2">
      {block.kind === "p" ? (
        <p>{renderInline(block.inline)}</p>
      ) : (
        <ul className="grid list-disc gap-s2 pl-s5">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )}
      {definitions}
    </div>
  );
}
