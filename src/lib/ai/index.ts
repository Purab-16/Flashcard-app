import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import type { AIProvider } from "./provider";

export type { AIProvider, AIResult, AIUsage } from "./provider";

function build(name: string): AIProvider {
  switch (name) {
    case "gemini":
      return createGeminiProvider();
    case "groq":
      return createGroqProvider();
    default:
      // ollama exists in the plan but is OFF in the MVP
      throw new Error(`Unsupported AI provider: ${name}`);
  }
}

export function getProvider(): AIProvider {
  return build(process.env.AI_PROVIDER ?? "gemini");
}

export function getFallbackProvider(): AIProvider | null {
  const name = process.env.AI_FALLBACK;
  if (!name || name === process.env.AI_PROVIDER) return null;
  try {
    return build(name);
  } catch {
    // Fallback is not configured (missing key or model). Run without it.
    return null;
  }
}

/** Run an AI call on the main provider. If it fails, retry once on the fallback. */
export async function withFallback<T>(fn: (provider: AIProvider) => Promise<T>): Promise<T> {
  try {
    return await fn(getProvider());
  } catch (primaryError) {
    const fallback = getFallbackProvider();
    if (!fallback) throw primaryError;
    try {
      return await fn(fallback);
    } catch (fallbackError) {
      throw new AggregateError(
        [primaryError, fallbackError],
        "Both the main and fallback AI providers failed",
      );
    }
  }
}
