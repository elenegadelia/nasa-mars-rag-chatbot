/**
 * Local text embedder using @xenova/transformers.
 *
 * Model: all-MiniLM-L6-v2 (384-dim) — runs entirely locally, no API cost.
 * On first use, the model (~23 MB quantized) is downloaded and cached.
 * Subsequent runs reuse the cache.
 *
 * Compatible with the vector(384) column in Supabase.
 * Reusable for both ingestion (scripts/ingest.ts) and query embedding (API route).
 */

import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { config } from "@/lib/config";

// Singleton — avoid reloading the model on every call
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    console.log(`Loading embedding model: ${config.embedding.model} ...`);
    embedder = await pipeline("feature-extraction", config.embedding.model, {
      quantized: true, // use quantized weights — faster load, ~same quality
    });
    console.log("Embedding model ready.");
  }
  return embedder;
}

/**
 * Embed a single string. Returns a plain number[] (length 384).
 */
export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple strings in one model call.
 * Returns an array of embeddings, one per input string, each length 384.
 *
 * Prefer this over calling embedText() in a loop — it's faster for large batches.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await getEmbedder();
  const output = await model(texts, { pooling: "mean", normalize: true });

  // output.data is a flat Float32Array of shape [batch_size × dimension]
  const dim = config.embedding.dimension;
  const flat = Array.from(output.data as Float32Array);

  return texts.map((_, i) => flat.slice(i * dim, (i + 1) * dim));
}
