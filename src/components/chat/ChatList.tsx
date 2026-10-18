"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { formatRelative, displayName } from "~/lib/utils/format";

type Row = {
  id: string;
  student_id: string;
  staff_id: string;
  updated_at: string;
  other: { id: string; name: string | null; avatar_url: string | null } | null;
  preview: string | null;
  unread: number;
};

/**
 * Caixa de entrada das conversas diretas (aluno e staff usam a mesma lista,
 * mudando só o caminho base). Nome social + foto + prévia + não lidas.
 */
export function ChatList({ basePath, title }: { basePath: string; title: string }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [q, setQ] = useState("");

  const { data, loading, error, refetch } = useAsyncQuery<Row[]>(
    async () => {
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
      const supabase = supabaseBrowser();
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, student_id, staff_id, updated_at")
        .or(`student_id.eq.${user.id},staff_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (convErr) return { data: null, error: convErr };
      const list = (convs ?? []) as Array<{ id: string; student_id: string; staff_id: string; updated_at: string }>;
      if (list.length === 0) return { data: [], error: null };
      const rpc = await supabase.rpc("gym_roster", { p_gym_id: profile.gym_id });
      const roster = (!rpc.error && Array.isArray(rpc.data) ? rpc.data : []) as Array<{
        id: string;
        name: string | null;
        avatar_url: string | null;
      }>;

      // Só a última mensagem (prévia) + contador de não lidas por conversa:
      // evita puxar centenas de mensagens que a lista não exibe.
      const rows: Row[] = await Promise.all(
        list.map(async (c) => {
          const otherId = c.student_id === user.id ? c.staff_id : c.student_id;
          const other = roster.find((r) => r.id === otherId) ?? null;
          const [lastRes, unreadRes] = await Promise.all([
            supabase
              .from("direct_messages")
              .select("body, created_at")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("direct_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .neq("sender_id", user.id)
              .is("read_at", null),
          ]);
          return {
            id: c.id,
            student_id: c.student_id,
            staff_id: c.staff_id,
            updated_at: c.updated_at,
            other,
            preview: ((lastRes.data ?? null) as { body: string } | null)?.body ?? null,
            unread: unreadRes.count ?? 0,
          };
        })
      );
      return { data: rows, error: null };
    },
    [user?.id, profile?.gym_id],
    { enabled: !authLoading && !!user }
  );

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (c) =>
        (c.other?.name ?? "").toLowerCase().includes(term) ||
        (c.preview ?? "").toLowerCase().includes(term)
    );
  }, [data, q]);

  const isStudent = (profile?.role ?? "student") === "student";

  return (
    <>
      <TopBar title={title} subtitle={isStudent ? "Fale direto com seu personal" : "Fale direto com o aluno"} />
      <div className="mx-auto max-w-md space-y-2 p-4 pb-28">
        {(data ?? []).length > 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar conversa..."
              aria-label="Buscar conversa"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : null}

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          q.trim() ? (
            <EmptyState
              title="Nenhuma conversa encontrada"
              description="Tente outro nome ou termo de busca."
              icon={Search}
            />
          ) : (
            <EmptyState
              title="Sem conversas ainda"
              description={
                isStudent
                  ? "Quando seu personal mandar uma mensagem por aqui, ela aparece nesta lista."
                  : "Abra a ficha do aluno ou aguarde o contato do seu personal."
              }
              icon={MessageCircle}
            />
          )
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`${basePath}/${c.id}`}
              className="tactile flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="relative shrink-0">
                <Avatar className="h-11 w-11">
                  {c.other?.avatar_url ? <AvatarImage src={c.other.avatar_url} alt={c.other.name ?? ""} /> : null}
                  <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                    {(c.other?.name?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {c.unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black text-brand-foreground">
                    {c.unread > 9 ? "9+" : c.unread}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-foreground">
                  {displayName(c.other?.name)}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {c.preview ?? "Conversa aberta"}
                </p>
              </div>
              <span className="shrink-0 text-[9.5px] text-muted-foreground">
                {formatRelative(c.updated_at)}
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
