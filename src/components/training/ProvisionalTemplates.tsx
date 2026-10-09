"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dumbbell, Play, Send, Loader2 } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";

export type ProvisionalTemplate = {
  id: string;
  name: string;
  goal: string | null;
  level: string | null;
  days: Array<{
    nome: string;
    exercicios: Array<{
      exercicio: string;
      series: number;
      reps: string;
      descanso: string;
      rpe?: number | null;
      dica?: string | null;
    }>;
  }>;
};

/**
 * Aba Treino provisório: modelos de referência para quem ainda não tem plano.
 * É SÓ referência (nunca atribui na ficha): selo explícito, filtro por sexo,
 * executar registra no histórico como provisório + botão de avisar o personal.
 */
export function ProvisionalTemplates({ onStart }: { onStart: (tpl: ProvisionalTemplate) => void }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [notifying, setNotifying] = useState(false);

  const { data, loading, error, refetch } = useAsyncQuery<ProvisionalTemplate[]>(
    async () => {
      if (!user || !profile?.gym_id) return { data: null, error: { message: "Sessão indisponível" } };
      const sex = profile.sex === "F" ? "F" : "M";
      const { data: rows, error } = await supabaseBrowser()
        .from("workout_templates")
        .select("id, name, goal, level, days")
        .eq("active", true)
        .in("sex", [sex, "all"])
        .or(`gym_id.is.null,gym_id.eq.${profile.gym_id}`)
        .order("name");
      if (error) return { data: null, error };
      return { data: (rows ?? []) as ProvisionalTemplate[], error: null };
    },
    [user?.id, profile?.gym_id, profile?.sex],
    { enabled: !authLoading && !!user }
  );

  const notifyTrainer = async () => {
    if (notifying) return;
    setNotifying(true);
    try {
      const { error } = await supabaseBrowser().rpc("notify_my_trainer", {});
      if (error) throw new Error(error.message);
      toast.success("Personal avisado", { description: "Ele vai montar seu treino de verdade." });
    } catch (e) {
      toast.error("Não deu avisar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-warning/40 bg-warning/[0.07] p-4">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-warning">
          <Dumbbell className="h-3.5 w-3.5" /> Treino provisório
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground">
          Modelos de referência para você não ficar parado enquanto seu personal monta seu treino de verdade.
          Isso aqui <strong>não é seu plano</strong>, é um ponto de partida.
        </p>
        <button
          type="button"
          onClick={notifyTrainer}
          disabled={notifying}
          className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 py-2.5 text-[12px] font-bold text-brand disabled:opacity-50"
        >
          {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {notifying ? "Avisando..." : "Avisar meu personal"}
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Sem modelos por aqui" description="Fale com seu personal para liberar seu treino." />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {(data ?? []).map((t) => {
            const day = t.days?.[0];
            const list = day?.exercicios ?? [];
            return (
              <div key={t.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-foreground">{t.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {[t.level, t.goal, `${list.length} exercícios`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-warning">
                    Provisório
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1">
                  {list.slice(0, 5).map((e, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-brand" />
                      <span className="truncate">
                        {e.exercicio} <span className="text-muted-foreground/70">· {e.series}x{e.reps}</span>
                      </span>
                    </li>
                  ))}
                  {list.length > 5 ? (
                    <li className="pl-2.5 text-[10.5px] font-semibold text-muted-foreground/70">
                      +{list.length - 5} exercícios
                    </li>
                  ) : null}
                </ul>
                <button
                  type="button"
                  onClick={() => onStart(t)}
                  disabled={list.length === 0}
                  className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[12.5px] font-black text-brand-foreground disabled:opacity-40"
                >
                  <Play className="h-4 w-4" /> Fazer este treino
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
