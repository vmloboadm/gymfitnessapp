"use client";

import Link from "next/link";
import { Bell, CloudOff } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { OnlineCounter } from "~/components/layout/OnlineCounter";
import { DemoRoleSwitcher } from "~/components/layout/DemoRoleSwitcher";
import { GymLogo } from "~/components/layout/GymLogo";
import { cn } from "~/lib/utils";
import { isDemoMode } from "~/lib/demo-bridge";

/**
 * TopBar: logo + título + contador online + sino + badge offline.
 */
export function TopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  offlineCount?: number;
}) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[#020D21]/90 backdrop-blur supports-[backdrop-filter]:bg-[#020D21]/70">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <GymLogo showName={false} size={34} href="/" />
          <div className="min-w-0 flex-1">
            {/* Título nunca corta no meio: quebra por palavra inteira se faltar espaço */}
            <h1 className="break-words text-[15px] font-bold leading-snug text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDemoMode() && <DemoRoleSwitcher />}
          <OnlineCounter gymId={profile?.gym_id} className="hidden sm:flex" />
          <Link
            href="/notificacoes"
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:text-foreground"
            )}
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Badge offline — "X ações pendentes de sincronizar" (blueprint §5.5).
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