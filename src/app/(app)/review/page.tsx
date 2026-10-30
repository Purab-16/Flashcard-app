import { PracticeClient } from "../practice/[id]/practice-client";

// Spaced repetition queue. Questions come from /api/review/questions; the id and level are not used.
export default function ReviewPage() {
  return <PracticeClient documentId="review" scope="review" type="mcq" difficulty="medium" />;
}
