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
NASA Mars PDFs (local)
     │
     ▼
scripts/ingest.ts
     ├─► Parse PDF text (pdf-parse)
     ├─► Chunk text (sliding window, ~500 tokens, 50-token overlap)
     ├─► Embed each chunk (all-MiniLM-L6-v2 → vector[384])
     └─► Upsert into Supabase `documents` table
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

```bash
# Optional: set NASA_PDF_DIR in .env.local, or place PDFs in data/
npx tsx scripts/ingest.ts
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
