// Three cards leaning on each other. The top one carries the highlighter swipe, the app's signature.
export function CardStack({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-32 w-44 shrink-0 ${className}`} aria-hidden>
      <div className="stack-card absolute top-3 left-6 h-24 w-32 -rotate-6 rounded-xl opacity-60" />
      <div className="stack-card absolute top-1.5 left-3 h-24 w-32 rotate-3 rounded-xl opacity-80" />
      <div className="stack-card absolute top-0 left-0 flex h-24 w-32 -rotate-2 flex-col justify-center gap-2 rounded-xl px-4">
        <span className="swipe block h-3 w-24 rounded-sm" />
        <span className="block h-2 w-20 rounded-full bg-muted" />
        <span className="block h-2 w-14 rounded-full bg-muted" />
      </div>
    </div>
  );
}
