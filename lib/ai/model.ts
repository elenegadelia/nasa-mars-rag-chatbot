/**
 * Groq LLM configuration via Vercel AI SDK.
 *
 * Groq provides fast, free inference for open-source models (LLaMA, Gemma, etc.)
 * with no credit card required on the free tier.
 *
 * The client is created lazily on first call so env validation only fires
 * when a request arrives, not at build time.
 *
 * Usage in an API route:
 *   import { getModel } from "@/lib/ai/model";
 *   const result = streamText({ model: getModel(), messages });
 */

import { createGroq } from "@ai-sdk/groq";
import { env } from "@/lib/env";

let groq: ReturnType<typeof createGroq> | null = null;

function getGroq() {
  if (!groq) {
    groq = createGroq({ apiKey: env.groqApiKey });
  }
  return groq;
}

/**
 * Returns a Vercel AI SDK model instance pointed at Groq.
 * Pass a model ID to override the default set in GROQ_MODEL.
 */
export function getModel(modelId?: string) {
  return getGroq()(modelId ?? env.groqModel);
}
