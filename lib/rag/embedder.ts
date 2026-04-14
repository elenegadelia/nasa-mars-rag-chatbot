/**
 * Text embedder using the Hugging Face Inference API.
 *
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
 * This is the same model previously run locally — stored vectors in Supabase
 * are fully compatible, no re-ingestion needed.
 *
 * Using the HF API makes the embedder compatible with Vercel serverless
 * functions, which cannot run native binaries like ONNX Runtime.
 *
 * Free tier: 1000 requests/day on HuggingFace Inference API.
 *
 * For local ingestion, @xenova/transformers is still available in devDependencies.
 * Run ingestion locally with: npm run ingest
 */

import { env } from "@/lib/env";
import { config } from "@/lib/config";

const HF_API_URL =
  "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";

/**
 * Call the HuggingFace Inference API to embed one or more strings.
 * Returns a 2D array: one 384-dim vector per input string.
 */
async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.huggingfaceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: true }, // wait if model is cold-starting
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error (${response.status}): ${error}`);
  }

  const result = await response.json();

  // HF returns either number[][] directly, or wraps single input in number[]
  if (Array.isArray(result[0]?.[0])) {
    return result as number[][];
  }
  // Single input returns a flat number[] — wrap it
  return [result as number[]];
}

/**
 * Embed a single string. Returns a plain number[] (length 384).
 */
export async function embedText(text: string): Promise<number[]> {
  const embeddings = await fetchEmbeddings([text]);
  const vec = embeddings[0];
  if (vec.length !== config.embedding.dimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${config.embedding.dimension}, got ${vec.length}`
    );
  }
  return vec;
}

/**
 * Embed multiple strings. Returns one 384-dim vector per input.
 * HuggingFace processes the batch in a single API call.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return fetchEmbeddings(texts);
}
