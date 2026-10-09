"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Send } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { formatRelative, displayName } from "~/lib/utils/format";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Mate = { id: string; name: string | null; avatar_url: string | null };

/**
 * Fio de conversa direta (só texto na v1), usado pelo aluno e pelo staff.
 * Tempo real via Realtime + marca como lida ao abrir.
 */
export function ChatThread({
  conversationId,
  backHref,
  backLabel,
}: {
  conversationId: string;
  backHref: string;
  backLabel: string;
}) {
  const { user, profile, loading: authLoading } = useAuth();
  const [mate, setMate] = useState<Mate | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authLoading || !user || !profile || !conversationId) return;
    let cancelled = false;
    (async () => {
      const supabase = supabaseBrowser();
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("student_id, staff_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (convErr || !conv) {
        if (!cancelled) {
          setLoadError("Conversa indisponível.");
          setLoading(false);
        }
        return;
      }
      const otherId =
        (conv as { student_id: string; staff_id: string }).student_id === user.id
          ? (conv as { student_id: string; staff_id: string }).staff_id
          : (conv as { student_id: string; staff_id: string }).student_id;
      const rpc = await supabase.rpc("gym_roster", { p_gym_id: profile.gym_id });
      const found = !rpc.error && Array.isArray(rpc.data)
        ? ((rpc.data as Mate[]).find((m) => m.id === otherId) ?? null)
        : null;
      const { data: messages, error: msgErr } = await supabase
        .from("direct_messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgErr) {
        if (!cancelled) {
          setLoadError(msgErr.message);
          setLoading(false);
        }
        return;
      }
      // marca como lidas as que vieram do outro lado
      await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() } as never)
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (!cancelled) {
        setMate(found);
        setMsgs((messages ?? []) as Msg[]);
        setLoading(false);
      }
    })();

    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-199), m]));
          if (m.sender_id !== user.id) {
            supabase
              .from("direct_messages")
              .update({ read_at: new Date().toISOString() } as never)
              .eq("id", m.id);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user, profile, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !user) return;
    setSending(true);
    try {
      const { error } = await supabaseBrowser()
        .from("direct_messages")
        .insert({ conversation_id: conversationId, sender_id: user.id, body: body.slice(0, 1000) } as never);
      if (error) throw new Error(error.message);
      setDraft("");
    } catch (e) {
      toast.error("Não deu enviar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TopBar
        title={mate ? displayName(mate.name) : "Conversa"}
        subtitle={backLabel}
      />
      <div className="mx-auto flex min-h-[calc(100dvh-220px)] max-w-md flex-col p-4 pb-28">
        <Link
          href={backHref}
          className="tactile mb-3 inline-flex w-fit items-center gap-1 text-[12px] font-bold text-brand"
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </Link>
        {loading ? (
          <SkeletonList rows={5} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => window.location.reload()} />
        ) : (
          <>
            {mate ? (
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  {mate.avatar_url ? <AvatarImage src={mate.avatar_url} alt={mate.name ?? ""} /> : null}
                  <AvatarFallback className="bg-secondary text-[11px] text-secondary-foreground">
                    {(mate.name?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[13px] font-bold text-foreground">{displayName(mate.name)}</p>
              </div>
            ) : null}
            <div className="flex-1 space-y-2">
              {msgs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
                  Sem mensagens ainda. Diga oi para começar.
                </p>
              ) : (
                msgs.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-3 py-2",
                          mine
                            ? "rounded-br-sm bg-brand text-brand-foreground"
                            : "rounded-bl-sm border border-white/[0.07] bg-white/[0.04] text-foreground"
                        )}
                      >
                        <p className="text-[13px] leading-snug">{m.body}</p>
                        <p className={cn("mt-0.5 text-right text-[9px]", mine ? "text-brand-foreground/70" : "text-muted-foreground")}>
                          {formatRelative(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="sticky bottom-24 mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Escreva sua mensagem..."
                maxLength={1000}
                aria-label="Mensagem"
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                aria-label="Enviar mensagem"
                className="tactile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
