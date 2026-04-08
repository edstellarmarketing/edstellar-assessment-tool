import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side client with service role key - bypasses RLS
// Only use in API routes, never expose to the client
// Lazy initialization to avoid build-time errors when env var is missing

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}
