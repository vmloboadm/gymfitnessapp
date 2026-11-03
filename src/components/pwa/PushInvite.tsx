"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { usePush } from "~/hooks/usePush";

/**
 * Convite para ligar as notificações (home e feed). Só aparece quando o
 * celular suporta push, a pessoa ainda não decidiu e não dispensou nos
 * últimos 7 dias. No iPhone o push só existe com o app instalado: lá quem
 * aparece é o PWAInstallBanner.
 */
const KEY = "gf_push_invite_dismissed_at";
const SNOOZE_MS = 7 * 86_400_000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function PushInvite({
  context = "home",
  ignoreSnooze = false,
}: {
  context?: "home" | "feed" | "notificacoes";
  /** na tela de notificações o convite aparece mesmo se foi adiado */
  ignoreSnooze?: boolean;
}) {
  const push = usePush();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(ignoreSnooze ? false : snoozed());
  }, [ignoreSnooze]);

  if (hidden || !push.supported || push.permission !== "default" || push.active) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* sem storage: só esconde agora */
    }
    setHidden(true);
  };

  const enable = async () => {
    const ok = await push.enable();
    if (ok) {
      toast.success("Notificações ligadas! Você fica sabendo na hora.");
      setHidden(true);
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      toast.message("Notificações bloqueadas", {
        description: "Dá para liberar depois nas configurações do navegador.",
      });
      setHidden(true);
    }
  };

  return (
    <div className="gf-rise flex items-center gap-3 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/20 via-card to-card p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-black text-foreground">Ative as notificações</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
          {context === "feed"
            ? "Saiba na hora quando curtirem ou comentarem suas conquistas."
            : context === "notificacoes"
              ? "Estes avisos também podem chegar no celular, mesmo com o app fechado."
              : "Conquistas, recordes, curtidas e treino novo chegam direto no celular."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void enable()}
        disabled={push.enabling}
        className="tactile shrink-0 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-black text-brand-foreground disabled:opacity-60"
      >
        {push.enabling ? "…" : "Ativar"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar convite de notificações"
        className="tactile shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
