"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Dumbbell,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { TopBar } from "~/components/layout/TopBar";
import { cn } from "~/lib/utils";
import { demoAlunosPersonal } from "~/lib/demo-bridge";

/**
 * Dashboard MOBILE-FIRST do Personal — nada de anel/streak de aluno.
 * Radar de Retenção + lista gerenciada + ações rápidas. Tudo empilhado,
 * 100% largura, pensado pra ser usado em pé na sala da academia.
 */

const WA_BASE = "https://wa.me/5522999990001?text=";

type Status = "hoje" | "descanso" | "inativo" | "critico" | "elogio";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function PersonalHomePage() {
  const { profile } = useAuth();
  const students = useMemo(() => demoAlunosPersonal(), []);

  const radar = useMemo(() => {
    const alerts: Array<{ level: "critico" | "atencao" | "elogio"; name: string; msg: string }> = [];
    for (const s of students) {
      const d = daysSince(s.last_workout);
      if (d >= 3) alerts.push({ level: "critico", name: s.name, msg: `sem check-in há ${d} dias · streak ${s.streak}d` });
      else if (s.streak >= 8) alerts.push({ level: "elogio", name: s.name, msg: `streak de ${s.streak} dias — recorde pessoal` });
      else if (d === 2) alerts.push({ level: "atencao", name: s.name, msg: "2 dias sem treinar — risco de pausa" });
    }
    const order = { critico: 0, atencao: 1, elogio: 2 } as const;
    return alerts.sort((a, b) => order[a.level] - order[b.level]);
  }, [students]);

  const statusOf = (s: (typeof students)[number]): { label: string; cls: string } => {
    const d = daysSince(s.last_workout);
    if (d === 0) return { label: "Treinou hoje", cls: "bg-success/15 text-success" };
    if (!s.workout_active && d >= 4) return { label: "Inativo", cls: "bg-destructive/15 text-destructive" };
    return { label: "Descansando", cls: "bg-warning/15 text-warning" };
  };

  const waLink = (name: string, msg: string) =>
    `${WA_BASE}${encodeURIComponent(`Oi ${name.split(" ")[0]}! Passando pra ${msg}. Bora manter o ritmo? — ${profile?.name ?? "Personal"} | GymFitness`)}`;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const } },
  };

  const activeCount = students.filter((s) => daysSince(s.last_workout) <= 1).length;

  return (
    <>
      <TopBar title="Meus alunos" subtitle={profile?.name ?? "Personal"} />
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 p-4">
        {/* KPI vivo */}
        <motion.div variants={item} className="gf-card gf-glass flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Treinando agora</p>
            <p className="pm-num mt-1 text-[40px] leading-none text-brand">{activeCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">de {students.length} alunos gerenciados</p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15">
            <Users className="h-7 w-7 text-brand" />
          </span>
        </motion.div>

        {/* RADAR DE RETENÇÃO */}
        <motion.div variants={item}>
          <p className="gf-section mb-2">Radar de retenção</p>
          <div className="space-y-2">
            {radar.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum alerta — todo mundo no ritmo. 🎯
              </div>
            ) : (
              radar.map((a, i) => {
                const tone =
                  a.level === "critico"
                    ? { border: "border-destructive/40", bg: "bg-destructive/10", chip: "bg-destructive text-white", label: "Crítico", Icon: AlertTriangle }
                    : a.level === "atencao"
                      ? { border: "border-warning/40", bg: "bg-warning/10", chip: "bg-warning text-black", label: "Atenção", Icon: AlertTriangle }
                      : { border: "border-success/40", bg: "bg-success/10", chip: "bg-success text-black", label: "Elogio", Icon: Award };
                return (
                  <motion.div
                    key={`${a.name}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn("rounded-xl border p-3.5", tone.border, tone.bg)}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone.chip)}>
                        <tone.Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                          {a.name}
                          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", tone.chip)}>{tone.label}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.msg}</p>
                      </div>
                      <a
                        href={waLink(a.name, a.msg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gf-touch tactile flex shrink-0 items-center gap-1 rounded-full bg-success/20 px-3 py-1.5 text-[11px] font-bold text-success transition-colors hover:bg-success/30"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* LISTA GERENCIADA */}
        <motion.div variants={item}>
          <p className="gf-section mb-2">Alunos gerenciados</p>
          <div className="space-y-2">
            {students.map((s) => {
              const st = statusOf(s);
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card/40 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">streak {s.streak}d · último há {daysSince(s.last_workout)}d</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold", st.cls)}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* AÇÕES EM MASSA + ASSISTENTE */}
        <motion.button
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            alert("Treino de pernas aplicado para 3 alunos do grupo Iniciante. Cada um recebeu notificação com seu nome.")
          }
          className="tactile flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 text-sm font-bold text-secondary-foreground"
        >
          <Dumbbell className="h-4 w-4" /> Aplicar treino de pernas ao grupo Iniciante
        </motion.button>

        <motion.div variants={item} className="gf-card gf-glass">
          <p className="gf-section mb-1">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-brand" /> Prescrição assistida
          </p>
          <p className="gf-card-text">
            Descreva o objetivo do aluno e receba um rascunho de treino para revisar. Nada vai pro aluno
            sem sua aprovação — e toda alteração chega a ele identificada com o SEU nome.
          </p>
          <Link href="/ia" className="gf-touch mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25">
            Abrir assistente de prescrição
          </Link>
        </motion.div>
      </motion.div>
    </>
  );
}
