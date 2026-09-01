"use client";

import { useState } from "react";
import { Library, Search } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { TopBar } from "~/components/layout/TopBar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { EXERCISE_CATEGORY } from "~/lib/types/enums";
import { isDemoMode, demoLib } from "~/lib/demo-bridge";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { ImageLightbox } from "~/components/common/ImageLightbox";
import type { Exercises } from "~/lib/types/models";

/**
 * Biblioteca de exercícios (trainer): globais + da academia, com busca e
 * filtro por categoria. Base para montar treinos em /treinos.
 */
export default function BibliotecaPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [zoom, setZoom] = useState<{ src: string | null; name: string } | null>(null);
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<Exercises[]>(
    async () => {
      if (demo) {
        // mesma biblioteca expandida do aluno: 289 exercícios com ilustração
        const all = demoLib.flatMap((c) => c.subs.flatMap((sub) => sub.exercises.map((e) => ({ ...e, category: c.id }))));
        return { data: all as unknown as Exercises[], error: null };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .or(`gym_id.is.null,gym_id.eq.${profile.gym_id}`)
        .order("name", { ascending: true });
      if (error) return { data: null, error };
      return { data: data as Exercises[], error: null };
    },
    [profile?.id, demo]
  );

  const filtered = (data ?? []).filter((e) => {
    const matchQ = !q || e.name.toLowerCase().includes(q.toLowerCase());
    const matchCat = cat === "all" || e.category === cat;
    return matchQ && matchCat;
  });

  return (
    <>
      <TopBar title="Biblioteca" subtitle={`${data?.length ?? 0} exercícios disponíveis`} />
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar exercício..."
            className="w-full rounded-lg border border-input bg-card/60 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={cat === "all"} onClick={() => setCat("all")} label="Todos" />
          {[...demoLib].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <FilterChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} />
          ))}
        </div>

        {loading ? (
          <SkeletonList rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum exercício encontrado"
            description="Ajuste a busca ou o filtro de categoria."
            icon={Library}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => {
              const img = (e as any).imageUrl ?? null;
              const grupo = demoLib.find((c) => c.id === e.category)?.name ?? e.category;
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
                  {img ? (
                    <button
                      onClick={() => setZoom({ src: img, name: e.name })}
                      aria-label={`Ampliar ilustração de ${e.name}`}
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <FitnessIcon glyph={fitnessForName(e.name)} size={26} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">{e.name}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{grupo}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(e.muscles ?? []).slice(0, 3).map((m) => (
                        <span key={m} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                    {e.tips?.length ? (
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{e.tips[0]}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ImageLightbox src={zoom?.src ?? null} alt={zoom?.name} open={!!zoom} onClose={() => setZoom(null)} />
    </>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
