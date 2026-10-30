// A running mock test lives in sessionStorage, so a reload keeps the questions, the answers and the timer.
// Questions of a test are not stored in the database, so a test cannot be resumed from another browser tab session.

export type MockQuestion = {
  id: string;
  type: "mcq" | "short" | "long";
  difficulty: string;
  topic: string | null;
  prompt: string;
  options: { key: string; text: string }[] | null;
  max_score: number;
};

export type MockData = {
  questions: MockQuestion[];
  endsAt: number;
  answers: Record<string, string>;
};

const listeners = new Set<() => void>();
const keyOf = (id: string) => `mock:${id}`;

export function subscribeMock(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function readMockRaw(id: string): string | null {
  try {
    return sessionStorage.getItem(keyOf(id));
  } catch {
    return null;
  }
}

export function saveMock(id: string, data: MockData) {
  try {
    sessionStorage.setItem(keyOf(id), JSON.stringify(data));
  } catch {
    // Storage is blocked. The test still runs for this page, but a reload will lose it.
  }
  listeners.forEach((l) => l());
}

export function clearMock(id: string) {
  try {
    sessionStorage.removeItem(keyOf(id));
  } catch {
    // Nothing to clear.
  }
  listeners.forEach((l) => l());
}
