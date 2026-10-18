"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Map as MapIcon } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { cn } from "~/lib/utils";

type MapEq = {
  id: string;
  name: string;
  category: string;
  status: string;
  map_position: { x: number; y: number } | null;
};

const STATUS_COLOR: Record<string, string> = {
  available: "bg-[#4ADE80]",
  in_use: "bg-[#FFC24D]",
  maintenance: "bg-[#F87171]",
  pending: "bg-white/30",
};

/**
 * Mapa do salão (/mapa): planta com os equipamentos reais posicionados.
 * Toque no ponto abre a página da máquina. Cores = status.
 */
export default function MapaPage() {
  const { profile } = useAuth();
  const [eqs, setEqs] = useState<MapEq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todas");

  const load = useCallback(async (gymId: string) => {
    setLoading(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { data, error: err } = await sb
        .from("equipment")
        .select("id, name, category, status, map_position")
        .eq("gym_id", gymId)
        .order("name");
      if (err) throw new Error(err.message);
      setEqs(((data ?? []) as MapEq[]).filter((e) => e.map_position));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o mapa.");
      setEqs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.gym_id) return;
    load(profile.gym_id).catch(() => {});
  }, [profile?.gym_id, load]);

  const cats = ["todas", ...Array.from(new Set(eqs.map((e) => e.category)))];
  const shown = filter === "todas" ? eqs : eqs.filter((e) => e.category === filter);

  return (
    <>
      <TopBar title="Mapa do salão" subtitle={loading ? "Carregando..." : `${shown.length} aparelhos`} />
      <div className="mx-auto max-w-md space-y-3 p-4 pb-10">
        {!loading && !error && eqs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "tactile rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                  filter === c ? "bg-brand text-brand-foreground" : "bg-white/[0.06] text-muted-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <SkeletonList rows={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => profile?.gym_id && load(profile.gym_id)} />
        ) : eqs.length === 0 ? (
          <EmptyState
            title="Mapa não configurado para esta academia"
            description="Ainda não há equipamentos posicionados na planta do salão. Pergunte na recepção ou consulte a lista de equipamentos."
            icon={MapIcon}
          />
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02]">
            {/* planta: entrada em cima, fundo embaixo */}
            <p className="border-b border-white/[0.06] py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Entrada
            </p>
            <div className="relative aspect-[4/5] w-full">
              {/* áreas */}
              <div className="absolute right-[2%] top-[2%] h-[38%] w-[28%] rounded-2xl border border-dashed border-white/10 p-1 text-[8px] font-bold uppercase text-white/30">Cardio</div>
              <div className="absolute left-[30%] top-[22%] h-[45%] w-[42%] rounded-2xl border border-dashed border-white/10 p-1 text-[8px] font-bold uppercase text-white/30">Máquinas</div>
              <div className="absolute bottom-[2%] left-[2%] h-[32%] w-[40%] rounded-2xl border border-dashed border-white/10 p-1 text-[8px] font-bold uppercase text-white/30">Pesos livres</div>
              {shown.map((e) => (
                <Link
                  key={e.id}
                  href={`/maquina/${e.id}`}
                  aria-label={e.name}
                  title={e.name}
                  className="flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-transform active:scale-110"
                  style={{ left: `${e.map_position!.x}%`, top: `${e.map_position!.y}%` }}
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full ring-2 ring-black/40",
                      STATUS_COLOR[e.status] ?? "bg-white/30"
                    )}
                  />
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] py-2 text-[9px] font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4ADE80]" /> Livre</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FFC24D]" /> Em uso</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F87171]" /> Manutenção</span>
            </div>
          </div>
        )}

        {eqs.length > 0 ? (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Toque num ponto pra ver os exercícios do aparelho.
          </p>
        ) : null}
      </div>
    </>
  );
}
