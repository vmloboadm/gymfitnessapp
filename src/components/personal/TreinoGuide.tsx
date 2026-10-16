"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ListChecks, History, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";

const KEY_PREFIX = "gf_treino_guide_v1_";

const STEPS = [
  {
    icon: Sparkles,
    title: "Com IA",
    body: "O app monta o plano completo sozinho, com os dados da ficha: nível, objetivo, foco e aparelhos. Rápido para o dia a dia.",
  },
  {
    icon: ListChecks,
    title: "Manual com estrutura",
    body: "O app sugere a divisão (A, B, C...) e quantos exercícios por grupo. Você marca os exercícios por categoria no check. Controle total.",
  },
  {
    icon: History,
    title: "Repetir de outro aluno",
    body: "Achou um plano que funciona? Copia de outro aluno com um toque e ajusta só o que precisar.",
  },
];

/**
 * Explicação de primeira vez do construtor de treino.
 * Mostra uma vez por usuário; some para sempre quando ela marca "entendi".
 */
export function TreinoGuide() {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remember, setRemember] = useState(true);

  const isStaff = profile?.role === "trainer" || profile?.role === "manager" || profile?.role === "admin";

  useEffect(() => {
    if (loading || !isStaff || !user?.id) return;
    let seen = true;
    try {
      seen = localStorage.getItem(KEY_PREFIX + user.id) === "done";
    } catch {}
    if (!seen) setOpen(true);
  }, [loading, isStaff, user?.id]);

  const finish = () => {
    if (remember && user?.id) {
      try {
        localStorage.setItem(KEY_PREFIX + user.id, "done");
      } catch {}
    }
    setOpen(false);
  };

  if (!open) return null;
  const step = STEPS[idx];
  const Icon = step.icon;
  const last = idx === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="guide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Como montar um treino"
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-card p-5 shadow-2xl"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
              <Icon className="h-4 w-4 text-brand" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
              Passo {idx + 1} de {STEPS.length}
            </p>
          </div>
          <h2 className="mt-2 text-lg font-black text-foreground">{step.title}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>

          {/* progresso */}
          <div className="mt-4 flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-brand" : "bg-white/[0.08]"}`}
                aria-hidden
              />
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                remember ? "border-brand bg-brand text-brand-foreground" : "border-white/20"
              }`}
            >
              {remember ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="sr-only"
            />
            <span className="text-[12px] font-semibold text-foreground">
              Entendi, não mostrar de novo
            </span>
          </label>

          <div className="mt-4 flex items-center gap-2">
            {idx > 0 ? (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="tactile flex h-11 items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-[12.5px] font-bold text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (last ? finish() : setIdx((i) => i + 1))}
              className="tactile flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
            >
              {last ? "Começar a montar" : "Próximo"}
              {!last ? <ChevronRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
