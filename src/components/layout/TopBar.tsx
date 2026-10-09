"use client";

import Link from "next/link";
import { Bell, CloudOff } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useNotifications } from "~/hooks/useNotifications";
import { OnlineCounter } from "~/components/layout/OnlineCounter";
import { GymLogo } from "~/components/layout/GymLogo";
import { cn } from "~/lib/utils";

/**
 * TopBar: logo + título + contador online + sino + badge offline.
 * O sino mostra a bolinha de não lidas (central de notificações).
 */
export function TopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  offlineCount?: number;
}) {
  const { user, profile } = useAuth();
  const { unread } = useNotifications(user?.id);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[#020D21]/90 backdrop-blur supports-[backdrop-filter]:bg-[#020D21]/70">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <GymLogo showName={false} size={34} href="/" />
          <div className="min-w-0 flex-1">
            {/* NADA corta aqui: título e subtítulo quebram por palavra inteira;
                o cabeçalho cresce naturalmente quando precisar */}
            <h1 className="break-words text-[15px] font-bold leading-snug text-foreground sm:text-base">
              {title}
            </h1>
            {subtitle ? (
              <p className="break-words text-[11px] leading-snug text-muted-foreground" suppressHydrationWarning>{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OnlineCounter gymId={profile?.gym_id} />
          <Link
            href="/notificacoes"
            className={cn(
              "relative flex h-9 w-9 gf-touch items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:text-foreground"
            )}
            aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black text-brand-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Badge offline, "X ações pendentes de sincronizar" (blueprint §5.5).
 */
export function OfflineBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        "mt-1 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning",
        className
      )}
    >
      <CloudOff className="h-3.5 w-3.5" />
      <span className="font-mono font-semibold">{count}</span>
      <span>ações pendentes de sincronizar</span>
    </div>
  );
}