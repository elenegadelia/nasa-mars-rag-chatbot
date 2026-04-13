/**
 * Shared constants for the RAG pipeline.
 * Change values here to tune behaviour across the whole app.
 */

export const config = {
  embedding: {
    // Model run locally via @xenova/transformers — no API cost.
    model: "Xenova/all-MiniLM-L6-v2",
    // Must match the vector(384) column in Supabase.
    dimension: 384,
  },

  retrieval: {
    // Number of chunks returned by the vector similarity search.
    topK: 5,
    // Cosine similarity threshold — chunks below this score are discarded.
    // all-MiniLM-L6-v2 typically scores relevant chunks between 0.2–0.5.
    similarityThreshold: 0.2,
  },

  chunking: {
    // Target chunk size in approximate tokens (~4 chars per token).
    chunkSize: 500,
    // Overlap between consecutive chunks to preserve context at boundaries.
    chunkOverlap: 50,
  },
} as const;
