"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";

const TOUR_KEY = "gf_staff_tour_v1";

type TourStep = {
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

function stepsFor(isManager: boolean): TourStep[] {
  return [
    {
      title: isManager ? "Bem-vindo à gestão" : "Bem-vindo ao painel do personal",
      body: isManager
        ? "Aqui você vê a academia toda: presença, treinos, aprovações, finanças e ranking. Este tour rápido mostra o essencial em 5 paradas."
        : "Aqui você cuida dos seus alunos: gerar treinos com IA, aprovar pedidos e acompanhar evolução. Este tour rápido mostra o essencial em 5 paradas.",
    },
    {
      title: "Gerar treino com IA",
      body: "Em Treinos, o assistente pergunta nível, objetivo, foco e restrições, gera o plano com exercícios reais do catálogo e você revisa antes de atribuir. Dá para aplicar o mesmo plano em vários alunos de uma vez.",
      cta: { label: "Ir para Treinos", href: "/personal/treinos" },
    },
    {
      title: "Check-in libera o treino",
      body: isManager
        ? "O aluno libera o treino do dia por QR, NFC ou a senha do dia. A senha de hoje aparece no seu dashboard e troca à meia-noite. Sem check-in, o treino fica bloqueado."
        : "O aluno libera o treino do dia por QR, NFC ou a senha do dia (peça na recepção, ela troca à meia-noite). Sem check-in, o treino fica bloqueado.",
      cta: { label: "Ver Check-in", href: "/checkin" },
    },
    {
      title: "Aprovações e alunos",
      body: "Pedidos dos alunos (carga, ajuste, relatório) caem em Aprovações com badge na barra inferior. Na lista de alunos dá para ver feedback do último treino, RPE e streak antes de ajustar um plano.",
      cta: { label: "Ver Aprovações", href: "/personal/aprovacoes" },
    },
    {
      title: "Acompanhar o resultado",
      body: isManager
        ? "No dashboard você acompanha check-ins de hoje, ocupação por horário, tendência de receita e inadimplência. Feche o tour e explore à vontade."
        : "No seu início você vê briefing do dia, quem sumiu e quem está voando. Feche o tour e explore à vontade.",
      cta: isManager
        ? { label: "Ir para Dashboard", href: "/dashboard" }
        : { label: "Ir para Início", href: "/personal/dashboard" },
    },
  ];
}

function markDone() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {}
}

/**
 * Super onboarding do staff (gestor + personal): tour guiado de 5 paradas,
 * abre sozinho uma única vez e pode ser dispensado. Reabertura manual via
 * ?tour=1 ou evento window "gf:staff-tour".
 */
export function StaffTour() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const role = profile?.role;
  const isStaff = role === "trainer" || role === "manager" || role === "admin";
  const isManager = role === "manager" || role === "admin";

  // Abre sozinho uma vez para staff autenticado que nunca completou.
  useEffect(() => {
    if (loading || !isStaff || open) return;
    let done = false;
    try {
      done = localStorage.getItem(TOUR_KEY) === "done";
    } catch {}
    if (done) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [loading, isStaff, open]);

  // Reabertura manual: ?tour=1 (limpa o param) ou evento gf:staff-tour.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1" && isStaff) {
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
    window.addEventListener("gf:staff-tour", reopen);
    return () => window.removeEventListener("gf:staff-tour", reopen);
  }, [isStaff]);

  const closeLater = useCallback(() => setOpen(false), []);
  const dismiss = useCallback(() => {
    markDone();
    setOpen(false);
  }, []);
  const finish = useCallback(() => {
    markDone();
    setOpen(false);
  }, []);

  const steps = stepsFor(isManager);
  const step = steps[Math.min(idx, steps.length - 1)];
  const last = idx >= steps.length - 1;

  if (!isStaff || !open) return null;

  const goCta = () => {
    if (!step.cta) return;
    router.push(step.cta.href);
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour guiado do staff">
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
              <MapPin className="h-3.5 w-3.5" /> Tour do staff · {idx + 1} de {steps.length}
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
                onClick={finish}
                className="tactile flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
              >
                <Check className="h-4 w-4" strokeWidth={3} /> Concluir tour
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
