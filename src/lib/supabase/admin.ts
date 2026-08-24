import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/types/database";

type AdminClient = SupabaseClient<Database>;

/**
 * Cliente Supabase com service_role (bypass de RLS).
 * SERVER-ONLY: usado em rotas de API / edge functions.
 * JAMAIS importar em componentes ou páginas client.
 */
export function supabaseAdmin(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Supabase admin: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar em .env.local"
    );
  }

  return createClient<Database>(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseAdmin(): AdminClient {
  return supabaseAdmin();
}