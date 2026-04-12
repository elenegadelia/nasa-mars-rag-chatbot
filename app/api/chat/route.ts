/**
 * POST /api/chat
 *
 * Streaming chat endpoint using Vercel AI SDK + OpenRouter.
 * RAG flow:
 *   1. Extract the latest user message
 *   2. Embed it locally (384-dim)
 *   3. Retrieve top-k relevant chunks from Supabase pgvector
 *   4. Build a grounded system prompt with retrieved context
 *   5. Stream the LLM response back to the client
 *
 * All API keys are server-only — never sent to the client.
 */

import { streamText, UIMessage, convertToModelMessages } from "ai";
import { getModel } from "@/lib/ai/model";
import { retrieveChunks, formatContextForPrompt } from "@/lib/rag/retriever";

// Allow the streaming response to run up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Extract the latest user message text for retrieval
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  const queryText = lastUserMessage?.parts
    ?.filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join(" ")
    .trim();

  if (!queryText) {
    return new Response("No user message found", { status: 400 });
  }

  // Retrieve relevant chunks from Supabase
  let chunks;
  try {
    chunks = await retrieveChunks(queryText);
  } catch (err) {
    console.error("[chat] Retrieval error:", err);
    return new Response("Retrieval failed. Check server logs.", { status: 500 });
  }

  // Log retrieval results for development visibility (no secrets exposed)
  console.log(
    `[chat] Retrieved ${chunks.length} chunk(s) for query: "${queryText.slice(0, 80)}"`
  );
  if (chunks.length > 0) {
    chunks.forEach((c, i) => {
      console.log(
        `  [${i + 1}] ${c.metadata.source_file} p.${c.metadata.page_number} ` +
          `(similarity: ${c.similarity.toFixed(3)}, type: ${c.metadata.chunk_type})`
      );
    });
  }

  const context = formatContextForPrompt(chunks);

  // Build the grounded system prompt
  const systemPrompt = `You are a knowledgeable assistant specializing in NASA's Mars exploration program.

You must answer questions ONLY using the context passages provided below.
Each passage is prefixed with its source: [number] filename, page N.

Rules:
- Base every claim on the provided context. Do not add information from memory.
- When you use information from a passage, cite its number inline, e.g. [1] or [2].
- If the provided context does not contain enough information to answer the question, say clearly: "I don't have enough context in the retrieved documents to answer that question."
- Do not speculate or present unsupported claims as facts.
- Keep answers concise and informative.
- End your response with a "Sources:" section listing the passages you cited, formatted as:
    Sources:
    [1] filename — page N
    [2] filename — page N

--- CONTEXT ---
${context}
--- END CONTEXT ---`;

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
