"use client";

import { Users, UserPlus } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoPersonais } from "~/lib/demo-bridge";
import type { Profiles } from "~/lib/types/models";

type TrainerRow = Profiles & { students: number };

/**
 * Personais do gym: equipe e número de alunos vinculados por student_trainers.
 */
export default function PersonaisPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<TrainerRow[]>(
    async () => {
      if (demo) {
        const rows = demoPersonais() as any[];
        return {
          data: rows.map((r: any) => ({
            id: r.id, gym_id: "1", role: "trainer", name: r.trainer.name, email: r.trainer.email, status: "active",
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            students: r.students, phone: null, avatar_url: null,
          })) as unknown as TrainerRow[],
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const pRes = await supabase
        .from("profiles")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .in("role", ["trainer", "manager"]);
      if (pRes.error) return { data: null, error: pRes.error };

      const trainers = (pRes.data ?? []) as Profiles[];
      const ids = trainers.map((t) => t.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const stRes = await supabase.from("student_trainers").select("trainer_id").in("trainer_id", ids);
        if (!stRes.error) {
          counts = (stRes.data ?? []).reduce<Record<string, number>>((acc, r) => {
            acc[r.trainer_id] = (acc[r.trainer_id] ?? 0) + 1;
            return acc;
          }, {});
        }
      }

      return { data: trainers.map((t) => ({ ...t, students: counts[t.id] ?? 0 })), error: null };
    },
    [profile?.id, demo]
  );

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Personais</h1>
            <p className="text-xs text-muted-foreground">{data?.length ?? 0} membros da equipe</p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum personal cadastrado"
            description="Os personais criados como role trainer aparecem aqui."
            icon={Users}
          />
        ) : (
          <div className="space-y-2">
            {data?.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    {(t.name?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                </div>
                <Badge variant="outline">{t.role}</Badge>
                <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <UserPlus className="h-3.5 w-3.5" />
                  {formatNumber(t.students)} {t.students === 1 ? "aluno" : "alunos"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
