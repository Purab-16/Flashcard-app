// Smoke test: one Gemini call. Run: node --env-file=.env scripts/gemini-smoke.mjs
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL;
if (!apiKey || !modelName) {
  console.error("GEMINI_API_KEY and GEMINI_MODEL must be set in .env");
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
const result = await generateText({
  model: google(modelName),
  prompt: "Reply with exactly one word: ready",
  maxRetries: 0,
  abortSignal: AbortSignal.timeout(40_000),
});

console.log("model:", modelName);
console.log("reply:", result.text.trim());
console.log("tokens in/out:", result.usage.inputTokens, result.usage.outputTokens);
