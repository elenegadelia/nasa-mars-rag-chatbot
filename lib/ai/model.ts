/**
 * OpenRouter LLM configuration via Vercel AI SDK.
 *
 * OpenRouter is OpenAI API-compatible, so we use @ai-sdk/openai with a
 * custom baseURL. This lets us access free-tier models (Mistral, LLaMA, etc.)
 * without changing any downstream streaming code.
 *
 * The client is created lazily on first call — not at module load — so that
 * env validation only fires when a request actually arrives, not at build time.
 *
 * Usage in an API route:
 *   import { getModel } from "@/lib/ai/model";
 *   const result = streamText({ model: getModel(), messages });
 */

import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

let openrouter: ReturnType<typeof createOpenAI> | null = null;

function getOpenRouter() {
  if (!openrouter) {
    openrouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.openrouterApiKey,
    });
  }
  return openrouter;
}

/**
 * Returns a Vercel AI SDK model instance pointed at OpenRouter.
 * Pass a model ID to override the default set in OPENROUTER_MODEL.
 */
export function getModel(modelId?: string) {
  return getOpenRouter()(modelId ?? env.openrouterModel);
}
