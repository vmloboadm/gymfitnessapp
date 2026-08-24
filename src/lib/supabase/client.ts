import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/types/database";

type BrowserClient = SupabaseClient<Database>;

let cachedClient: BrowserClient | null = null;

/**
 * Cliente Supabase para o browser (PWA/mobile).
 * Usa anon key + RLS. NUNCA colocar service_role aqui.
 */
export function supabaseBrowser(): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar em .env.local"
    );
  }

  if (!cachedClient) {
    cachedClient = createBrowserClient<Database>(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });
  }

  return cachedClient;
}

export function getSupabaseBrowser(): BrowserClient {
  return supabaseBrowser();
}