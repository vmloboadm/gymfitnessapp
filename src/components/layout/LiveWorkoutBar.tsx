"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useWorkoutSession, elapsedSeconds, formatMMSS, sessionPhase } from "~/lib/workout-session";
import { cn } from "~/lib/utils";

export function LiveWorkoutBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useWorkoutSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  const show = !!session && pathname !== "/treino";
  const elapsed = show ? elapsedSeconds(session.startedAt, now) : 0;
  const phase = show ? sessionPhase(session.startedAt, now) : "ok";

  return (
    <AnimatePresence>
      {show ? (
        <m.button
          key="live-workout-bar"
          initial={{ y: 60, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          onClick={() => router.push("/treino")}
          aria-label="Treino em andamento, voltar para a sessão"
          data-testid="live-workout-bar"
          className={cn(
            "gf-touch tactile fixed inset-x-4 z-30 mx-auto flex max-w-[calc(28rem-2rem)] items-center gap-2.5 rounded-full border py-2 pl-3.5 pr-2 shadow-lg backdrop-blur transition-colors",
            phase === "alerta"
              ? "border-warning/50 bg-warning/15"
              : "border-success/40 bg-[#0B1426]/90"
          )}
          style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", phase === "alerta" ? "bg-warning" : "bg-success")} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[11px] font-black uppercase tracking-wide text-foreground">
              Treino em andamento
            </span>
          </span>
          <span className="shrink-0 text-sm font-black tabular-nums text-brand">{formatMMSS(elapsed)}</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <ChevronRight className="h-4 w-4 text-brand" />
          </span>
        </m.button>
      ) : null}
    </AnimatePresence>
  );
}
