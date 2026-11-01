// Two formats side by side, field by field. On a phone the two columns stay readable: labels on the left.
import type { Format } from "../../content/formats";
import { FIELDS } from "./FormatCard";

export function FormatCompare({ a, b }: { a: Format; b: Format }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <caption className="pb-s2 text-left font-display text-lg font-bold">{a.name} compared with {b.name}</caption>
      <thead><tr><th scope="col" className="sr-only">Field</th><th scope="col" className="rounded-t-md bg-surface-2 p-s2 text-left">{a.name}</th><th scope="col" className="rounded-t-md bg-surface-2 p-s2 text-left">{b.name}</th></tr></thead>
      <tbody>
        {FIELDS.map((f) => {
          const same = a.fields[f.key] === b.fields[f.key];
          return (
            <tr key={f.key}>
              <th scope="row" className="border-b border-border py-s2 pr-s2 text-left font-bold text-text-muted">{f.label}</th>
              <td className={`border-b border-border p-s2 ${same ? "" : "bg-accent-soft"}`}>{a.fields[f.key]}</td>
              <td className={`border-b border-border p-s2 ${same ? "" : "bg-accent-soft"}`}>{b.fields[f.key]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
