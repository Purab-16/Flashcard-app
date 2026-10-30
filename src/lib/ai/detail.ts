// Helpers that keep questions about real subject knowledge, not about the document itself.

const DETAIL_PATTERNS = [
  /\b(subject|course|paper|unit|module)\s+(code|name|title|number|no\.?)/i,
  /\b(name|title)\s+of\s+the\s+(subject|course|document|book|chapter|author|teacher|professor|university|college|institute)\b/i,
  /\bwho\s+(is|was)\s+the\s+(author|teacher|professor|instructor|writer)\b/i,
  /\b(which|what)\s+(page|chapter|unit|module)\s+(number|no\.?)/i,
  /\b(syllabus|credits?|semester|academic year|roll number|enrol?lment)\b/i,
  /\b[A-Z]{2,5}[-\s]?\d{3,4}[A-Z]?\b/, // codes like CS101, BIO-2040
];

/** True when the text asks about document details (course code, author, page number and so on). */
export function looksLikeDetail(text: string): boolean {
  return DETAIL_PATTERNS.some((re) => re.test(text));
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Cheap check, no AI call: skip chunks that are mostly titles, lists of codes, or contents pages. */
export function isLowValueChunk(chunk: string): boolean {
  const sentences = chunk.split(/(?<=[.!?])\s+/).filter((s) => wordCount(s) >= 8);
  return sentences.length < 2;
}
