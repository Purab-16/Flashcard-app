export type SourceContext = { before: string; match: string; after: string };

const CONTEXT_CHARS = 300;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find a quote inside a chunk (ignoring case and whitespace) and return it with some text around it. */
export function locateQuote(content: string, quote: string): SourceContext | null {
  const parts = quote.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const found = new RegExp(parts.map(escapeRegex).join("\\s+"), "i").exec(content);
  if (!found) return null;

  const start = found.index;
  const end = start + found[0].length;
  const before = content.slice(Math.max(0, start - CONTEXT_CHARS), start);
  const after = content.slice(end, end + CONTEXT_CHARS);

  return {
    before: (start > CONTEXT_CHARS ? "..." : "") + before,
    match: found[0],
    after: after + (end + CONTEXT_CHARS < content.length ? "..." : ""),
  };
}
