"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList } from "~/components/common/AsyncStates";
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
  const [filter, setFilter] = useState<string>("todas");

  useEffect(() => {
    if (!profile?.gym_id) return;
    let alive = true;
    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb
          .from("equipment")
          .select("id, name, category, status, map_position")
          .eq("gym_id", profile.gym_id)
          .order("name");
        if (alive) setEqs(((data ?? []) as MapEq[]).filter((e) => e.map_position));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [profile?.gym_id]);

  const cats = ["todas", ...Array.from(new Set(eqs.map((e) => e.category)))];
  const shown = filter === "todas" ? eqs : eqs.filter((e) => e.category === filter);

  return (
    <>
      <TopBar title="Mapa do salão" subtitle={`${shown.length} aparelhos`} />
      <div className="mx-auto max-w-md space-y-3 p-4 pb-10">
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

        {loading ? (
          <SkeletonList rows={2} />
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
                  className={cn(
                    "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40 transition-transform active:scale-150",
                    STATUS_COLOR[e.status] ?? "bg-white/30"
                  )}
                  style={{ left: `${e.map_position!.x}%`, top: `${e.map_position!.y}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] py-2 text-[9px] font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4ADE80]" /> Livre</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FFC24D]" /> Em uso</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F87171]" /> Manutenção</span>
            </div>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          Toque num ponto pra ver os exercícios do aparelho.
        </p>
      </div>
    </>
  );
}
