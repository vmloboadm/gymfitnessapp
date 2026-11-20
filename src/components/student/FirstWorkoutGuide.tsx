"use client";

import Link from "next/link";
import { Check, Dumbbell, ScanLine, Trophy } from "lucide-react";

/**
 * Primeiro treino guiado: aparece na Home só para quem ainda não registrou
 * nenhum treino e já tem plano liberado. Três passos, um botão por vez.
 * Some sozinho assim que o aluno registra o primeiro treino.
 */
export function FirstWorkoutGuide({
  firstName,
  checkedIn,
  workoutTitle,
  exerciseCount,
}: {
  firstName: string;
  checkedIn: boolean;
  workoutTitle: string;
  exerciseCount: number;
}) {
  const steps = [
    { label: "Faça o check-in na academia", done: checkedIn, icon: ScanLine },
    { label: `Abra o treino: ${workoutTitle}`, done: false, icon: Dumbbell },
    { label: "Registre as séries e finalize", done: false, icon: Trophy },
  ];
  const currentIndex = checkedIn ? 1 : 0;
  const cta = checkedIn
    ? { href: "/treino?start=1", label: "Começar treino" }
    : { href: "/checkin", label: "Fazer check-in" };

  return (
    <section
      aria-label="Seu primeiro treino"
      className="mx-4 mb-5 overflow-hidden rounded-2xl border border-[#F4711E]/40 bg-card/90 p-4 shadow-[0_0_24px_rgba(244,113,30,0.18)]"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#F4711E]">🏋️ Seu primeiro treino</p>
      <h2 className="mt-1 text-[17px] font-black leading-snug">
        {firstName}, seu treino está pronto. Três passos e você começa.
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {exerciseCount} exercícios esperando por você hoje.
      </p>

      <ol className="mt-4 space-y-2.5">
        {steps.map((s, i) => {
          const Icon = s.done ? Check : s.icon;
          const isCurrent = i === currentIndex && !s.done;
          return (
            <li
              key={s.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isCurrent ? "bg-[#F4711E]/15" : "bg-white/[0.03]"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  s.done ? "bg-success text-black" : isCurrent ? "bg-[#F4711E] text-black" : "bg-white/10 text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={`text-[13px] font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <Link
        href={cta.href}
        className="tactile mt-4 block rounded-2xl bg-[#F4711E] px-5 py-3.5 text-center text-[14px] font-black text-black shadow-[0_0_20px_rgba(244,113,30,0.4)] transition-transform active:scale-[0.98]"
      >
        {cta.label}
      </Link>
    </section>
  );
}
