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
import { isDemoMode, demoBiblioteca } from "~/lib/demo-bridge";
import type { Exercises } from "~/lib/types/models";

/**
 * Biblioteca de exercícios (trainer): globais + da academia, com busca e
 * filtro por categoria. Base para montar treinos em /treinos.
 */
export default function BibliotecaPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<Exercises[]>(
    async () => {
      if (demo) {
        return { data: demoBiblioteca() as unknown as Exercises[], error: null };
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

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <FilterChip active={cat === "all"} onClick={() => setCat("all")} label="Todos" />
          {EXERCISE_CATEGORY.map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)} label={c} />
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
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{e.name}</p>
                  <Badge variant="outline" className="shrink-0 capitalize">{e.category}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.muscles.map((m) => (
                    <span key={m} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m}
                    </span>
                  ))}
                </div>
                {e.tips?.length ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{e.tips[0]}</p>
                ) : null}
                {e.high_impact ? (
                  <p className="mt-2 text-[11px] font-medium text-warning">Alto impacto — atenção a restrições.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
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
