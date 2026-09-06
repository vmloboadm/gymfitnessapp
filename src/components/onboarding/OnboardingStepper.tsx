"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

const STEPS = [
  { id: 1, label: "Dados" },
  { id: 2, label: "Anamnese" },
  { id: 3, label: "Métricas" },
  { id: 4, label: "Saúde" },
  { id: 5, label: "Revisar" },
] as const;

/** Stepper do onboarding: etapas concluídas são clicáveis (voltar e corrigir). */
export function OnboardingStepper({
  current,
  maxReached,
  onBack,
}: {
  current: number;
  maxReached: number;
  onBack?: (step: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progresso do cadastro">
      {STEPS.map((s) => {
        const active = s.id === current;
        const done = s.id <= maxReached;
        const clickable = !!onBack && s.id < current && s.id <= maxReached;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onBack?.(s.id)}
              aria-label={clickable ? `Voltar para etapa ${s.id}: ${s.label}` : `Etapa ${s.id}: ${s.label}`}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done
                  ? "bg-brand text-white"
                  : active
                    ? "bg-brand/25 text-brand ring-1 ring-brand"
                    : "bg-secondary text-muted-foreground",
                clickable && "cursor-pointer hover:ring-2 hover:ring-brand/60"
              )}
            >
              {done && s.id !== current ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                s.id
              )}
            </button>
            {s.id < STEPS.length && (
              <span
                className={cn(
                  "h-px flex-1 rounded",
                  s.id < maxReached ? "bg-brand" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { STEPS };