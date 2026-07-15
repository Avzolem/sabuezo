import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ⚠️ SERVER-ONLY. Usa la service_role key (bypassa RLS).
// NUNCA importar desde un componente cliente ("use client"). La key jamás
// llega al browser. Se instancia de forma perezosa (lazy) para no lanzar en
// build-time cuando la key no está en el entorno local; solo se crea al
// llamarse en runtime (las páginas que lo usan son force-dynamic).
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !serviceKey) {
    throw new Error(
      "supabase-admin no configurado: falta SUPABASE_URL o SUPABASE_SERVICE_KEY"
    );
  }
  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
