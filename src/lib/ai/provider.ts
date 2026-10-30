export type AIKind = "generate" | "check" | "vision";

export type AIUsage = {
  provider: string;
  model: string;
  kind: AIKind;
  tokensIn: number | null;
  tokensOut: number | null;
};

export type AIResult = {
  text: string;
  usage: AIUsage;
};

export type VisionInput = {
  prompt: string;
  image: Uint8Array;
  mediaType: string;
};

// Fail fast instead of waiting minutes when a provider is busy. 20 seconds each, so the main provider and the
// fallback together stay inside one serverless request.
// maxOutputTokens leaves room for a complete JSON answer. Without it a reasoning model can spend its budget on
// thinking and send back JSON that stops in the middle.
export const limits = () => ({
  maxRetries: 1,
  abortSignal: AbortSignal.timeout(20_000),
  maxOutputTokens: 4096,
});

export interface AIProvider {
  readonly name: string;
  generate(prompt: string, system?: string): Promise<AIResult>;
  check(prompt: string, system?: string): Promise<AIResult>;
  vision(input: VisionInput): Promise<AIResult>;
}
