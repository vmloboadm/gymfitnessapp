"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";

const TOUR_KEY = "gf_student_tour_v1";

type TourStep = {
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

/** As sessões do aluno, ensinadas uma a uma — todas reais e funcionais. */
const steps: TourStep[] = [
  {
    title: "Bem-vindo ao seu app",
    body: "Este tour mostra o essencial em 5 paradas: treino do dia, check-in, evolução, ranking e perfil. Você pode refazê-lo depois digitando ?tour=1 no fim do endereço.",
  },
  {
    title: "Treino de hoje",
    body: "Em Treino aparece o plano enviado pelo seu personal, com séries, repetições e dica de execução. O treino do dia fica borrado até você fazer o check-in — é assim que a academia confirma sua presença.",
    cta: { label: "Abrir Treino", href: "/treino" },
  },
  {
    title: "Check-in libera o treino",
    body: "Escaneie o QR da portaria, aproxime o NFC ou use a senha de 4 dígitos do dia (pede na recepção). As três formas liberam o treino e contam para seu streak e ranking.",
    cta: { label: "Ver Check-in", href: "/checkin" },
  },
  {
    title: "Sua evolução",
    body: "Em Progresso você registra como foi cada treino e vê sua frequência; em Métricas salva peso e medidas para acompanhar a curva. Quanto mais frequente, melhor seu ranking.",
    cta: { label: "Ver Progresso", href: "/progresso" },
  },
  {
    title: "Perfil, ranking e benefícios",
    body: "No Perfil ficam sua foto, matrícula, conquistas e histórico. No Ranking você disputa a semana com a turma. Feche o tour e explore à vontade.",
    cta: { label: "Ver meu Perfil", href: "/perfil" },
  },
];

function markDone() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {}
}

/**
 * Onboarding do ALUNO no primeiro uso: tour guiado de 5 paradas mostrando
 * todas as sessões reais. Abre uma única vez após concluir o cadastro.
 * Reabertura manual: ?tour=1 ou evento window "gf:student-tour".
 */
export function StudentTour() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const isStudent = profile?.role === "student";

  // Primeiro uso: aluno autenticado, cadastro completo, tour nunca visto.
  useEffect(() => {
    if (loading || !isStudent || !profile?.onboarding_completed || open) return;
    let done = false;
    try {
      done = localStorage.getItem(TOUR_KEY) === "done";
    } catch {}
    if (done) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [loading, isStudent, profile?.onboarding_completed, open]);

  // Reabertura manual: ?tour=1 ou evento gf:student-tour.
  useEffect(() => {
    if (typeof window === "undefined" || !isStudent) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      setIdx(0);
      setOpen(true);
      params.delete("tour");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    const reopen = () => {
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener("gf:student-tour", reopen);
    return () => window.removeEventListener("gf:student-tour", reopen);
  }, [isStudent]);

  const closeLater = useCallback(() => setOpen(false), []);
  const dismiss = useCallback(() => {
    markDone();
    setOpen(false);
  }, []);

  const step = steps[Math.min(idx, steps.length - 1)];
  const last = idx >= steps.length - 1;

  if (!isStudent || !open) return null;

  const goCta = () => {
    if (!step.cta) return;
    router.push(step.cta.href);
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour guiado do aluno">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeLater} />
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-border bg-background p-5 pb-[max(2rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand">
              <MapPin className="h-3.5 w-3.5" /> Primeiro uso · {idx + 1} de {steps.length}
            </p>
            <button
              onClick={dismiss}
              aria-label="Pular tour"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mt-1 text-lg font-black text-foreground">{step.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>

          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === idx ? "w-6 bg-brand" : i < idx ? "w-1.5 bg-brand/50" : "w-1.5 bg-white/15"
                )}
              />
            ))}
          </div>

          {step.cta ? (
            <button
              onClick={goCta}
              className="tactile mt-4 flex h-11 w-full items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-[13px] font-black text-brand"
            >
              {step.cta.label}
            </button>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="tactile flex h-11 flex-1 items-center justify-center gap-1 rounded-2xl border border-white/[0.08] text-[12px] font-bold text-muted-foreground disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            {last ? (
              <button
                onClick={dismiss}
                className="tactile flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
              >
                <Check className="h-4 w-4" strokeWidth={3} /> Começar a treinar
              </button>
            ) : (
              <button
                onClick={() => setIdx((i) => Math.min(i + 1, steps.length - 1))}
                className="tactile flex h-11 flex-[2] items-center justify-center gap-1 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-4">
            <button onClick={dismiss} className="text-[11px] font-bold text-muted-foreground hover:text-foreground">
              Pular tour
            </button>
            <span className="h-3 w-px bg-white/10" aria-hidden />
            <button onClick={closeLater} className="text-[11px] font-bold text-muted-foreground hover:text-foreground">
              Ver depois
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
