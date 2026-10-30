import { z } from "zod";
import { withFallback, type AIUsage } from "@/lib/ai";
import { parseJsonReply } from "@/lib/ai/json";
import { createAdminClient } from "@/lib/supabase/admin";

export type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
};

const CACHE_DAYS = 30;
const MAX_RESULTS = 15;
const KEEP = 4;
const MIN_SECONDS = 120; // skip shorts and trailers
const MAX_SECONDS = 90 * 60; // skip very long streams

export const topicKey = (topic: string) => topic.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);

// ISO 8601 duration like PT1H2M3S to seconds.
function seconds(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function searchYouTube(query: string): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube is not configured");

  const search = new URL("https://www.googleapis.com/youtube/v3/search");
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("q", query);
  search.searchParams.set("maxResults", String(MAX_RESULTS));
  search.searchParams.set("videoEmbeddable", "true");
  search.searchParams.set("safeSearch", "strict");
  search.searchParams.set("key", apiKey);

  const found = await fetch(search, { signal: AbortSignal.timeout(10_000) });
  if (!found.ok) throw new Error(`YouTube search failed (${found.status})`);
  const items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } } }[] =
    (await found.json()).items ?? [];
  if (!items.length) return [];

  // Second call (1 quota unit) to read the length of each video, so shorts can be dropped.
  const details = new URL("https://www.googleapis.com/youtube/v3/videos");
  details.searchParams.set("part", "contentDetails");
  details.searchParams.set("id", items.map((i) => i.id.videoId).join(","));
  details.searchParams.set("key", apiKey);
  const detailRes = await fetch(details, { signal: AbortSignal.timeout(10_000) });
  const lengths = new Map<string, number>();
  if (detailRes.ok) {
    for (const v of (await detailRes.json()).items ?? []) lengths.set(v.id, seconds(v.contentDetails.duration));
  }

  return items
    .filter((i) => {
      const s = lengths.get(i.id.videoId);
      return s === undefined || (s >= MIN_SECONDS && s <= MAX_SECONDS);
    })
    .map((i) => ({
      id: i.id.videoId,
      title: i.snippet.title,
      channel: i.snippet.channelTitle,
      thumbnail: i.snippet.thumbnails.medium?.url ?? "",
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
    }));
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "how", "what", "why", "its",
  "into", "about", "using", "use", "used", "between", "types", "type", "introduction", "overview", "basic", "basics",
]);

const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

/** Cheap first filter: the title must share enough words with the topic. */
function titleMatchesTopic(title: string, topic: string): boolean {
  const wanted = tokens(topic);
  if (wanted.length === 0) return true;
  const have = tokens(title);
  const hit = (w: string) => have.some((h) => h.startsWith(w.slice(0, 5)) || w.startsWith(h.slice(0, 5)));
  const matched = wanted.filter(hit).length;
  return matched >= Math.ceil(wanted.length / 2);
}

const judgeReply = z.object({ relevant: z.array(z.string()) });

/** Ask the AI which candidates really teach this topic. Anything unsure is dropped. */
async function judgeRelevance(
  candidates: Video[],
  ctx: VideoContext,
): Promise<{ ids: Set<string>; usage: AIUsage }> {
  const list = candidates.map((v) => `${v.id} | ${v.title} | ${v.channel}`).join("\n");
  const prompt = [
    "A student is studying and got a question wrong or right on this topic. Pick YouTube videos that clearly teach exactly this topic.",
    `Topic: ${ctx.topic}`,
    ctx.docTitle ? `Study material: ${ctx.docTitle}` : "",
    ctx.question ? `Question they were asked: ${ctx.question}` : "",
    "",
    "Candidates (id | title | channel):",
    list,
    "",
    "Rules:",
    "- Keep a video only if its title clearly shows it explains this topic in an educational way.",
    "- Drop anything about a different meaning of the same word, music, vlogs, news, reactions, ads, product reviews, or a much broader or narrower subject.",
    "- If you are not sure, drop it. Returning an empty list is fine.",
    'Reply with JSON only: {"relevant": ["videoId", ...]}',
  ]
    .filter(Boolean)
    .join("\n");

  const { parsed, usage } = await withFallback(async (provider) => {
    const result = await provider.generate(prompt, "You are a strict judge of educational video relevance. Reply with JSON only.");
    return { parsed: parseJsonReply(result.text, judgeReply), usage: result.usage };
  });
  const known = new Set(candidates.map((c) => c.id));
  return { ids: new Set(parsed.relevant.filter((id) => known.has(id))), usage };
}

export type VideoContext = { topic: string; docTitle?: string | null; question?: string | null };

/**
 * Videos for a topic that are clearly relevant, or an empty list.
 * Shared cache in `video_cache` (service role), so one search serves every user.
 * `usage` is set when an AI call was made, so the caller can log it.
 */
export async function getVideos(ctx: VideoContext, aiAllowed = true): Promise<{ videos: Video[]; usage: AIUsage | null }> {
  const key = topicKey(`${ctx.docTitle ?? ""} | ${ctx.topic}`);
  const admin = createAdminClient();

  const { data: cached } = await admin
    .from("video_cache")
    .select("results, fetched_at")
    .eq("topic_key", key)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86_400_000) {
    return { videos: cached.results as Video[], usage: null };
  }

  // A cache miss needs a search and an AI judge. Over the daily limit, show nothing instead.
  if (!aiAllowed) return { videos: [], usage: null };

  const query = `${ctx.topic} explained`;
  const found = (await searchYouTube(query)).filter((v) => titleMatchesTopic(v.title, ctx.topic));
  if (!found.length) return { videos: [], usage: null };

  // If the judge fails, recommend nothing. A wrong video is worse than no video.
  const { ids, usage } = await judgeRelevance(found, ctx);
  const videos = found.filter((v) => ids.has(v.id)).slice(0, KEEP);

  if (videos.length) {
    await admin
      .from("video_cache")
      .upsert({ topic_key: key, query, results: videos, fetched_at: new Date().toISOString() }, { onConflict: "topic_key" });
  }
  return { videos, usage };
}
