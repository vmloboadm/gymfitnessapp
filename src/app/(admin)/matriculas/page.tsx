"use client";

import { ClipboardList, CalendarClock } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { formatBRL, formatDate } from "~/lib/utils/format";
import { isDemoMode, demoMatriculas } from "~/lib/demo-bridge";
import type { Profiles, StudentSubscriptions } from "~/lib/types/models";

/**
 * Matrículas do gym: assinaturas com aluno + status + vencimento.
 */
export default function MatriculasPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<
    (StudentSubscriptions & { student: Profiles | null })[]
  >(
    async (): Promise<{ data: (StudentSubscriptions & { student: Profiles | null })[] | null; error: { message: string } | null }> => {
      if (demo) {
        const rows = demoMatriculas() as any[];
        return {
          data: rows.map((r: any) => ({
            id: r.id, gym_id: "1", student_id: "u1", plan_name: r.plan_name, type: r.type,
            status: r.status, price: r.price, starts_at: r.starts_at, ends_at: r.ends_at,
            payment_method: null, auto_renew: false,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            student: { id: "u1", gym_id: "1", role: "student", name: r.student.name, email: r.student.email, status: "active" },
          })) as unknown as (StudentSubscriptions & { student: Profiles | null })[],
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const sRes = await supabase
        .from("student_subscriptions")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (sRes.error) return { data: null, error: sRes.error };

      const subs = (sRes.data ?? []) as StudentSubscriptions[];
      const ids = [...new Set(subs.map((s) => s.student_id))];
      let students: Profiles[] = [];
      if (ids.length) {
        const pRes = await supabase.from("profiles").select("id, name, email").in("id", ids);
        if (!pRes.error) students = (pRes.data ?? []) as Profiles[];
      }

      return {
        data: subs.map((s) => ({ ...s, student: students.find((p) => p.id === s.student_id) ?? null })),
        error: null,
      };
    },
    [profile?.id, demo]
  );

  const statusVariant = (s: StudentSubscriptions["status"]): "success" | "warning" | "danger" | "secondary" => {
    if (s === "active") return "success";
    if (s === "expired") return "danger";
    if (s === "blocked") return "danger";
    if (s === "cancelled") return "secondary";
    return "warning";
  };

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Matrículas</h1>
            <p className="text-xs text-muted-foreground">{data?.length ?? 0} assinaturas listadas</p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma matrícula"
            description="Assinaturas criadas nos check-ins e renovação aparecem aqui."
            icon={ClipboardList}
          />
        ) : (
          <div className="space-y-2">
            {data?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    {(s.student?.name?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.student?.name ?? "Aluno"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.plan_name} · {formatBRL(s.price)}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    até {formatDate(s.ends_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
