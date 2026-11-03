"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { setErrorSink } from "~/lib/logger";
import { captureClient, flushOnHide, setMonitorTokenGetter } from "~/lib/monitoring/client";
import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Liga o monitoramento de erros no navegador (montado 1x nos providers):
 * - logger.error (telas de erro, falhas tratadas no código);
 * - erros de JS soltos e promises rejeitadas sem catch;
 * - todo toast.error: é o aviso vermelho que o aluno vê, então cada um
 *   é uma falha que chegou na pessoa.
 * Não muda nada na tela.
 */

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /AbortError|The user aborted a request/i,
];

function isNoise(message: string, stack?: string | null): boolean {
  return NOISE.some((re) => re.test(message) || (stack ? re.test(stack) : false));
}

function toText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

type ToastError = typeof toast.error & { __gfPatched?: boolean };

export function ErrorMonitor() {
  useEffect(() => {
    setMonitorTokenGetter(async () => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    });

    setErrorSink((event, error, data) => captureClient("error", event, error, data));

    const onError = (e: ErrorEvent) => {
      const err = e.error ?? e.message;
      const msg = e.error instanceof Error ? e.error.message : String(e.message ?? "");
      if (isNoise(msg, e.error instanceof Error ? e.error.stack : e.filename)) return;
      captureClient("error", "js.uncaught", err, { file: e.filename, line: e.lineno, col: e.colno });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : typeof r === "string" ? r : "";
      if (isNoise(msg, r instanceof Error ? r.stack : null)) return;
      captureClient("error", "js.unhandled_rejection", r ?? "rejeição sem motivo");
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushOnHide();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onHide);

    // toast.error → registra o aviso que o aluno viu (mantém o comportamento)
    const original = toast.error as ToastError;
    if (!original.__gfPatched) {
      const patched = ((message: Parameters<typeof toast.error>[0], opts?: Parameters<typeof toast.error>[1]) => {
        const text = toText(message);
        if (text) {
          captureClient("toast", "toast.error", text, {
            description: toText(opts?.description) || undefined,
          });
        }
        return original(message, opts);
      }) as ToastError;
      patched.__gfPatched = true;
      (toast as { error: ToastError }).error = patched;
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onHide);
      setErrorSink(null);
    };
  }, []);

  return null;
}
