"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import {
  Activity,
  BicepsFlexed,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Mountain,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BottomSheet } from "~/components/ui/bottom-sheet";

/** Ícone do grupo pelo nome do exercício (sem emoji, identidade Lucide). */
export function iconForExercise(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/esteira|bike|corrida|cardio|remo/.test(n)) return HeartPulse;
  if (/rosca|bíceps|biceps/.test(n)) return BicepsFlexed;
  if (/tríceps|triceps|corda|francês/.test(n)) return Zap;
  if (/agachamento|leg press|extensora|flexora|perna|afundo/.test(n)) return Footprints;
  if (/remada|puxada|barra fixa|pulldown|dorsal/.test(n)) return Mountain;
  if (/desenvolvimento|elevação|elevacao|ombro/.test(n)) return Zap;
  if (/supino|crucifixo|peck|voador|peito/.test(n)) return Dumbbell;
  if (/prancha|abdom|core/.test(n)) return Flame;
  return Activity;
}

export type ExerciseDetail = {
  name: string;
  info?: string | null;
  tips?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Ficha técnica do exercício (Bottom Sheet): foto de execução,
 * passo-a-passo curto e CTA para o vídeo no YouTube.
 */
export function ExerciseInfoSheet({
  ex,
  onClose,
}: {
  ex: ExerciseDetail | null;
  onClose: () => void;
}) {
  const Icon = ex ? iconForExercise(ex.name) : Dumbbell;
  const steps = ex
    ? [
        ex.tips?.[0] ?? "Posição inicial estável, coluna neutra.",
        "Execução com cadência controlada (2s descendo, 1s subindo).",
        "Registre a carga e a sensação — evolua na próxima sessão.",
      ]
    : [];

  return (
    <BottomSheet open={!!ex} onClose={onClose}>
      {ex ? (
        <>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="min-w-0 text-base font-black leading-tight text-foreground">{ex.name}</h3>
          </div>

          <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/[0.06]">
            <Image
              src={ex.imageUrl ?? "/workout/workout-strength.jpg"}
              alt={`Execução de ${ex.name}`}
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" aria-hidden />
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            {ex.info ?? "Execução padrão do exercício, no controle e sem roubar postura."}
          </p>

          <p className="gf-section mt-4 mb-1.5">Como fazer</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
                  {i + 1}
                </span>
                <span className="text-[12.5px] leading-snug text-foreground">{s}</span>
              </li>
            ))}
          </ol>

          {ex.videoUrl ? (
            <a
              href={ex.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gf-touch tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF0000] py-3.5 text-sm font-black text-white shadow-lg transition-transform active:scale-[0.98]"
            >
              <Play className="h-5 w-5 fill-current" /> Ver vídeo no YouTube
            </a>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}
