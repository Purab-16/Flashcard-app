import Link from "next/link";
import { CardStack } from "@/components/shared/card-stack";

// An empty screen is an invitation to act, so it always offers the next step.
export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <CardStack className="scale-90" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {href && action && (
        <Link
          href={href}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/85 active:translate-y-px"
        >
          {action}
        </Link>
      )}
    </div>
  );
}
