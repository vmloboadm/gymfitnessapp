"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";

export type ExerciseCardData = {
  id: string;
  name: string;
  category: string;
  muscles?: string[] | null;
  tips?: string[] | null;
};

/**
 * Card de exercício vinculado a um equipamento.
 * Usado na página da máquina (/maquina/[id]) e reutilizável
 * em qualquer lista de exercícios por aparelho.
 * Não altera fotos de execução nem o mapa muscular — só texto.
 */
export function ExerciseCard({ exercise }: { exercise: ExerciseCardData }) {
  const muscles = (exercise.muscles ?? []).slice(0, 3).join(" · ") || exercise.category;
  const firstTip = (exercise.tips ?? [])[0] ?? null;

  return (
    <Link
      href={`/equipamento?busca=${encodeURIComponent(exercise.name)}`}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-brand/30"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
        <Dumbbell className="h-3.5 w-3.5 text-brand" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{exercise.name}</p>
        <p className="text-[10px] capitalize text-muted-foreground">{muscles}</p>
        {firstTip ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] italic text-muted-foreground/80">
            💡 {firstTip}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
