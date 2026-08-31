"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, Copy, MessageCircle, Timer, Dumbbell , Trophy} from "lucide-react";
import { TopBar } from "~/components/layout/TopBar";
import { formatMMSS } from "~/lib/workout-session";
import { nextToUnlock, unlockAchievement, type StudentAchievement } from "~/lib/achievements";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { RewardModal } from "~/components/common/RewardModal";

/**
 * Tela de Resumo/Comemoração pós-treino (Fase 4):
 * cronômetro parado + estatísticas + conquista desbloqueada animada
 * + RPE rápido + compartilhar no Instagram/WhatsApp.
 */
/** Confete leve (framer-motion, sem dependência nova) · dispara no monte. */
function ConfettiBurst({ count = 18 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.2,
        size: 5 + Math.random() * 6,
        color: ["#F4711E", "#FBBF24", "#4ADE80", "#60A5FA", "#F472B6"][i % 5],
        rot: Math.random() * 360,
      })),
    [count]
  );
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((c) => (
        <motion.span
          key={c.id}
          className="absolute rounded-[2px]"
          style={{ left: `${c.x}%`, top: -12, width: c.size, height: c.size * 1.6, background: c.color }}
          initial={{ y: -20, opacity: 1, rotate: c.rot }}
          animate={{ y: 240, opacity: [1, 1, 0], rotate: c.rot + 320 }}
          transition={{ duration: c.dur, delay: c.delay, ease: "easeIn" }}
        />
      ))}
    </span>
  );
}

export default function WorkoutSummary({
  seconds,
  done,
  total,
  onDone,
}: {
  seconds: number;
  done: number;
  total: number;
  /** Chamado ao concluir o fluxo do resumo (RPE escolhido ou pular). */
  onDone: () => void;
}) {
  const [achievement] = useState<StudentAchievement | null>(() => nextToUnlock());
  const [unlocked, setUnlocked] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(true);
  const [rpe, setRpe] = useState<string | null>(null);

  useEffect(() => {
    if (achievement) {
      unlockAchievement(achievement.id);
      setUnlocked(true);
      navigator.vibrate?.([60, 40, 90]);
    }
  }, [achievement]);

  const shareText = `Acabei de esmagar meu treino na GymFitness! ${formatMMSS(seconds)} de treino · ${done}/${total} exercícios`;

  const shareInstagram = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "GymFitness", text: `${shareText} #GymFitness` });
        toast.success("Compartilhado!");
        return;
      }
      await navigator.clipboard.writeText(`${shareText} #GymFitness`);
      toast.success("Texto copiado! Cole no seu Instagram");
    } catch (err: any) {
      // usuário cancelou o share nativo: silencioso. Falha real de cópia: avisa.
      if (err?.name !== "AbortError") {
        toast.error("Não foi possível compartilhar agora", { description: "Tente pelo botão do WhatsApp." });
      }
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <>
      <RewardModal
        open={!!achievement && rewardOpen}
        onClose={() => setRewardOpen(false)}
        icon={achievement?.icon ?? "🏆"}
        name={achievement?.name ?? ""}
        points={achievement?.points ?? 0}
        shareText={shareText}
      />
      <TopBar title="Resumo do treino" subtitle="Bom trabalho hoje" />
      <div className="mx-auto max-w-md space-y-5 p-4 pb-10">
        {/* stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="gf-card gf-glass grid grid-cols-2 gap-3"
        >
          <div className="rounded-xl border border-border bg-card/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Timer className="h-3 w-3" /> Tempo total
            </p>
            <p className="pm-num mt-1 text-[28px] leading-none text-brand">{formatMMSS(seconds)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Dumbbell className="h-3 w-3" /> Exercícios
            </p>
            <p className="pm-num mt-1 text-[28px] leading-none text-foreground">
              {done}
              <span className="text-[14px] text-muted-foreground">/{total}</span>
            </p>
          </div>
        </motion.div>

        {/* celebração SEMPRE: conquista desbloqueada OU missão cumprida */}
        {!achievement ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.15 }}
            className="relative overflow-hidden rounded-[22px] border border-warning/40 bg-gradient-to-b from-warning/15 via-card to-card p-6 text-center"
          >
            <ConfettiBurst />
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(255,194,77,0.35), transparent)", filter: "blur(8px)" }}
              aria-hidden
            />
            <motion.span
              className="relative mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15"
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, delay: 0.35 }}
            >
              <Trophy className="h-10 w-10 text-[#FBBF24]" strokeWidth={1.8} fill="rgba(251, 191, 36, 0.25)" aria-hidden />
            </motion.span>
            <h2 className="relative mt-3 font-display text-xl font-black text-foreground">Missão cumprida! 🏆</h2>
            <p className="relative mt-1 gf-card-text">Treino concluído com determinação. A constância tá construindo você.</p>
            <p className="relative mt-2 inline-flex rounded-full bg-brand/15 px-3 py-1 text-[11px] font-black text-brand">
              +{done * 5} pts · próxima conquista a caminho
            </p>
          </motion.div>
        ) : null}

        {/* conquista desbloqueada */}
        {achievement ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.15 }}
            className={cn(
              "relative overflow-hidden rounded-[22px] border p-6 text-center",
              unlocked ? "border-warning/50 bg-gradient-to-b from-warning/20 via-card to-card" : "border-border bg-card/40"
            )}
          >
            <ConfettiBurst />
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(255,194,77,0.35), transparent)", filter: "blur(8px)" }}
              aria-hidden
            />
            <motion.p
              className="relative text-[10px] font-black uppercase tracking-[0.2em] text-warning"
              animate={unlocked ? { opacity: [0.7, 1, 0.7] } : undefined}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Conquista Desbloqueada
            </motion.p>
            <motion.span
              className="relative mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15 text-5xl"
              animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.2, delay: 0.35 }}
            >
              <Trophy className="mx-auto h-10 w-10 text-[#FBBF24]" strokeWidth={1.8} fill="rgba(251, 191, 36, 0.2)" aria-hidden />
            </motion.span>
            <h2 className="relative mt-3 font-display text-xl font-black text-foreground">{achievement.name}</h2>
            <p className="relative mt-1 gf-card-text">{achievement.description}</p>
            <p className="relative mt-2 inline-flex rounded-full bg-brand/15 px-3 py-1 text-[11px] font-black text-brand">
              +{achievement.points} pts
            </p>
          </motion.div>
        ) : null}

        {/* RPE rápido */}
        <div className="gf-card gf-glass !py-4">
          <p className="gf-section mb-2">Como foi o treino?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "tranquilo", label: "Tranquilo", tone: "text-sky-400" },
              { key: "na medida", label: "Na medida", tone: "text-success" },
              { key: "difícil", label: "Difícil", tone: "text-warning" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setRpe(opt.key);
                  toast.success(`RPE registrado: ${opt.label}`);
                }}
                className={cn(
                  "tactile rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                  rpe === opt.key ? "border-brand bg-brand-soft text-foreground" : "border-border bg-card/40 text-muted-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* COMPARTILHAR */}
        <div className="space-y-2.5">
          <p className="gf-section px-1">Espalhe o resultado</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={shareInstagram}
            className="gf-touch flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#E1306C] via-[#C13584] to-[#F77737] py-4 text-sm font-black text-white shadow-lg"
          >
            <Camera className="h-5 w-5" /> Compartilhar no Instagram
          </motion.button>
          <motion.a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="gf-touch flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] py-4 text-sm font-black text-black shadow-lg"
          >
            <MessageCircle className="h-5 w-5" /> Compartilhar no WhatsApp
          </motion.a>
          {!("share" in navigator) ? (
            <p className="flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
              <Copy className="h-3 w-3" /> No desktop o texto é copiado pra colar no app.
            </p>
          ) : null}
        </div>

        <button
          onClick={() => {
            if (!rpe) setRpe("na medida");
            onDone();
          }}
          className="gf-touch tactile flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          <CheckCircle2 className="h-4 w-4" /> Concluir e voltar ao início
        </button>
      </div>
    </>
  );
}
