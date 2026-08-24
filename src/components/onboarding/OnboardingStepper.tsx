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

/** Stepper visual do onboarding (não navega sozinho — só exibe o progresso). */
export function OnboardingStepper({ current, maxReached }: { current: number; maxReached: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progresso do cadastro">
      {STEPS.map((s) => {
        const active = s.id === current;
        const done = s.id <= maxReached;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-1.5">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done
                  ? "bg-brand text-white"
                  : active
                    ? "bg-brand/25 text-brand ring-1 ring-brand"
                    : "bg-secondary text-muted-foreground"
              )}
            >
              {done && s.id !== current ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                s.id
              )}
            </span>
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