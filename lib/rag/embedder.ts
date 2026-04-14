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

// OpenAI-compatible embeddings endpoint on HuggingFace router
const HF_API_URL =
  "https://router.huggingface.co/hf-inference/v1/embeddings";

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";

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
      model: HF_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error (${response.status}): ${error}`);
  }

  // OpenAI-compatible response: { data: [{ embedding: number[], index: number }] }
  const result = await response.json();
  return result.data.map(
    (item: { embedding: number[]; index: number }) => item.embedding
  );
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
