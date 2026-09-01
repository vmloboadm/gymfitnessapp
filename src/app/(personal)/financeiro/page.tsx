"use client";

import { Wallet, TrendingUp, BadgeCheck } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { formatBRL, formatDate } from "~/lib/utils/format";
import { isDemoMode, demoFinanceiro } from "~/lib/demo-bridge";
import type { StudentSubscriptions } from "~/lib/types/models";

/**
 * Financeiro do gestor: receita mensal (assinaturas ativas) + Faturamento vencido.
 */
export default function FinanceiroPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{ active: StudentSubscriptions[]; overdue: StudentSubscriptions[] }>(
    async () => {
      if (demo) {
        const f = demoFinanceiro() as any;
        return {
          data: {
            active: (f.subscriptions ?? []).map((s: any) => ({
              id: s.id, gym_id: "1", student_id: "u1", plan_name: s.plan_name, type: "monthly",
              status: "active", price: s.price, starts_at: new Date().toISOString(), ends_at: s.ends_at,
              payment_method: null, auto_renew: true,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            })),
            overdue: (f.overdue ?? []).map((s: any) => ({
              id: s.id, gym_id: "1", student_id: "u1", plan_name: s.plan_name, type: "monthly",
              status: "expired", price: s.price, starts_at: new Date().toISOString(), ends_at: s.ends_at,
              payment_method: null, auto_renew: false,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            })),
          },
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const res = await supabase
        .from("student_subscriptions")
        .select("*")
        .eq("gym_id", profile.gym_id);
      if (res.error) return { data: null, error: res.error };

      const subs = (res.data ?? []) as StudentSubscriptions[];
      const today = new Date().toISOString();
      return {
        data: {
          active: subs.filter((s) => s.status === "active"),
          overdue: subs.filter((s) => s.status === "expired" || (s.status === "active" && s.ends_at < today)),
        },
        error: null,
      };
    },
    [profile?.id, demo]
  );

  const mrr = (data?.active ?? []).reduce((acc, s) => acc + s.price, 0);

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Financeiro</h1>
            <p className="text-xs text-muted-foreground">Assinaturas e vencimentos</p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="MRR" value={formatBRL(mrr)} icon={Wallet} context="Receita mensal recorrente" />
              <StatCard
                label="Vencidas"
                value={String(data?.overdue.length ?? 0)}
                icon={TrendingUp}
                context="Assinaturas vencidas ou atrasadas"
              />
            </div>

            {(data?.overdue ?? []).length === 0 ? (
              <EmptyState
                title="Nenhuma cobrança vencida"
                description="Todas as assinaturas ativas estão em dia."
                icon={BadgeCheck}
              />
            ) : (
              <div className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencimentos</p>
                {data?.overdue.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{s.plan_name}</p>
                      <p className="text-xs text-muted-foreground">venceu em {formatDate(s.ends_at)}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-destructive">{formatBRL(s.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
