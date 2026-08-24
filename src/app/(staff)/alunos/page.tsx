"use client";

import { Users, Search, UserPlus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { TopBar } from "~/components/layout/TopBar";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { isDemoMode, demoAlunosPersonal } from "~/lib/demo-bridge";
import type { Profiles, StudentTrainers } from "~/lib/types/models";

type AlunoRow = Profiles & { trainer: StudentTrainers | null; activePrograms: number };

/**
 * Painel de alunos do personal (trainer). Lista os alunos vinculados via
 * student_trainers + os demais alunos do gym (para atribuição futura).
 */
export default function AlunosPage() {
  const { user, profile } = useAuth();
  const [q, setQ] = useState("");
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<AlunoRow[]>(
    async () => {
      if (demo) {
        const rows = demoAlunosPersonal() as any[];
        return {
          data: rows.map((r: any) => ({
            id: r.id, gym_id: "1", role: "student", name: r.name, email: r.email, status: r.status,
            activePrograms: r.workout_active ? 1 : 0, trainer: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            phone: null, avatar_url: null,
          })) as unknown as AlunoRow[],
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const stRes = await supabase.from("student_trainers").select("*").eq("trainer_id", user.id);
      if (stRes.error) return { data: null, error: stRes.error };

      const links = (stRes.data ?? []) as StudentTrainers[];

      const pRes = await supabase
        .from("profiles")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .eq("role", "student")
        .order("name", { ascending: true })
        .limit(60);
      if (pRes.error) return { data: null, error: pRes.error };

      const students = (pRes.data ?? []) as Profiles[];

      // conta programas ativos atribuídos por aluno
      let programCounts: Record<string, number> = {};
      const ids = students.map((s) => s.id);
      if (ids.length) {
        const swRes = await supabase
          .from("student_workouts")
          .select("student_id")
          .eq("status", "active")
          .in("student_id", ids);
        if (!swRes.error) {
          programCounts = (swRes.data ?? []).reduce<Record<string, number>>((acc, r) => {
            acc[r.student_id] = (acc[r.student_id] ?? 0) + 1;
            return acc;
          }, {});
        }
      }

      const rows = students.map((s) => ({
        ...s,
        trainer: links.find((l) => l.student_id === s.id) ?? null,
        activePrograms: programCounts[s.id] ?? 0,
      }));
      // ordena: vinculados primeiro
      rows.sort((a, b) => Number(b.trainer != null) - Number(a.trainer != null) || a.name.localeCompare(b.name));

      return { data: rows, error: null };
    },
    [user?.id, profile?.id, demo]
  );

  const filtered = (data ?? []).filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <TopBar title="Alunos" subtitle={`${data?.filter((s) => s.trainer).length ?? 0} ativos sob sua responsabilidade`} />
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar aluno por nome ou e-mail..."
            className="w-full rounded-lg border border-input bg-card/60 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {loading ? (
          <SkeletonList rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum aluno encontrado"
            description={q ? "Ajuste a busca para listar novamente." : "Os alunos do gym aparecem aqui."}
            icon={q ? Search : Users}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    {(s.name?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {s.trainer ? (
                      <Badge variant="success">Seu aluno</Badge>
                    ) : (
                      <Badge variant="secondary">Sem personal</Badge>
                    )}
                    <Badge variant="outline">{s.activePrograms} {s.activePrograms === 1 ? "programa ativo" : "programas ativos"}</Badge>
                  </div>
                </div>
                <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand" aria-label="Abrir aluno">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          Atribuir alunos a você é feito pelo gestor em Personais (área do gestor).
        </div>
      </div>
    </>
  );
}
