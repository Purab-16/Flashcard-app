import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
} as const;

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

export const ALLOWED_MIMES: string[] = [...Object.values(MIME), ...IMAGE_MIMES];

export type ParsedDocument = { text: string; pageCount: number | null };

export function isImage(mime: string) {
  return (IMAGE_MIMES as readonly string[]).includes(mime);
}

/** Extract text from a text-based file. Images go through vision OCR instead. */
export async function parseTextFile(data: Uint8Array, mime: string): Promise<ParsedDocument> {
  if (mime === MIME.pdf) {
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      return { text: result.text, pageCount: result.total ?? null };
    } finally {
      await parser.destroy();
    }
  }

  if (mime === MIME.docx) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return { text: result.value, pageCount: null };
  }

  if (mime === MIME.txt) {
    return { text: new TextDecoder("utf-8").decode(data), pageCount: null };
  }

  throw new Error(`Unsupported file type: ${mime}`);
}
