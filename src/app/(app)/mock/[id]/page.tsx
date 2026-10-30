import { Suspense } from "react";
import { MockClient } from "./mock-client";

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MockClient sessionId={id} />;
}

export default function MockTestPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-4 sm:p-8 text-sm text-muted-foreground">Loading...</p>}>
      <Loader params={props.params} />
    </Suspense>
  );
}
