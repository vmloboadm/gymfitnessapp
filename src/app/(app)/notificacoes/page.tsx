"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Inbox, Flame, Trophy, Award, Megaphone, Target } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useNotifications } from "~/hooks/useNotifications";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, EmptyState } from "~/components/common/AsyncStates";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatRelative } from "~/lib/utils/format";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { isDemoMode } from "~/lib/demo-bridge";

type NotifItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  kind?: "streak" | "desafio" | "conquista" | "aviso" | "meta";
};

const KIND_ICON = {
  streak: Flame,
  desafio: Trophy,
  conquista: Award,
  aviso: Megaphone,
  meta: Target,
} as const;

const DEMO_NOTIFS: NotifItem[] = [
  {
    id: "dn-1",
    kind: "streak",
    title: "Sequência em risco! 🔥",
    body: "Você está a 1 treino de manter sua sequência de 8 dias. Corre pra academia hoje!",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    read_at: null,
  },
  {
    id: "dn-2",
    kind: "desafio",
    title: "Desafio da semana aberto",
    body: "Leg Press Total: quem mover mais volume até domingo vence. 12 pessoas já entraram.",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    read_at: null,
  },
  {
    id: "dn-3",
    kind: "conquista",
    title: "Conquista liberada: Semana Completa ⚡",
    body: "Você bateu a meta semanal com folga. +120 pts no seu ranking!",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    read_at: new Date(Date.now() - 80000000).toISOString(),
  },
  {
    id: "dn-4",
    kind: "aviso",
    title: "Recado do personal Rafael",
    body: "Amanhã temos substituição: supino reto sai, entra supino inclinado com halteres.",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    read_at: null,
  },
  {
    id: "dn-5",
    kind: "meta",
    title: "Faltam 2 treinos pra meta do mês",
    body: "Seu plano prevê mais 2 sessões até sexta. Você consegue fechar os 12 treinos!",
    created_at: new Date(Date.now() - 259200000).toISOString(),
    read_at: new Date(Date.now() - 250000000).toISOString(),
  },
];

/**
 * Central de notificações in-app (blueprint §5.4).
 * Usa o hook useNotifications (realtime por usuário + markAllRead).
 * No modo demo mostra uma central viva com interação local.
 */
export default function NotificacoesPage() {
  const { user } = useAuth();
  const demo = isDemoMode();
  const hook = useNotifications(user?.id);

  // estado local só para o modo demo
  const [demoReads, setDemoReads] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // SW já registrado no provider; aqui garantimos p/ push
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const items: NotifItem[] = useMemo(
    () => (demo ? DEMO_NOTIFS : (hook.items as NotifItem[])),
    [demo, hook.items]
  );
  const loading = demo ? false : hook.loading;
  const unread = demo ? items.filter((n) => !(n.read_at || demoReads[n.id])).length : hook.unread;

  const markAllRead = () => {
    navigator.vibrate?.(30);
    if (demo) {
      setDemoReads(Object.fromEntries(DEMO_NOTIFS.map((n) => [n.id, true])));
      toast.success("Tudo marcado como lido");
      return;
    }
    hook.markAllRead();
  };

  return (
    <>
      <TopBar title="Notificações" subtitle={unread ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo lido"} />
      <div className="space-y-6 p-4">
        {items.length > 0 ? (
          <Button variant="outline" size="sm" className="gf-rise w-full" onClick={markAllRead}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Marcar todas como lidas
          </Button>
        ) : null}

        {loading ? (
          <SkeletonList rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma notificação"
            description="Check-ins, treinos e desafios aparecem aqui."
            icon={Inbox}
          />
        ) : (
          <div className="space-y-2">
            {items.map((n, i) => {
              const isRead = !!n.read_at || !!demoReads[n.id];
              const KindIcon = n.kind && n.kind in KIND_ICON ? KIND_ICON[n.kind as keyof typeof KIND_ICON] : Bell;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "gf-rise flex items-start gap-3 rounded-xl border bg-card/40 p-4",
                    isRead ? "border-border" : "border-brand/40 bg-brand/5"
                  )}
                  style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isRead ? "bg-secondary/60" : "bg-brand/15"
                    )}
                  >
                    <KindIcon className={cn("h-4 w-4", isRead ? "text-muted-foreground" : "text-brand")} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
                      {!isRead ? <Badge variant="default">Nova</Badge> : null}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    <p className="text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
