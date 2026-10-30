import { NextResponse } from "next/server";
import { withFallback } from "@/lib/ai";
import { logUsage } from "@/lib/ai/usage";
import { chunkText } from "@/lib/parse/chunk";
import { LIMIT_MESSAGE, usageToday } from "@/lib/limits";
import { MIME, isImage, parseTextFile } from "@/lib/parse";
import { MAX_OCR_PAGES, looksScanned, mapLimit, renderPdfPages } from "@/lib/parse/ocr";
import { createClient } from "@/lib/supabase/server";

const OCR_PROMPT =
  "Transcribe all text in this image exactly as written. Keep headings and paragraphs. Reply with the text only.";

// Reading scanned pages with AI can take a while.
export const maxDuration = 60;

const OCR_PARALLEL = 4;

// Downloads the stored file, extracts text, splits it into chunks and saves them.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, storage_path, mime_type, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (docError) return NextResponse.json({ error: docError.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status === "chunked") return NextResponse.json({ status: "chunked" });

  const fail = async (message: string, status = 422) => {
    await supabase.from("documents").update({ status: "failed", error: message }).eq("id", id);
    return NextResponse.json({ error: message }, { status });
  };

  const { data: file, error: downloadError } = await supabase.storage
    .from("documents")
    .download(doc.storage_path);
  if (downloadError || !file) return fail("Could not read the uploaded file", 500);

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  let pageCount: number | null = null;
  let scanNote: string | null = null;
  try {
    if (isImage(doc.mime_type)) {
      const { result } = await withFallback(async (provider) => ({
        result: await provider.vision({ prompt: OCR_PROMPT, image: bytes, mediaType: doc.mime_type }),
      }));
      text = result.text;
      await logUsage(supabase, user.id, result.usage);
    } else {
      const parsed = await parseTextFile(bytes, doc.mime_type);
      text = parsed.text;
      pageCount = parsed.pageCount;

      // A PDF with almost no text is a scan: read its pages with the vision model, one AI call per page.
      if (doc.mime_type === MIME.pdf && looksScanned(text)) {
        const pages = Math.min(pageCount ?? MAX_OCR_PAGES, MAX_OCR_PAGES);
        const { remaining } = await usageToday(supabase, user.id);
        if (remaining < pages) {
          return fail(
            `${LIMIT_MESSAGE} Reading this scanned PDF needs ${pages} AI calls and ${remaining} are left.`,
            429,
          );
        }

        const images = await renderPdfPages(bytes, pages);
        const read = await mapLimit(images, OCR_PARALLEL, async (page) => {
          const { result } = await withFallback(async (provider) => ({
            result: await provider.vision({ prompt: OCR_PROMPT, image: page.image, mediaType: "image/png" }),
          }));
          await logUsage(supabase, user.id, result.usage);
          return result.text;
        });
        text = read.join("\n\n");
        if (pageCount && pageCount > MAX_OCR_PAGES) {
          scanNote = `Scanned PDF: only the first ${MAX_OCR_PAGES} of ${pageCount} pages were read.`;
        }
      }
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not read text from the file");
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return fail("No text found in this file.");
  }

  const { error: chunkError } = await supabase.from("chunks").upsert(
    chunks.map((c) => ({
      user_id: user.id,
      document_id: id,
      idx: c.idx,
      topic: c.topic,
      content: c.content,
      word_count: c.wordCount,
    })),
    { onConflict: "document_id,idx" },
  );
  if (chunkError) return fail(chunkError.message, 500);

  await supabase
    .from("documents")
    .update({ status: "chunked", page_count: pageCount, error: scanNote })
    .eq("id", id);

  return NextResponse.json({ status: "chunked", chunks: chunks.length });
}
