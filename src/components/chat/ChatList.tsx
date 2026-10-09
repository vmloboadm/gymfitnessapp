"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
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
  const [q] = useState("");

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

      const otherIds = [...new Set(list.map((c) => (c.student_id === user.id ? c.staff_id : c.student_id)))];
      const rpc = await supabase.rpc("gym_roster", { p_gym_id: profile.gym_id });
      const roster = (!rpc.error && Array.isArray(rpc.data) ? rpc.data : []) as Array<{
        id: string;
        name: string | null;
        avatar_url: string | null;
      }>;

      const { data: messages } = await supabase
        .from("direct_messages")
        .select("conversation_id, sender_id, body, created_at, read_at")
        .in(
          "conversation_id",
          list.map((c) => c.id)
        )
        .order("created_at", { ascending: false })
        .limit(300);
      const byConv = new Map<string, Array<{ sender_id: string; body: string; created_at: string; read_at: string | null }>>();
      for (const m of (messages ?? []) as Array<{
        conversation_id: string;
        sender_id: string;
        body: string;
        created_at: string;
        read_at: string | null;
      }>) {
        const arr = byConv.get(m.conversation_id) ?? [];
        arr.push(m);
        byConv.set(m.conversation_id, arr);
      }

      const rows: Row[] = list.map((c) => {
        const otherId = c.student_id === user.id ? c.staff_id : c.student_id;
        const other = roster.find((r) => r.id === otherId) ?? null;
        const msgs = (byConv.get(c.id) ?? []).filter((m) =>
          !q || m.body.toLowerCase().includes(q.toLowerCase())
        );
        return {
          id: c.id,
          student_id: c.student_id,
          staff_id: c.staff_id,
          updated_at: c.updated_at,
          other,
          preview: msgs[0]?.body ?? null,
          unread: msgs.filter((m) => m.sender_id !== user.id && !m.read_at).length,
        };
      });
      return { data: rows, error: null };
    },
    [user?.id, profile?.id, q],
    { enabled: !authLoading && !!user }
  );

  return (
    <>
      <TopBar title={title} subtitle="Fale direto com seu personal" />
      <div className="mx-auto max-w-md space-y-2 p-4 pb-28">
        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Sem conversas ainda"
            description="Abra a ficha do aluno (staff) ou aguarde o contato do seu personal."
            icon={MessageCircle}
          />
        ) : (
          (data ?? []).map((c) => (
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
