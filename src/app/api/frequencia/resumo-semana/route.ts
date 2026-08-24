import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "~/lib/types/database";
import { buildFrequencySeries, WEEK_DAYS } from "~/lib/academia";

type Cached = { data: ReturnType<typeof buildFrequencySeries>; at: number };
let cache: Cached | null = null;
const TTL_MS = 10 * 60 * 1000;

/**
 * GET /api/frequencia/resumo-semana, comparativo de frequência (pro-frontend
 * standards §3/§7). Cache TTL 10min; sem sessão → 401. Fallback: mesmos dados
 * estadísticos construídos no módulo (sem chamada externa, não há o que falhar).
 */
export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // readonly em Server Component
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // readonly
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ ok: true, cache: true, ...cache.data });
  }

  const since = new Date();
  since.setDate(since.getDate() - (WEEK_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("checkins")
    .select("checked_at")
    .gte("checked_at", since.toISOString());

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        cache: false,
        error: error.message,
        fallback: buildFrequencySeries([], WEEK_DAYS),
      },
      { status: 200 }
    );
  }

  const normalized = buildFrequencySeries((data ?? []) as Array<{ checked_at: string }>, WEEK_DAYS);
  cache = { data: normalized, at: now };
  return NextResponse.json({ ok: true, cache: false, ...normalized });
}