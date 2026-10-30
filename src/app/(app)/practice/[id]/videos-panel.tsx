"use client";

import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Video = { id: string; title: string; channel: string; thumbnail: string; url: string };

type Props = {
  questionId: string;
  // "wrong" loads by itself. "correct_click" waits for the user to ask.
  trigger: "wrong" | "correct_click";
};

async function requestVideos(questionId: string): Promise<Video[]> {
  const res = await fetch(`/api/videos?questionId=${questionId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Could not load videos");
  return body.videos;
}

export function VideosPanel({ questionId, trigger }: Props) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [loading, setLoading] = useState(trigger === "wrong");
  const [error, setError] = useState("");

  // State is only set inside promise callbacks, never directly in the effect body.
  const run = useCallback(() => {
    requestVideos(questionId)
      .then(setVideos)
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => setLoading(false));
  }, [questionId]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    run();
  }, [run]);

  useEffect(() => {
    if (trigger === "wrong") run();
  }, [trigger, run]);

  function trackClick(videoId: string) {
    void fetch("/api/videos/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, videoId, trigger }),
    });
  }

  // Nothing clearly relevant was found: show nothing instead of a weak guess.
  if (trigger === "wrong" && videos && videos.length === 0) return null;

  if (trigger === "correct_click" && !videos && !loading && !error) {
    return (
      <Button variant="outline" className="h-9 self-start px-4" onClick={load}>
        <Play data-icon="inline-start" />
        Watch a video on this topic
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {trigger === "wrong" ? "Watch to understand this topic" : "More on this topic"}
      </h2>
      {loading && <p className="text-sm text-muted-foreground">Finding videos...</p>}
      {error && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {videos && videos.length === 0 && <p className="text-sm text-muted-foreground">No relevant video found for this topic.</p>}
      {videos && videos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {videos.map((v) => (
            <li key={v.id}>
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick(v.id)}
                className="flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail} alt="" width={96} height={54} className="rounded-lg" />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{v.title}</span>
                  <span className="text-xs text-muted-foreground">{v.channel}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
