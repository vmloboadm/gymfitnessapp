"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  enablePush,
  isPushSupported,
  unsubscribePush,
  type PushEnableResult,
} from "~/lib/push-client";
import { logger } from "~/lib/logger";

/** O que dizer para cada falha — nunca deixar o botão "sem resposta". */
function explain(r: Extract<PushEnableResult, { ok: false }>) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const installed =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  switch (r.reason) {
    case "denied":
      toast.error("Notificações bloqueadas neste aparelho", {
        duration: 9000,
        description: installed && android
          ? "Abra Configurações do celular → Apps → GymFitness → Notificações → Permitir."
          : ios
            ? "Abra Ajustes do iPhone → Notificações → GymFitness → Permitir."
            : "Toque no cadeado (ou ⓘ) ao lado do endereço do site → Notificações → Permitir. Depois toque em Ativar de novo.",
      });
      return;
    case "dismissed":
      toast.message("Falta confirmar", {
        duration: 8000,
        description: android || ios
          ? "Toque em Ativar de novo e escolha Permitir."
          : "Toque em Ativar de novo e escolha Permitir. Se nada aparecer, clique no sininho riscado na barra de endereço.",
      });
      return;
    case "unsupported":
      toast.message(ios ? "Instale o app primeiro" : "Este navegador não recebe notificações", {
        description: ios ? "No iPhone os avisos só funcionam com o app na Tela de Início." : "Use o Chrome, Edge ou Firefox.",
      });
      return;
    case "sw_timeout":
      toast.error("O app ainda está carregando", { description: "Feche e abra o app de novo e toque em Ativar." });
      return;
    default:
      toast.error("Não foi possível ativar agora", { description: "Tente de novo em instantes." });
  }
}

type PushPermission = NotificationPermission | "unsupported";

/**
 * Estado do Web Push no dispositivo: suporte, permissão e progresso.
 * enable/disable devolvem booleano para a UI mostrar toast sem quebrar.
 */
export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [active, setActive] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission("unsupported");
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setActive(!!sub))
      .catch(() => {
        /* sem SW ainda: fica inativo */
      });
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      explain({ ok: false, reason: "unsupported" });
      return false;
    }
    setEnabling(true);
    try {
      // enablePush pede a permissão ANTES de qualquer espera (gesto do toque)
      const r = await enablePush();
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");
      setActive(r.ok);
      if (!r.ok) {
        if (r.reason !== "dismissed" && r.reason !== "denied") {
          logger.error("push.enable_failed", r.detail ?? r.reason, { reason: r.reason });
        }
        explain(r);
      }
      return r.ok;
    } catch (err) {
      logger.error("push.enable_crash", err);
      explain({ ok: false, reason: "subscribe_failed" });
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");
      setActive(false);
      return false;
    } finally {
      setEnabling(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setEnabling(true);
    try {
      const ok = await unsubscribePush();
      setActive(false);
      return ok;
    } catch {
      return false;
    } finally {
      setEnabling(false);
    }
  }, []);

  return { supported, permission, active, enabling, enable, disable };
}
