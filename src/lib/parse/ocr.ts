import { PDFParse } from "pdf-parse";

// Scanned PDFs have pictures of pages, not text. Each page becomes an image that the vision model reads.
// One page is one AI call, so the number of pages is capped.
export const MAX_OCR_PAGES = 20;

const MIN_TEXT_CHARS = 100;

/** True when a PDF gave almost no text, which means its pages are pictures. */
export function looksScanned(text: string): boolean {
  return text.replace(/\s/g, "").length < MIN_TEXT_CHARS;
}

export type PageImage = { pageNumber: number; image: Uint8Array };

/** Render the first pages of a PDF to PNG images. */
export async function renderPdfPages(data: Uint8Array, maxPages = MAX_OCR_PAGES): Promise<PageImage[]> {
  const parser = new PDFParse({ data });
  try {
    const shots = await parser.getScreenshot({ first: maxPages, scale: 1.5, imageDataUrl: false, imageBuffer: true });
    return shots.pages.map((p) => ({ pageNumber: p.pageNumber, image: p.data }));
  } finally {
    await parser.destroy();
  }
}

/** Run `fn` over the items with at most `limit` running at once. Results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
