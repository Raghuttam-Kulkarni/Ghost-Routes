import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Server-only config. Preferring the non-public names keeps the key out of the
 * browser bundle and lets hosting inject the values at runtime (no rebuild).
 * The NEXT_PUBLIC_* names still work for plain local development.
 */
function readConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Lazily creates the Supabase client so importing this module never throws at
 * build time when the environment variables are not present yet.
 */
export function getSupabase(): SupabaseClient {
  const config = readConfig();

  if (!config) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local (or the hosting secrets).',
    );
  }

  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    });
  }

  return client;
}
