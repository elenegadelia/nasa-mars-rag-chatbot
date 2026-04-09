/**
 * Supabase client for browser use.
 *
 * Uses the ANON key — safe to expose publicly. Access is governed by
 * Supabase Row Level Security policies.
 *
 * In this app, most queries run server-side. This client is here for
 * any future client-side Supabase needs (e.g. auth, real-time).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
