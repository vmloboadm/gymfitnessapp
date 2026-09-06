"use client";

import { useEffect, useRef, useState } from "react";
import { m, type Variants } from "framer-motion";
import { MessageSquareText, Dumbbell, UserRoundCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TRAINER_WORKOUTS_EVENT, type AssignedWorkout } from "~/lib/trainer-store";
import { useAuth } from "~/hooks/useAuth";
import { fetchMyAssignedPlans, submitRequest } from "~/lib/gym-api";

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
 * do personal (demo via trainer-store; produção via workout_programs).
 * Treino novo gera toast + badge NOVO (notificação única).
 */
export function PersonalWorkouts({ studentId }: { studentId?: string }) {
  const { user, profile } = useAuth();
  const gymId = profile?.gym_id ?? "";
  const uid = user?.id ?? studentId ?? "student-self";
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    const hydrate = () =>
      fetchMyAssignedPlans(uid, gymId)
        .then((rows) => { if (alive) { setWorkouts(rows.slice(0, 5)); setLoaded(true); } })
        .catch(() => { if (alive) setLoaded(true); });
    hydrate();
    const t = setInterval(() => { if (document.visibilityState === 'visible') hydrate(); }, 20000); // produção: plano novo aparece sozinho
    window.addEventListener(TRAINER_WORKOUTS_EVENT, hydrate);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(TRAINER_WORKOUTS_EVENT, hydrate);
    };
  }, [gymId, uid]);

  // notificação quando um plano chega (demo usa contador; produção usa evento + interval)
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const novos = workouts.filter((w) => !seen.current.has(w.id));
    if (novos.length > 0 && seen.current.size > 0) {
      toast.success(
        novos.length === 1 ? "Novo treino do seu Personal!" : `${novos.length} novos treinos do seu Personal!`,
        { description: "Confira a seção Do seu Personal." }
      );
    }
    for (const w of novos) seen.current.add(w.id);
  }, [workouts]);

  if (!loaded) {
    return (
      <section aria-label="Carregando treinos do personal">
        <div className="h-5 w-36 animate-pulse rounded-md bg-white/[0.06]" />
        <div className="mt-2 space-y-2">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      </section>
    );
  }

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
      <m.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
        {workouts.map((w, idx) => (
          <m.article key={w.id} variants={item} className="gf-card gf-glass !p-4">
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

            <AdjustRequestCard workoutName={w.name} studentId={studentId} />
          </m.article>
        ))}
      </m.div>
    </section>
  );
}

/** Pedido de ajuste de treino: cai na caixa de aprovações do personal. */
function AdjustRequestCard({ workoutName, studentId }: { workoutName: string; studentId?: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const uid = user?.id ?? studentId ?? "student-self";

  const OPTIONS = [
    { label: "Carga leve demais", msg: `a carga está leve demais` },
    { label: "Carga pesada demais", msg: `a carga está pesada demais` },
    { label: "Trocar exercício", msg: `quer trocar um exercício` },
    { label: "Dúvida na execução", msg: `tem dúvida na execução de um exercício` },
  ] as const;

  const request = async (label: string, detail: string) => {
    try {
      await submitRequest({
        gymId: profile?.gym_id ?? "",
        userId: uid,
        userName: profile?.name ?? "Aluno",
        type: "carga",
        message: `Ajuste de treino em "${workoutName}": o aluno informa que ${detail}.`,
      });
      setSent(label);
      setOpen(false);
      toast.success("Ajuste enviado ao seu Personal");
    } catch {
      toast.error("Não deu enviar agora. Tente de novo.");
    }
  };

  if (sent) {
    return (
      <div className="mt-2 rounded-xl border border-[#4ADE80]/25 bg-[#4ADE80]/[0.07] p-3">
        <p className="text-[11px] font-bold text-[#4ADE80]">Ajuste enviado: {sent}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">O Personal responde por aqui. Enquanto isso, siga o treino.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tactile mt-2 flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-left transition-colors hover:border-brand/30"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Dumbbell className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-foreground">Precisa de ajuste no treino?</span>
          <span className="block text-[10px] text-muted-foreground">Peça pro Personal em 1 toque</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-brand/25 bg-brand/[0.05] p-3">
      <p className="text-[11px] font-bold text-foreground">O que precisa de ajuste?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            onClick={() => request(o.label, o.msg)}
            className="tactile rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-2.5 text-[10.5px] font-bold text-foreground transition-colors hover:border-brand/40 hover:text-brand active:scale-[0.97]"
          >
            {o.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-center text-[10px] font-semibold text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
    </div>
  );
}
