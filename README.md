# Mars Mission RAG Chatbot

A retrieval-augmented generation (RAG) chatbot that answers questions about NASA's Mars exploration program, grounded in official NASA PDF documents.

Built as a full-stack challenge project using entirely free tools.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React |
| UI styling | Tailwind CSS |
| Chat streaming | Vercel AI SDK (`ai`, `@ai-sdk/openai`) |
| Vector database | Supabase Postgres + pgvector |
| Embeddings | `@xenova/transformers` — `all-MiniLM-L6-v2` (local, free, 384-dim) |
| LLM generation | OpenRouter (free-tier models, e.g. Mistral, LLaMA) |
| PDF parsing | `pdf-parse` |
| Language | TypeScript |
| Deployment | Vercel (free tier) |

---

## Architecture

```
User question
     │
     ▼
[ Next.js API route /api/chat ]
     │
     ├─► Embed question (all-MiniLM-L6-v2, 384-dim)
     │
     ├─► Vector similarity search (Supabase pgvector)
     │       └─► Returns top-k relevant chunks + source metadata
     │
     ├─► Build prompt: system context + retrieved chunks + user question
     │
     └─► Stream response via OpenRouter LLM
             │
             ▼
      [ Chat UI — streamed answer with source citations ]
```

### Architecture decisions

**Local embeddings, cloud LLM**
Embeddings are generated locally using `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim). This keeps ingestion and retrieval completely free with no rate limits. LLM generation goes through OpenRouter, which provides access to capable free-tier models (Mistral 7B, LLaMA 3) without hosting costs.

**Two Supabase clients, two keys**
The service role key (server only) bypasses Row Level Security — used for ingestion and vector search in API routes. The anon key is safe for the browser. Keeping them separate means secrets never reach the client bundle.

---

## Data Flow (Ingestion — runs once)

```
NASA Mars PDFs (data/raw/)
     │
     ▼
scripts/ingest.ts
     ├─► Parse PDF page by page (pdf-parse + pagerender hook)
     ├─► Chunk each page semantically (lib/rag/chunker.ts)
     │       ├─ Split at blank-line boundaries → paragraph blocks
     │       ├─ Classify blocks: heading | list | paragraph
     │       ├─ Merge adjacent blocks greedily until size limit
     │       ├─ Headings flush buffer + start new chunk
     │       └─ Fallback: sentence-split for oversized blocks
     ├─► Embed chunks in batches (lib/rag/embedder.ts → vector[384])
     └─► Insert rows into Supabase `documents` table
```

### Chunking strategy in plain English

PDF text extraction loses all formatting. The chunker recovers structure by pattern-matching:

- **Paragraph boundaries**: blank lines in the extracted text separate logical blocks
- **Heading detection**: short lines (< 120 chars) with no terminal punctuation that don't start with articles/prepositions
- **List detection**: lines where ≥ 50% start with `-`, `•`, `1.`, `a)` etc.

**Merging rules:**
- A heading flushes whatever came before and starts a new chunk (the heading text is kept as the first line, so the content that follows it stays co-located with its heading)
- List and paragraph blocks merge greedily until the token limit (~500 tokens ≈ 2000 chars)
- If a merged block is still too large, sentence-boundary splitting is the fallback
- Pure fixed-size character splitting is never the primary strategy

**Why this matters for RAG:** headings and their content stay together → retrieved chunks are more self-contained and the model has structural context. List items don't split mid-item. Every chunk knows which section it came from via `section_title` in metadata.

### Chunk metadata shape

```json
{
  "source_file": "mars_2020_perseverance.pdf",
  "document_title": "Mars 2020 Perseverance",
  "page_number": 4,
  "chunk_index": 17,
  "chunk_type": "heading_section",
  "char_start": 142,
  "char_end": 891,
  "section_title": "Science Objectives",
  "token_estimate": 186,
  "ingested_at": "2026-04-10T09:30:00.000Z"
}
```

---

## Project Structure

```
nasa-mars-rag-chatbot/
├── app/
│   ├── api/
│   │   └── chat/          # Streaming chat API route
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # Chat UI
├── components/            # Reusable UI components
├── lib/
│   ├── ai/
│   │   └── model.ts       # OpenRouter model via Vercel AI SDK
│   ├── supabase/
│   │   ├── server.ts      # Service role client (server/scripts only)
│   │   └── client.ts      # Anon key client (browser-safe)
│   ├── rag/
│   │   ├── chunker.ts     # PDF chunking logic
│   │   ├── embedder.ts    # Local embedding via transformers
│   │   └── retriever.ts   # pgvector similarity search
│   ├── config.ts          # Shared constants (dim, topK, chunk params)
│   └── env.ts             # Typed env validation (server-side only)
├── scripts/
│   └── ingest.ts          # One-time PDF ingestion script
├── data/                  # NASA PDF files (not committed — add manually)
├── .env.local.example     # All required env vars documented here
├── README.md
└── package.json
```

---

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in each value:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API | Yes |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys | Yes |
| `OPENROUTER_MODEL` | See free models at openrouter.ai/models | No (defaults to Mistral 7B free) |
| `NASA_PDF_DIR` | Path to your local PDF folder | No (defaults to `./data`) |

**Important:** `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` are server-only secrets. They must never appear in client-side code or be prefixed with `NEXT_PUBLIC_`.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev                          # http://localhost:3000
```

---

## Ingestion (run once after Supabase schema is set up)

Place NASA PDF files in `data/raw/` (or the directory set in `NASA_PDF_DIR`).

```bash
# Preview chunks without writing to the database
npm run ingest:dry

# Full ingestion — parses, embeds, and inserts all PDFs
npm run ingest
```

On first run, the embedding model (~23 MB quantized) is downloaded and cached automatically.

**Verify in Supabase:** after ingestion, run this query in the Supabase SQL editor:

```sql
-- Check total chunks and per-file breakdown
SELECT
  metadata->>'source_file' AS file,
  COUNT(*)                  AS chunks,
  AVG((metadata->>'token_estimate')::int) AS avg_tokens
FROM documents
GROUP BY metadata->>'source_file'
ORDER BY file;
```

---

## Free Tier Notes

- **Supabase**: free tier includes 500 MB database, pgvector enabled by default
- **OpenRouter**: free tier with rate limits; models like `mistralai/mistral-7b-instruct:free` cost $0
- **Embeddings**: fully local via `@xenova/transformers` — no API calls, no cost, no rate limits
- **Vercel**: free hobby tier for Next.js deployment

---

## Evaluation

RAG quality is tested using a lightweight offline approach:
- Manual golden Q&A pairs written from the NASA documents
- Retrieval hit-rate check: does the correct chunk appear in the top-k results?
- Answer faithfulness review against source chunks (manual spot-check + LLM-as-judge)
