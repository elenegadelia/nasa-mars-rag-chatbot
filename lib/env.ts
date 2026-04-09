/**
 * Typed environment variables with early validation.
 *
 * IMPORTANT: This file accesses server-only secrets (service role key, OpenRouter key).
 * Import it only in server components, API routes, or Node scripts — never in client components.
 *
 * Public variables (NEXT_PUBLIC_*) are safe to read anywhere via process.env directly.
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
  // Public URL is duplicated here for convenience in server-side code.
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),

  // Service role key bypasses Row Level Security — server/script use only.
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // ── OpenRouter ────────────────────────────────────────────────────────────
  openrouterApiKey: requireEnv("OPENROUTER_API_KEY"),

  // Falls back to a known free model if not set.
  openrouterModel:
    process.env.OPENROUTER_MODEL ?? "mistralai/mistral-7b-instruct:free",

  // ── Ingestion ─────────────────────────────────────────────────────────────
  // Directory where NASA PDF files are stored locally. Used only by scripts/ingest.ts.
  nasaPdfDir: process.env.NASA_PDF_DIR ?? "./data",
} as const;
