"use client";

import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  elapsedSeconds,
  formatMMSS,
  sessionPhase,
} from "~/lib/workout-session";

/**
 * Cronômetro AUTO-CONTIDO da sessão: o tick de 1s re-renderiza SÓ este
 * componente (não a árvore inteira). Três fases:
 *   verde <2h · âmbar pulsante >=2h com pergunta obrigatória · encerra em 4h.
 */
export function SessionClock({
  startedAt,
  onFinish,
  compact = false,
  fast = false,
}: {
  startedAt: number;
  /** Chamado quando o usuário escolhe encerrar (ou o sistema expira). */
  onFinish?: () => void;
  compact?: boolean;
  /** Demo acelerado: 1 minuto real = 1 hora simulada (valida alerta 2h em 2min). */
  fast?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [ackUntil, setAckUntil] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // no modo rápido multiplicamos o tempo decorrido por 60
  const mult = fast ? 60 : 1;
  const simNow = startedAt + (now - startedAt) * mult;

  const phase = sessionPhase(startedAt, simNow);
  const secs = elapsedSeconds(startedAt, simNow);

  if (phase === "expirada") {
    return (
      <span className="text-[11px] font-bold text-warning">
        Encerrada automaticamente após 4h
      </span>
    );
  }

  const alerta = phase === "alerta" && Date.now() > ackUntil;

  if (compact) {
    return (
      <span
        className={cn("pm-num text-[18px] leading-none", alerta ? "text-warning" : "text-foreground")}
      >
        {formatMMSS(secs)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            alerta ? "bg-warning" : "bg-success"
          )}
        />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", alerta ? "bg-warning" : "bg-success")} />
      </span>
      <m.span
        className={cn("pm-num text-[18px] leading-none", alerta ? "text-warning" : "text-foreground")}
        animate={alerta ? { scale: [1, 1.06, 1] } : undefined}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        {formatMMSS(secs)}
      </m.span>
      {alerta ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Ainda treinando?</span>
          <button
            onClick={() => setAckUntil(Math.ceil(Date.now() / 3600000) * 3600000)}
            className="tactile rounded-full border border-warning/50 px-2.5 py-0.5 text-[10px] font-bold text-warning"
          >
            Sim
          </button>
          {onFinish ? (
            <button
              onClick={() => { navigator.vibrate?.([60, 40, 60]); onFinish(); }}
              className="tactile rounded-full bg-success px-2.5 py-0.5 text-[10px] font-black text-black"
            >
              Encerrar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
