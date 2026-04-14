/**
 * RAG retriever — embeds a query and fetches the most relevant chunks
 * from Supabase using the match_documents pgvector function.
 *
 * Two-stage relevance filtering:
 *   Stage 1 (Supabase): returns up to topK chunks above similarityThreshold (0.2).
 *   Stage 2 (in-process): keeps only chunks above RELEVANCE_THRESHOLD (0.3),
 *                         capped at MAX_CHUNKS. This removes weakly related
 *                         chunks that passed the loose Supabase filter.
 */

import { embedText } from "@/lib/rag/embedder";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";

export interface RetrievedChunk {
  content: string;
  similarity: number;
  metadata: {
    source_file: string;
    document_title: string;
    page_number: number;
    chunk_index: number;
    chunk_type: string;
    section_title: string | null;
    token_estimate: number;
    ingested_at: string;
  };
}

// Stage-2 filter: only chunks above this score are sent to the LLM.
// Raises the bar above the loose Supabase threshold (0.2) to cut noise.
const RELEVANCE_THRESHOLD = 0.3;

// Maximum chunks passed to the LLM after filtering.
const MAX_CHUNKS = 3;

/**
 * Embed the query, run a vector similarity search, apply a secondary
 * relevance filter, and return the top chunks.
 *
 * Returns an empty array if no chunks survive the relevance filter.
 *
 * @param query   The user's question (plain text)
 * @param topK    Initial fetch size from Supabase (defaults to config.retrieval.topK)
 */
export async function retrieveChunks(
  query: string,
  topK: number = config.retrieval.topK
): Promise<RetrievedChunk[]> {
  // 1. Embed the query with the same model used during ingestion
  const queryEmbedding = await embedText(query);

  // 2. Call the pgvector match_documents function in Supabase
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_threshold: config.retrieval.similarityThreshold,
    match_count: topK,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  const rawChunks = (data ?? []) as RetrievedChunk[];

  // 3. Stage-2 filter: remove weakly related chunks and cap at MAX_CHUNKS.
  //    Chunks are already ordered by similarity descending from Supabase.
  const filtered = rawChunks
    .filter((c) => c.similarity >= RELEVANCE_THRESHOLD)
    .slice(0, MAX_CHUNKS);

  return filtered;
}

/**
 * Format retrieved chunks into a readable context block for the LLM prompt.
 * Each chunk is prefixed with its source so the model can cite it.
 */
export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant context found.";

  return chunks
    .map((chunk, i) => {
      const source = `[${i + 1}] ${chunk.metadata.source_file}, page ${chunk.metadata.page_number}`;
      return `${source}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
