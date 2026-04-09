/**
 * Supabase client for server-side use (API routes, ingestion scripts).
 *
 * Uses the SERVICE ROLE key — this bypasses Row Level Security and has full
 * database access. Never expose this client or its key to the browser.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        // Server clients don't need session persistence.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}
