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

// Fail fast instead of waiting minutes when a provider is busy.
export const limits = () => ({
  maxRetries: 1,
  abortSignal: AbortSignal.timeout(30_000),
});

export interface AIProvider {
  readonly name: string;
  generate(prompt: string, system?: string): Promise<AIResult>;
  check(prompt: string, system?: string): Promise<AIResult>;
  vision(input: VisionInput): Promise<AIResult>;
}
