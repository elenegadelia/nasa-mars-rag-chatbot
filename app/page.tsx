export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <div className="max-w-xl space-y-6">
        {/* Badge */}
        <span className="inline-block rounded-full bg-red-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-400">
          NASA · Mars · RAG
        </span>

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Mars Mission Chatbot
        </h1>

        {/* Description */}
        <p className="text-lg leading-relaxed text-zinc-400">
          Ask questions about NASA&apos;s Mars exploration program. This chatbot
          retrieves answers directly from official NASA Mars documents using
          retrieval-augmented generation (RAG).
        </p>

        {/* Status — honest about current build state */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-4 text-sm text-zinc-500">
          <span className="font-medium text-zinc-300">Status:</span> Setting up
          project foundation. Chat interface coming in a later step.
        </div>

        {/* Stack pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {["Next.js", "Vercel AI SDK", "Supabase pgvector", "OpenRouter"].map(
            (tech) => (
              <span
                key={tech}
                className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
              >
                {tech}
              </span>
            )
          )}
        </div>
      </div>
    </main>
  );
}
