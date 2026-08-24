"use client";

import {
  Flame,
  Dumbbell,
  Scissors,
  HeartPulse,
  Activity,
  Check,
} from "lucide-react";
import { cn } from "~/lib/utils";

const GOALS = [
  { id: "perder_peso", label: "Perder peso", icon: Flame, desc: "Foco em déficit calórico e alta frequência" },
  { id: "ganhar_massa", label: "Ganhar massa", icon: Dumbbell, desc: "Hipertrofia com foco em carga progressiva" },
  { id: "definir", label: "Definir músculos", icon: Scissors, desc: "Redução de gordura + manutenção de massa" },
  { id: "condicionamento", label: "Condicionamento", icon: HeartPulse, desc: "Resistência e cardio combinados" },
  { id: "saude", label: "Saúde geral", icon: Activity, desc: "Bem-estar, mobilidade e constância" },
] as const;

export function GoalSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Qual seu principal objetivo?
      </label>
      <div className="grid gap-2">
        {GOALS.map((g) => {
          const active = value === g.id;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange(g.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all active:scale-[0.99]",
                active
                  ? "border-brand bg-brand/10"
                  : "border-border bg-card/40 hover:bg-card/70"
              )}
            >
              <Icon
                className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-brand" : "text-muted-foreground")}
                strokeWidth={1.8}
              />
              <span className="flex-1">
                <span className={cn("block text-sm font-semibold", active && "text-brand")}>
                  {g.label}
                </span>
                <span className="block text-xs text-muted-foreground">{g.desc}</span>
              </span>
              {active && <Check className="mt-0.5 h-4 w-4 text-brand" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}