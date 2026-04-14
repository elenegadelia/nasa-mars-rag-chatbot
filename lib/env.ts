/**
 * Typed environment variables with lazy validation.
 *
 * Properties use getters so validation fires on first access, not at import
 * time. This lets Node.js scripts load dotenv before any env var is read,
 * regardless of how the module bundler orders require() calls.
 *
 * IMPORTANT: This file accesses server-only secrets.
 * Import it only in server components, API routes, or Node scripts — never
 * in client components.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: "${name}"\n` +
        `Copy .env.local.example to .env.local and fill in all values.`
    );
  }
  return value;
}

export const env = {
  // ── Supabase ──────────────────────────────────────────────────────────────
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },

  // Service role key bypasses Row Level Security — server/script use only.
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  get groqApiKey() {
    return requireEnv("GROQ_API_KEY");
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  // Used at query time to embed the user's question (embed-english-light-v3.0).
  get cohereApiKey() {
    return requireEnv("COHERE_API_KEY");
  },

  // Free, fast model on Groq. Override via GROQ_MODEL in .env.local.
  get groqModel() {
    return process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  },

  // ── Ingestion ─────────────────────────────────────────────────────────────
  // Directory where NASA PDF files are stored. Used only by scripts/ingest.ts.
  get nasaPdfDir() {
    return process.env.NASA_PDF_DIR ?? "./data/raw";
  },
};
