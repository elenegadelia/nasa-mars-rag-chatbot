/**
 * RAG retriever — embeds a query and fetches the most relevant chunks
 * from Supabase using the match_documents pgvector function.
 *
 * Uses the same local embedding model as ingestion so query vectors
 * are in the same space as the stored document vectors.
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

/**
 * Embed the query, run a vector similarity search, and return the top-k chunks.
 *
 * @param query   The user's question (plain text)
 * @param topK    How many chunks to return (defaults to config.retrieval.topK)
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

  return (data ?? []) as RetrievedChunk[];
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
