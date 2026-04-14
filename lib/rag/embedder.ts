/**
 * Text embedder using the Cohere Inference API.
 *
 * Model: embed-english-light-v3.0 (384-dim)
 * Same dimension as the previous all-MiniLM-L6-v2 model, so the
 * Supabase vector(384) column needs no schema change.
 *
 * IMPORTANT: After switching to Cohere you must re-ingest all PDFs,
 * because the two models produce incompatible vector spaces:
 *   DELETE FROM documents;   -- in Supabase SQL editor
 *   npm run ingest            -- re-embed locally
 *
 * Free tier: https://dashboard.cohere.com (no credit card required)
 *
 * Cohere uses different input types for indexing vs querying:
 *   embedBatch → "search_document"  (used during ingestion)
 *   embedText  → "search_query"     (used at query time)
 */

import { env } from "@/lib/env";
import { config } from "@/lib/config";

const COHERE_API_URL = "https://api.cohere.com/v2/embed";
const COHERE_MODEL = "embed-english-light-v3.0"; // 384-dim

type CohereInputType = "search_query" | "search_document";

/**
 * Call the Cohere Embed API to embed one or more strings.
 * Returns a 2D array: one 384-dim vector per input string.
 */
async function fetchEmbeddings(
  texts: string[],
  inputType: CohereInputType
): Promise<number[][]> {
  const response = await fetch(COHERE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.cohereApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: COHERE_MODEL,
      texts,
      input_type: inputType,
      embedding_types: ["float"],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cohere API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  return result.embeddings.float as number[][];
}

/**
 * Embed a single query string. Returns a plain number[] (length 384).
 */
export async function embedText(text: string): Promise<number[]> {
  const embeddings = await fetchEmbeddings([text], "search_query");
  const vec = embeddings[0];
  if (vec.length !== config.embedding.dimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${config.embedding.dimension}, got ${vec.length}`
    );
  }
  return vec;
}

/**
 * Embed multiple document strings. Returns one 384-dim vector per input.
 * Used during ingestion — Cohere processes the batch in a single API call.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return fetchEmbeddings(texts, "search_document");
}
