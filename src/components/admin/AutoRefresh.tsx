"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Indicador "ao vivo" do painel: conta os segundos desde a última carga e
 * recarrega os dados do servidor a cada intervalo (router.refresh() mantém
 * a página aberta e só refaz as queries do server component).
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [sec, setSec] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setSec((s) => s + 1), 1000);
    const refresh = setInterval(() => {
      setBusy(true);
      router.refresh();
      setSec(0);
      setTimeout(() => setBusy(false), 800);
    }, intervalMs);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        ao vivo
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {sec}s
      </span>
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          router.refresh();
          setSec(0);
          setTimeout(() => setBusy(false), 800);
        }}
        aria-label="Atualizar agora"
        className="rounded-lg border border-border bg-card/60 p-1.5 text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
