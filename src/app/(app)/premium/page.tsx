"use client";

import { useState } from "react";
import { Crown, FileText, Send, Inbox } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { usePremiumRequestsRealtime } from "~/hooks/useRealtimeSubscriptions";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { formatDate, formatRelative } from "~/lib/utils/format";
import { toast } from "sonner";
import type { PremiumRequests } from "~/lib/types/models";

const REQUEST_LABEL: Record<PremiumRequests["request_type"], string> = {
  pdf: "Ficha em PDF",
  report: "Relatório de progresso",
  other: "Outro",
};

const REQUEST_STATUS_LABEL: Record<PremiumRequests["status"], string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
};

/**
 * Área premium: solicitar ficha PDF / relatório ao gestor.
 */
export default function PremiumPage() {
  const { user, profile } = useAuth();
  const [type, setType] = useState<PremiumRequests["request_type"]>("pdf");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useAsyncQuery<PremiumRequests[]>(
    async () => {
      if (!user) return { data: null, error: { message: "Sessão indisponível" } };
      const { data, error } = await supabaseBrowser()
        .from("premium_requests")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return { data: null, error };
      return { data: data as PremiumRequests[], error: null };
    },
    [user?.id]
  );

  // Realtime: refetch when trainer approves/rejects
  usePremiumRequestsRealtime(profile?.gym_id, refetch);

  const submit = async () => {
    if (!user || !profile) return;
    setSubmitting(true);
    const { error } = await supabaseBrowser()
      .from("premium_requests")
      .insert({
        gym_id: profile.gym_id,
        student_id: user.id,
        request_type: type,
        details: details.trim() || null,
        status: "pending" as const,
      } as never);
    setSubmitting(false);
    if (error) {
      toast.error("Falha ao solicitar", { description: error.message });
      return;
    }
    setDetails("");
    toast.success("Solicitação enviada");
    refetch();
  };

  return (
    <>
      <TopBar title="Premium" subtitle="Materiais exclusivos" />
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-warning" />
            <p className="text-sm font-semibold text-foreground">Solicitar material</p>
          </div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PremiumRequests["request_type"])}
            className="mb-3 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(Object.keys(REQUEST_LABEL) as PremiumRequests["request_type"][]).map((t) => (
              <option key={t} value={t}>{REQUEST_LABEL[t]}</option>
            ))}
          </select>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalhes (opcional): período, foco do relatório..."
            rows={2}
            className="resize-none"
          />
          <Button className="mt-3 w-full" size="sm" onClick={submit} disabled={submitting}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Enviar solicitação
          </Button>
        </div>

        {loading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.length === 0 ? (
          <EmptyState title="Nenhuma solicitação" description="Suas solicitações de ficha e relatório aparecem aqui." icon={Inbox} />
        ) : (
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
            {data?.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">{REQUEST_LABEL[r.request_type]}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(r.created_at)} · {formatRelative(r.created_at)}
                    {r.reviewed_at ? ` · analisado em ${formatDate(r.reviewed_at)}` : ""}
                  </p>
                </div>
                <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                  {REQUEST_STATUS_LABEL[r.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
