import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para gerenciar timeout automático de sessão de equipamento.
 * - Inicia um timer de 5-6 minutos ao iniciar a sessão.
 * - Reset do timer em qualquer interação do usuário.
 * - Callback de expiração que fecha a sessão automaticamente.
 */
export function useSessionTimeout(
  activeSessionId: string | null,
  onExpire: () => void,
  durationMs: number = 5 * 60 * 1000
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [remaining, setRemaining] = useState(durationMs);

  // mantém o callback mais recente sem reiniciar o timer a cada render
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const armTimer = useCallback(() => {
    clearTimer();
    setRemaining(durationMs);
    timeoutRef.current = setTimeout(() => expireRef.current(), durationMs);
  }, [clearTimer, durationMs]);

  // Atualiza o countdown a cada segundo quando ativo
  useEffect(() => {
    if (!activeSessionId) {
      clearTimer();
      setRemaining(durationMs);
      return;
    }

    if (!timeoutRef.current) {
      armTimer();
    }

    const tick = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(tick);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
    };
  }, [activeSessionId, durationMs, armTimer, clearTimer]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    resetTimer: armTimer,
    clearTimer,
    remaining,
    remainingLabel: formatTime(remaining),
  };
}

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
