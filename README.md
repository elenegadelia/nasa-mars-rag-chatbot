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

## Planned Architecture

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
│   │   └── chat/          # Streaming chat API route (Step 4)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # Chat UI page (Step 4)
├── components/            # Reusable UI components (Step 4)
├── lib/
│   ├── supabase/
│   │   └── client.ts      # Supabase client singleton (Step 3)
│   └── rag/
│       ├── chunker.ts     # PDF chunking logic (Step 2)
│       ├── embedder.ts    # Local embedding via transformers (Step 2)
│       └── retriever.ts   # pgvector similarity search (Step 3)
├── scripts/
│   └── ingest.ts          # One-time PDF ingestion script (Step 2)
├── data/                  # NASA PDF files (not committed — add manually)
├── .env.local.example     # All required env vars documented here
├── README.md
└── package.json
```

---

## Setup (High-Level Steps)

1. **Clone the repo** and run `npm install`
2. **Copy** `.env.local.example` → `.env.local` and fill in your keys
3. **Set up Supabase**: create a project, enable pgvector, run the schema migration
4. **Add PDFs** to `data/` (NASA Mars documents)
5. **Run ingestion**: `npx ts-node scripts/ingest.ts`
6. **Start the app**: `npm run dev`

---

## Free Tier Notes

- **Supabase**: free tier includes 500 MB database, pgvector enabled by default
- **OpenRouter**: free tier with rate limits; models like `mistralai/mistral-7b-instruct` are free
- **Embeddings**: fully local via `@xenova/transformers` — no API calls, no cost
- **Vercel**: free hobby tier for Next.js deployment

---

## Evaluation

RAG quality is tested using a lightweight offline approach:
- Manual golden Q&A pairs from the NASA documents
- Retrieval hit-rate check (does the right chunk appear in top-k results?)
- Answer faithfulness review against source chunks (manual + LLM-as-judge)
