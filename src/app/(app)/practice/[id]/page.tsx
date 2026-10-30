import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PracticeClient } from "./practice-client";

const TYPES = ["mcq", "short", "long"] as const;
const LEVELS = ["easy", "medium", "hard"] as const;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; difficulty?: string; scope?: string }>;
};

async function Loader({ params, searchParams }: Props) {
  const { id } = await params;
  const { type, difficulty, scope } = await searchParams;

  if (!TYPES.includes(type as (typeof TYPES)[number])) notFound();
  if (!LEVELS.includes(difficulty as (typeof LEVELS)[number])) notFound();

  return (
    <PracticeClient
      documentId={id}
      scope={scope === "subject" ? "subject" : "document"}
      type={type as (typeof TYPES)[number]}
      difficulty={difficulty as (typeof LEVELS)[number]}
    />
  );
}

export default function PracticePage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4 sm:p-8 text-sm text-muted-foreground">Loading...</p>}>
      <Loader params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
