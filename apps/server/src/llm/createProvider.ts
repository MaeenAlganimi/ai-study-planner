import { GeminiProvider } from "./geminiProvider";
import { MockLlmProvider } from "./mockProvider";
import type { LlmProvider } from "./types";

export function createLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const mode = (env.LLM_PROVIDER ?? "auto").trim().toLowerCase();
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (mode === "mock") return new MockLlmProvider();

  if (mode === "gemini" || (mode === "auto" && apiKey)) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini.");
    }
    return new GeminiProvider({
      apiKey,
      model: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    });
  }

  return new MockLlmProvider();
}
