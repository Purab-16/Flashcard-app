import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { limits } from "./provider";
import type { AIKind, AIProvider, AIResult, VisionInput } from "./provider";

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) {
    throw new Error("GEMINI_API_KEY and GEMINI_MODEL must be set");
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const toResult = (
    kind: AIKind,
    r: Awaited<ReturnType<typeof generateText>>,
  ): AIResult => ({
    text: r.text,
    usage: {
      provider: "gemini",
      model: modelName,
      kind,
      tokensIn: r.usage.inputTokens ?? null,
      tokensOut: r.usage.outputTokens ?? null,
    },
  });

  const run = async (kind: AIKind, prompt: string, system?: string) =>
    toResult(kind, await generateText({ model: google(modelName), system, prompt, ...limits() }));

  return {
    name: "gemini",
    generate: (prompt, system) => run("generate", prompt, system),
    check: (prompt, system) => run("check", prompt, system),
    async vision({ prompt, image, mediaType }: VisionInput) {
      const r = await generateText({
        ...limits(),
        model: google(modelName),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image, mediaType },
            ],
          },
        ],
      });
      return toResult("vision", r);
    },
  };
}
