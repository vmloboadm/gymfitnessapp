"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { MessageSquareText, Dumbbell, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listAssignedWorkouts,
  markAllSeen,
  unseenCount,
  TRAINER_WORKOUTS_EVENT,
  type AssignedWorkout,
} from "~/lib/trainer-store";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

/**
 * Seção "Do seu Personal" no treino do aluno: treinos enviados pelo
 * Co-Pilot (demo via trainer-store; produção via workout_programs).
 * Treino novo gera toast + badge NOVO (notificação única).
 */
export function PersonalWorkouts({ studentId }: { studentId?: string }) {
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([]);

  useEffect(() => {
    const hydrate = () => setWorkouts(listAssignedWorkouts().slice(0, 5));
    hydrate();
    window.addEventListener(TRAINER_WORKOUTS_EVENT, hydrate);
    window.addEventListener("storage", hydrate);
    return () => {
      window.removeEventListener(TRAINER_WORKOUTS_EVENT, hydrate);
      window.removeEventListener("storage", hydrate);
    };
  }, []);

  // notificação única por treino novo
  useEffect(() => {
    const n = unseenCount();
    if (n > 0) {
      toast.success(
        n === 1 ? "Novo treino do seu Personal!" : `${n} novos treinos do seu Personal!`,
        { description: "Confira a seção Do seu Personal." }
      );
      markAllSeen();
    }
  }, [workouts.length]);

  if (workouts.length === 0) return null;

  return (
    <section aria-labelledby="personal-workouts-title">
      <h2
        id="personal-workouts-title"
        className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        <UserRoundCheck className="h-4 w-4 text-brand" />
        Do seu Personal
      </h2>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
        {workouts.map((w, idx) => (
          <motion.article key={w.id} variants={item} className="gf-card gf-glass !p-4">
            {idx === 0 ? (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-foreground">
                Novo
              </span>
            ) : null}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                  <Dumbbell className="h-3.5 w-3.5 shrink-0 text-brand" />
                  {w.name}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {w.frequency} · {w.level} · enviado pelo seu Personal
                </p>
              </div>
            </div>

            {w.plan && w.plan.dias.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {w.plan.dias.map((d, di) => (
                  <div key={di} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[11px] font-bold text-brand">{d.nome}</p>
                    <p className="text-[9.5px] text-muted-foreground">{d.foco}</p>
                    <ul className="mt-1 divide-y divide-white/[0.05]">
                      {d.exercicios.slice(0, 3).map((e, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 py-1">
                          <p className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-foreground">
                            {i + 1}. {e.exercicio}
                          </p>
                          <p className="shrink-0 text-[9.5px] tabular-nums text-muted-foreground">
                            {e.series}x {e.reps} · RPE {e.rpe}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {d.exercicios.length > 3 ? (
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        + {d.exercicios.length - 3} exercícios neste dia
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {w.exercises.slice(0, 4).map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{e.name}</p>
                      <p className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {e.sets}x {e.reps}
                      </p>
                    </li>
                  ))}
                </ul>
                {w.exercises.length > 4 ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    + {w.exercises.length - 4} exercícios na ficha completa
                  </p>
                ) : null}
              </>
            )}

            {w.notes ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-brand/25 bg-brand/[0.08] p-2.5 text-[11px] leading-snug text-brand">
                <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w.notes}
              </p>
            ) : null}

            <LoadRequestButton workoutName={w.name} />
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

/** Pedido de ajuste de carga: cai na caixa de aprovações do personal. */
function LoadRequestButton({ workoutName }: { workoutName: string }) {
  const [sent, setSent] = useState(false);

  // createApproval via import dinâmico pesado; import estático direto
  const request = async () => {
    const { createApproval } = await import("~/lib/trainer-store");
    createApproval({
      studentId: "student-self",
      studentName: "Você",
      type: "carga",
      message: `Pedido de ajuste de carga no treino "${workoutName}". A última sessão pesou mais que o normal.`,
    });
    setSent(true);
    toast.success("Pedido enviado ao seu Personal");
  };

  if (sent) {
    return (
      <p className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center text-[10px] font-semibold text-muted-foreground">
        Pedido de ajuste enviado, aguarde a resposta do Personal.
      </p>
    );
  }
  return (
    <button
      onClick={request}
      className="tactile mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-brand"
    >
      Pedir ajuste de carga
    </button>
  );
}
