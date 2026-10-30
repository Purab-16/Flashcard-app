import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { limits } from "./provider";
import type { AIKind, AIProvider, AIResult } from "./provider";

export function createGroqProvider(): AIProvider {
  const apiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL;
  if (!apiKey || !modelName) {
    throw new Error("GROQ_API_KEY and GROQ_MODEL must be set");
  }

  const groq = createGroq({ apiKey });

  const run = async (
    kind: AIKind,
    prompt: string,
    system?: string,
  ): Promise<AIResult> => {
    const r = await generateText({
      model: groq(modelName),
      system,
      prompt,
      ...limits(),
      // gpt-oss models think before they answer. Low effort keeps the answer fast and complete.
      ...(modelName.includes("gpt-oss") ? { providerOptions: { groq: { reasoningEffort: "low" as const } } } : {}),
    });
    return {
      text: r.text,
      usage: {
        provider: "groq",
        model: modelName,
        kind,
        tokensIn: r.usage.inputTokens ?? null,
        tokensOut: r.usage.outputTokens ?? null,
      },
    };
  };

  return {
    name: "groq",
    generate: (prompt, system) => run("generate", prompt, system),
    check: (prompt, system) => run("check", prompt, system),
    async vision() {
      throw new Error("Vision is not supported by the groq provider");
    },
  };
}
