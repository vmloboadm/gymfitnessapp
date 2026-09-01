"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { MessageSquareText, Dumbbell, UserRoundCheck } from "lucide-react";
import {
  listAssignedWorkouts,
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
 * Co-Pilot do personal (demo via trainer-store; produção via workout_programs).
 */
export function PersonalWorkouts() {
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
        {workouts.map((w) => (
          <motion.article key={w.id} variants={item} className="gf-card gf-glass !p-4">
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

            {w.notes ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-brand/25 bg-brand/[0.08] p-2.5 text-[11px] leading-snug text-brand">
                <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w.notes}
              </p>
            ) : null}
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
