"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, ClipboardList, Flame, Dumbbell, Plus, Activity, Sparkles } from "lucide-react";
import { insightOffline } from "~/lib/ai/local-gen";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Sparkline } from "~/components/common/Sparkline";
import {
  demoPersonalStudents,
  mockWeightSeries,
  mockWorkoutHistory,
  studentStatus,
  type PersonalStudent,
} from "~/lib/personal-data";
import {
  listWorkoutsForStudent,
  streakOverride,
  TRAINER_WORKOUTS_EVENT,
} from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const TONE = {
  green: "bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  amber: "bg-[#FFC24D] shadow-[0_0_8px_rgba(255,194,77,0.8)]",
  red: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.8)]",
} as const;

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "treinos", label: "Treinos" },
  { id: "metricas", label: "Métricas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Bottom sheet detalhado do aluno com abas, reusado pelo Cockpit e pela lista. */
export function StudentSheet({
  student,
  onClose,
}: {
  student: PersonalStudent | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("resumo");

  // reseta pra aba Resumo a cada aluno aberto
  useEffect(() => {
    if (student) setTab("resumo");
  }, [student?.id]);

  // re-render quando um treino novo é atribuído
  const [, setBump] = useState(0);
  useEffect(() => {
    const bump = () => setBump((b) => b + 1);
    window.addEventListener(TRAINER_WORKOUTS_EVENT, bump);
    return () => window.removeEventListener(TRAINER_WORKOUTS_EVENT, bump);
  }, []);

  const status = student ? studentStatus(student) : null;
  const history = student ? mockWorkoutHistory(student) : [];
  const weights = student ? mockWeightSeries(student) : [];
  const assigned = student ? listWorkoutsForStudent(student.id) : [];
  const effectiveStreak = student ? (streakOverride(student.id) ?? student.streak) : 0;
  const latestWorkoutId = assigned[0]?.id;

  return (
    <BottomSheet open={!!student} onClose={onClose}>
      {student ? (
        <div className="space-y-4">
          {/* identificação */}
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-brand/60">
              <AvatarImage src={student.avatar} alt="" />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
                {student.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">{student.name}</p>
              {status ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", TONE[status.tone])} aria-hidden />
                  {status.label}
                </p>
              ) : null}
            </div>
          </div>

          {/* abas */}
          <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors",
                  tab === t.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* conteúdo da aba */}
          {tab === "resumo" ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3 w-3 text-[#FFC24D]" /> Streak
                </p>
                <p className={cn("mt-1 font-display text-lg font-black", effectiveStreak === 0 && student.streak > 0 ? "text-[#F87171]" : "text-foreground")}>
                  {effectiveStreak}d
                </p>
                {effectiveStreak === 0 && student.streak > 0 ? (
                  <p className="text-[9px] font-bold text-[#F87171]">zerado pelo personal</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Última vez
                </p>
                <p className="mt-1 text-[13px] font-bold text-foreground">
                  {student.lastTrainingDaysAgo === 0
                    ? "Hoje"
                    : `${student.lastTrainingDaysAgo}d atrás`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MessageCircle className="h-3 w-3 text-[#25D366]" /> WhatsApp
                </p>
                <p className={cn("mt-1 text-[13px] font-bold", student.whatsapp_consent ? "text-[#4ADE80]" : "text-[#F87171]")}>
                  {student.whatsapp_consent ? "Liberado" : "Sem ok"}
                </p>
              </div>
              <div className="col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Dumbbell className="h-3 w-3 text-brand" /> Treino ativo
                </p>
                <p className="mt-1 text-[13px] font-bold text-foreground">
                  {student.activeWorkout ?? "Sem treino"}
                </p>
                {student.lastRpe ? (
                  <p className="mt-0.5 text-[10px] text-[#FFC24D]">Último RPE: {student.lastRpe}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "treinos" ? (
            <div className="space-y-2">
              {assigned.length > 0 ? (
                <div className="rounded-2xl border border-brand/30 bg-brand/[0.08] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand">
                    Do seu Co-Pilot
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-foreground">
                    {assigned[0].name} · {assigned[0].exercises.length} exercícios
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {assigned[0].frequency} · enviado {fmtDate(assigned[0].created_at)}
                  </p>
                </div>
              ) : null}
              <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtDate(h.date)} · {h.sets} séries
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-[11px] font-bold tabular-nums text-brand">
                      {h.volume.toLocaleString("pt-BR")} kg
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "metricas" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-brand" /> Evolução de peso
                </p>
                <p className="mt-1 font-display text-xl font-black text-foreground">
                  {weights[weights.length - 1]} kg
                  <span
                    className={cn(
                      "ml-2 text-[11px] font-bold",
                      weights[weights.length - 1] >= weights[0] ? "text-[#4ADE80]" : "text-[#F87171]"
                    )}
                  >
                    {weights[weights.length - 1] >= weights[0] ? "+" : ""}
                    {Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10} kg no período
                  </span>
                </p>
                <div className="mt-2">
                  <Sparkline points={weights} height={56} />
                </div>
              </div>
              <div className="rounded-2xl border border-brand/25 bg-brand/[0.08] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <Sparkles className="h-3 w-3" /> Insight IA
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-foreground/90">
                  {insightOffline({
                    name: student.name,
                    streak: effectiveStreak,
                    lastTrainingDaysAgo: student.lastTrainingDaysAgo,
                    lastRpe: student.lastRpe,
                    weights,
                    activeWorkout: student.activeWorkout,
                  })}
                </p>
              </div>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10.5px] leading-snug text-muted-foreground">
                Em produção esta aba lê as medições comprovadas (foto do visor) da tabela metrics.
                No demo, série determinística por aluno.
              </p>
            </div>
          ) : null}

          {/* ações rápidas */}
          <div className="grid grid-cols-3 gap-2">
            {student.whatsapp_consent && student.phone ? (
              <a
                href={`https://wa.me/${student.phone}?text=${encodeURIComponent(
                  `Oi ${student.name.split(" ")[0]}! Passando pra acompanhar seu treino. Bora evoluir hoje?`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/15 text-[10.5px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.97]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : (
              <span className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-[10px] font-medium text-muted-foreground ring-1 ring-white/[0.06]">
                <MessageCircle className="h-4 w-4" />
                Sem ok
              </span>
            )}
            {latestWorkoutId ? (
              <Link
                href={`/personal/treinos?aluno=${student.id}&edit=${latestWorkoutId}`}
                className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand/15 text-[10.5px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.97]"
              >
                <ClipboardList className="h-4 w-4" />
                Editar Treino
              </Link>
            ) : null}
            <Link
              href={`/personal/treinos?aluno=${student.id}`}
              className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand text-[10.5px] font-bold text-brand-foreground transition-transform active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Novo Treino
            </Link>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
