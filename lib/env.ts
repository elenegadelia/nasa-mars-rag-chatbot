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
  // Public URL duplicated here for convenience in server-side code.
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },

  // Service role key bypasses Row Level Security — server/script use only.
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },

  // ── OpenRouter ────────────────────────────────────────────────────────────
  get openrouterApiKey() {
    return requireEnv("OPENROUTER_API_KEY");
  },

  // Falls back to a known free model if not set.
  get openrouterModel() {
    return process.env.OPENROUTER_MODEL ?? "mistralai/mistral-7b-instruct:free";
  },

  // ── Ingestion ─────────────────────────────────────────────────────────────
  // Directory where NASA PDF files are stored. Used only by scripts/ingest.ts.
  get nasaPdfDir() {
    return process.env.NASA_PDF_DIR ?? "./data";
  },
};
