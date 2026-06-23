import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Credenciais vêm das env vars do Vercel (integração Supabase ↔ Vercel).
// Em Next.js, as NEXT_PUBLIC_* são injetadas no bundle no build — nativo.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Cliente único no browser (singleton) — null se faltar config.
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export const EVENT = "arraia";
