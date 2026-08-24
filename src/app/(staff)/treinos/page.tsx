"use client";

import { ClipboardList, Plus, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { TopBar } from "~/components/layout/TopBar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatDate } from "~/lib/utils/format";
import { isDemoMode, demoWorkoutProgram, demoWorkoutDays, demoWorkoutExercises } from "~/lib/demo-bridge";
import type { WorkoutDays, WorkoutExercises, WorkoutPrograms } from "~/lib/types/models";

type Prog = WorkoutPrograms & {
  days: WorkoutDays[];
  exercises: WorkoutExercises[];
};

/**
 * Programas de treino do personal (trainer): lista com resumo (dias/exercícios)
 * e botão de novo programa. A montagem detalhada virá em /treinos/[id].
 */
export default function TreinosPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<Prog[]>(
    async () => {
      if (demo) {
        return {
          data: [demoWorkoutProgram].map((p: any) => ({
            ...p,
            days: demoWorkoutDays,
            exercises: demoWorkoutExercises,
          })) as unknown as Prog[],
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const { data, error } = await supabase
        .from("workout_programs")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .eq("trainer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return { data: null, error };

      const programs = (data ?? []) as WorkoutPrograms[];
      const ids = programs.map((p) => p.id);

      let days: WorkoutDays[] = [];
      if (ids.length) {
        const dRes = await supabase.from("workout_days").select("*").in("program_id", ids);
        if (dRes.error) return { data: null, error: dRes.error };
        days = (dRes.data ?? []) as WorkoutDays[];
      }

      let exercises: WorkoutExercises[] = [];
      const dayIds = days.map((d) => d.id);
      if (dayIds.length) {
        const eRes = await supabase.from("workout_exercises").select("*").in("day_id", dayIds);
        if (eRes.error) return { data: null, error: eRes.error };
        exercises = (eRes.data ?? []) as WorkoutExercises[];
      }

      const rows = programs.map((p) => ({
        ...p,
        days: days.filter((d) => d.program_id === p.id),
        exercises: exercises.filter((e) => dayHasProgram(e, days, p.id)),
      }));
      return { data: rows, error: null };
    },
    [user?.id, profile?.id, demo]
  );

  return (
    <>
      <TopBar title="Treinos" subtitle={`${data?.length ?? 0} programas criados`} />
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand/10 p-4">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-brand" />
              Gerar sugestão
            </p>
            <p className="text-xs text-muted-foreground">Crie um programa completo em segundos (OmniRoute).</p>
          </div>
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Novo
          </Button>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.length === 0 ? (
          <EmptyState
            title="Nenhum programa criado"
            description="Programas criados por você aparecem aqui, prontos para atribuir a alunos."
            icon={ClipboardList}
          />
        ) : (
          <div className="space-y-2">
            {data?.map((p) => {
              const totalExercises = p.exercises.length;
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.days.length} {p.days.length === 1 ? "dia" : "dias"} · {totalExercises} {totalExercises === 1 ? "exercício" : "exercícios"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Criado em {formatDate(p.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={p.created_via === "ia" ? "warning" : "secondary"}>
                        {p.created_via === "ia" ? "Auto" : p.created_via}
                      </Badge>
                      <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand" aria-label="Abrir programa">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {p.days.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                      {p.days.map((d) => (
                        <span key={d.id} className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                          {d.name} · {p.exercises.filter((e) => e.day_id === d.id).length} ex
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function dayHasProgram(e: WorkoutExercises, days: WorkoutDays[], programId: string): boolean {
  const day = days.find((d) => d.id === e.day_id);
  return day ? day.program_id === programId : false;
}
