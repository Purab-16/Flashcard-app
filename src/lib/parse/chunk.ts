export type Chunk = {
  idx: number;
  topic: string | null;
  content: string;
  wordCount: number;
};

const TARGET_WORDS = 500;
const MAX_WORDS = 700;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Remove characters Postgres cannot store: null bytes, other control chars, lone surrogates. */
function sanitize(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (/^#{1,6}\s+\S/.test(t)) return true;
  if (/^(chapter|unit|section|lesson)\s+\w+/i.test(t)) return true;
  if (/^\d+(\.\d+)*[.)]?\s+[A-Z]/.test(t) && !/[.!?]$/.test(t)) return true;
  return t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[.!?]$/.test(t);
}

function cleanHeading(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "");
}

/** Split a long block of text into pieces of at most MAX_WORDS words. */
function splitLong(text: string): string[] {
  if (words(text) <= MAX_WORDS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [text];
  const parts: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && words(current) + words(s) > TARGET_WORDS) {
      parts.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.flatMap(splitByWords);
}

/** Last resort for text with no sentence breaks. */
function splitByWords(text: string): string[] {
  if (words(text) <= MAX_WORDS) return [text];
  const all = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < all.length; i += TARGET_WORDS) {
    parts.push(all.slice(i, i + TARGET_WORDS).join(" "));
  }
  return parts;
}

/**
 * Chunk text into about 500 word pieces. Headings start a new chunk first,
 * then paragraphs are packed until the target size is reached.
 */
export function chunkText(raw: string): Chunk[] {
  const text = sanitize(raw).replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) return [];

  type Section = { topic: string | null; paragraphs: string[] };
  const sections: Section[] = [{ topic: null, paragraphs: [] }];

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n");
    if (lines.length === 1 && isHeading(lines[0])) {
      sections.push({ topic: cleanHeading(lines[0]), paragraphs: [] });
      continue;
    }
    if (isHeading(lines[0]) && lines.length > 1) {
      sections.push({ topic: cleanHeading(lines[0]), paragraphs: [] });
      sections[sections.length - 1].paragraphs.push(lines.slice(1).join(" ").trim());
      continue;
    }
    sections[sections.length - 1].paragraphs.push(block.replace(/\n/g, " ").trim());
  }

  const chunks: Chunk[] = [];
  const push = (topic: string | null, content: string) => {
    const c = content.trim();
    if (c) chunks.push({ idx: chunks.length, topic, content: c, wordCount: words(c) });
  };

  for (const section of sections) {
    let current = "";
    for (const para of section.paragraphs.flatMap(splitLong)) {
      if (current && words(current) + words(para) > TARGET_WORDS) {
        push(section.topic, current);
        current = "";
      }
      current += (current ? "\n\n" : "") + para;
    }
    push(section.topic, current);
  }

  return chunks;
}
