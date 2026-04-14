/**
 * POST /api/chat
 *
 * Streaming chat endpoint using Vercel AI SDK + Groq.
 * RAG flow:
 *   1. Extract the latest user message
 *   2. Embed it via Cohere API (384-dim)
 *   3. Retrieve top-k chunks from Supabase pgvector
 *   4. Apply stage-2 relevance filter (similarity >= 0.3, max 3 chunks)
 *   5. If no chunks survive → return a plain fallback response, no LLM call
 *   6. Build a strict grounded system prompt with retrieved context
 *   7. Stream the LLM response back to the client
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

  // Retrieve and filter relevant chunks from Supabase
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

  // Hard fallback: no chunks survived relevance filtering → do not call the LLM.
  // Returning a plain Response avoids any risk of hallucination.
  if (chunks.length === 0) {
    console.log("[chat] No relevant chunks after filtering — returning fallback");

    // Wrap as a minimal AI SDK UI stream so the frontend handles it correctly
    const result = streamText({
      model: getModel(),
      system: "You are a helpful assistant. Reply with the user's message verbatim, nothing else.",
      messages: [
        {
          role: "user",
          content:
            "The provided documents do not contain relevant information for this question. " +
            "Please try rephrasing or ask something related to NASA Mars exploration.",
        },
      ],
    });
    return result.toUIMessageStreamResponse();
  }

  const context = formatContextForPrompt(chunks);

  // Build the strict grounded system prompt
  const systemPrompt = `You are a strict NASA Mars exploration assistant. Your ONLY knowledge source is the context passages provided below.

ABSOLUTE RULES — follow these without exception:
1. Answer ONLY using information explicitly stated in the passages below. Never use your training knowledge.
2. Cite EVERY claim inline using the passage number, e.g. [1] or [2].
3. Only cite a passage if it directly supports the specific claim you are making. Do NOT cite a passage just because it is vaguely related.
4. If the passages do not explicitly contain enough information to answer, respond with exactly: "The provided documents do not contain this information."
5. Do NOT speculate, infer, or add context beyond what the passages state.
6. You MUST end every answer with a "Sources:" block listing ONLY the passages you actually cited:
    Sources:
    [1] filename — page N
   If you cited no passages, use rule 4 instead of answering.

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
