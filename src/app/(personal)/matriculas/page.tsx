"use client";

import { useEffect, useState } from "react";
import { ClipboardList, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatBRL, formatDate } from "~/lib/utils/format";
import { isDemoMode, demoMatriculas } from "~/lib/demo-bridge";
import type { Profiles, StudentSubscriptions } from "~/lib/types/models";

type SubRow = StudentSubscriptions & { student: Profiles | null };

const PAGE_SIZE = 30;

/**
 * Matrículas do gym: assinaturas com aluno + status + vencimento.
 */
export default function MatriculasPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();
  const [extra, setExtra] = useState<SubRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (
    offset: number,
    limit: number
  ): Promise<{ data: { items: SubRow[]; total: number } | null; error: { message: string } | null }> => {
    if (demo) {
      const rows = demoMatriculas() as any[];
      const items = rows.map((r: any) => ({
        id: r.id, gym_id: "1", student_id: "u1", plan_name: r.plan_name, type: r.type,
        status: r.status, price: r.price, starts_at: r.starts_at, ends_at: r.ends_at,
        payment_method: null, auto_renew: false,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        student: { id: "u1", gym_id: "1", role: "student", name: r.student.name, email: r.student.email, status: "active" },
      })) as unknown as SubRow[];
      return { data: { items, total: items.length }, error: null };
    }

    const supabase = supabaseBrowser();
    if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

    const sRes = await supabase
      .from("student_subscriptions")
      .select("*", { count: "exact" })
      .eq("gym_id", profile.gym_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (sRes.error) return { data: null, error: sRes.error };

    const subs = (sRes.data ?? []) as StudentSubscriptions[];
    const ids = [...new Set(subs.map((s) => s.student_id))];
    let students: Profiles[] = [];
    if (ids.length) {
      const pRes = await supabase.from("profiles").select("id, name, email").in("id", ids);
      if (!pRes.error) students = (pRes.data ?? []) as Profiles[];
    }

    return {
      data: {
        items: subs.map((s) => ({ ...s, student: students.find((p) => p.id === s.student_id) ?? null })),
        total: sRes.count ?? offset + subs.length,
      },
      error: null,
    };
  };

  const { data, loading, error, refetch } = useAsyncQuery(
    (): Promise<{ data: { items: SubRow[]; total: number } | null; error: { message: string } | null }> => fetchPage(0, PAGE_SIZE),
    [profile?.id, demo]
  );

  // Refetch substitui a primeira página: o que tinha sido carregado "a mais" some junto.
  useEffect(() => { setExtra([]); }, [data]);

  const rows = [...(data?.items ?? []), ...extra];
  const total = data?.total ?? rows.length;

  const loadMore = async () => {
    if (loadingMore || !data) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(rows.length, PAGE_SIZE);
      if (page.error) throw new Error(page.error.message);
      const items = page.data?.items ?? [];
      setExtra((prev) => {
        const seen = new Set([...data.items, ...prev].map((r) => r.id));
        return [...prev, ...items.filter((r) => !seen.has(r.id))];
      });
    } catch (e) {
      toast.error("Não deu carregar mais matrículas agora.", {
        description: e instanceof Error ? e.message.slice(0, 80) : undefined,
      });
    } finally {
      setLoadingMore(false);
    }
  };

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
            <p className="text-xs text-muted-foreground">
              {rows.length === total ? `${total} assinaturas` : `${rows.length} de ${total} assinaturas`}
            </p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma matrícula"
            description="Assinaturas criadas nos check-ins e renovação aparecem aqui."
            icon={ClipboardList}
          />
        ) : (
          <div className="space-y-2">
            {rows.map((s) => (
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
            {total > rows.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Carregando..." : `Carregar mais (restam ${total - rows.length})`}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
