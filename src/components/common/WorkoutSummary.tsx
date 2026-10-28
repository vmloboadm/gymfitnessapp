"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";
import { Camera, CheckCircle2, Copy, MessageCircle, Timer, Dumbbell, Trophy, Bell } from "lucide-react";
import { usePush } from "~/hooks/usePush";
import { TopBar } from "~/components/layout/TopBar";
import { formatMMSS } from "~/lib/workout-session";
import { saveSessionFeedback } from "~/lib/supabase/workout-session";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { FEEDBACK_EXAMPLES } from "~/components/student/WorkoutFeedbackSheet";

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
        <m.span
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
  sessionId,
  sets,
  volumeKg,
}: {
  seconds: number;
  /** Séries marcadas como feitas. */
  sets?: number;
  /** Volume total (kg × reps) das séries feitas. */
  volumeKg?: number;
  done: number;
  total: number;
  /** Chamado ao concluir o fluxo do resumo (RPE escolhido ou pular). */
  onDone: () => void;
  /** Id da workout_sessions ativa (para salvar RPE + nota + duração). */
  sessionId?: string | null;
}) {
  const [rpe, setRpe] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const push = usePush();
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shareText = `Acabei de esmagar meu treino na GymFitness! ${formatMMSS(seconds)} de treino · ${done}/${total} exercícios${volumeKg ? ` · ${volumeKg.toLocaleString("pt-BR")} kg levantados` : ""}`;

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

  const handleDone = () => {
    const hasFeedback = !!rpe || note.trim().length > 0;
    // Feedback é opcional e não bloqueia a saída. Salvamos em segundo plano.
    if (sessionId && hasFeedback) {
      void saveSessionFeedback(sessionId, {
        feeling: rpe ?? "na_medida",
        note: note.trim() || null,
        duration_min: Math.max(1, Math.round(seconds / 60)),
        finished_by: "student",
      });
    }
    onDone();
  };

  return (
    <>
      <TopBar title="Resumo do treino" subtitle="Bom trabalho hoje" hideOnline />
      <div className="mx-auto max-w-md space-y-5 p-4 pb-28">
        {/* stats */}
        <m.div
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
          {sets ? (
            <div className="rounded-xl border border-border bg-card/40 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Séries</p>
              <p className="pm-num mt-1 text-[28px] leading-none text-foreground">{sets}</p>
            </div>
          ) : null}
          {volumeKg ? (
            <div className="rounded-xl border border-border bg-card/40 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Volume</p>
              <p className="pm-num mt-1 text-[28px] leading-none text-foreground">
                {volumeKg.toLocaleString("pt-BR")}
                <span className="text-[14px] text-muted-foreground"> kg</span>
              </p>
            </div>
          ) : null}
        </m.div>

        {/* celebração sempre: missão cumprida, sem conquista inventada */}
        <m.div
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
            <m.span
              className="relative mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15"
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, delay: 0.35 }}
            >
              <Trophy className="h-10 w-10 text-[#FBBF24]" strokeWidth={1.8} fill="rgba(251, 191, 36, 0.25)" aria-hidden />
            </m.span>
            <h2 className="relative mt-3 font-display text-xl font-black text-foreground">
              {done >= total ? "Missão cumprida!" : "Treino registrado!"}
            </h2>
            <p className="relative mt-1 gf-card-text">
              {done >= total
                ? "Treino completo. A constância tá construindo você."
                : `Você fez ${done} de ${total} exercícios. Tudo que marcou já conta no seu histórico e no ranking.`}
            </p>
          </m.div>

        {/* RPE rápido */}
        <div className="gf-card gf-glass !py-4">
          <p className="gf-section mb-2">Como foi o treino?</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: "leve", label: "Leve", tone: "text-sky-400" },
              { key: "na_medida", label: "Na medida", tone: "text-success" },
              { key: "puxado", label: "Puxado", tone: "text-warning" },
              { key: "no_limite", label: "No limite", tone: "text-brand" },
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

        {/* ATIVAR PUSH: só aparece se suportado e ainda não ativo */}
        {push.supported && push.permission !== "granted" && !pushPromptDismissed ? (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="gf-card gf-glass flex items-center gap-3 !py-3.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15">
              <Bell className="h-5 w-5 text-brand" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground">Fique por dentro</p>
              <p className="text-[11px] text-muted-foreground">Ative as notificações e não perde treino, ranking nem recado da academia.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                onClick={async () => {
                  const ok = await push.enable();
                  if (ok) toast.success("Notificações ativadas!");
                  else toast.error("Não ativou agora. Você pode ativar no seu perfil.");
                }}
                className="gf-touch rounded-lg bg-brand px-3 py-1.5 text-[11px] font-black text-brand-foreground"
              >
                Ativar
              </button>
              <button
                onClick={() => setPushPromptDismissed(true)}
                className="gf-touch text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Agora não
              </button>
            </div>
          </m.div>
        ) : null}

        {/* NOTA RÁPIDA com exemplos */}
        <div className="gf-card gf-glass !py-4">
          <p className="gf-section mb-2">Deixe sua marca <span className="font-medium normal-case text-muted-foreground">(opcional)</span></p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {FEEDBACK_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setNote(ex)}
                className="rounded-full border border-brand/30 bg-brand/[0.07] px-2.5 py-1 text-[10px] font-semibold text-brand transition-colors hover:bg-brand/15"
              >
                {ex}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 220))}
            rows={2}
            maxLength={220}
            placeholder="Como foi? (opcional)"
            aria-label="Nota sobre o treino"
            className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.05] p-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
        </div>

        {/* COMPARTILHAR */}
        <div className="space-y-2.5">
          <p className="gf-section px-1">Espalhe o resultado</p>
          <m.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={shareInstagram}
            className="gf-touch flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#E1306C] via-[#C13584] to-[#F77737] py-4 text-sm font-black text-white shadow-lg"
          >
            <Camera className="h-5 w-5" /> Compartilhar no Instagram
          </m.button>
          <m.a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="gf-touch flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] py-4 text-sm font-black text-black shadow-lg"
          >
            <MessageCircle className="h-5 w-5" /> Compartilhar no WhatsApp
          </m.a>
          {!("share" in navigator) ? (
            <p className="flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
              <Copy className="h-3 w-3" /> No desktop o texto é copiado pra colar no app.
            </p>
          ) : null}
        </div>

      </div>
      {mounted
        ? createPortal(
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <div className="mx-auto max-w-md">
                <button
                  onClick={handleDone}
                  className="gf-touch tactile flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-black text-brand-foreground shadow-lg shadow-brand/25"
                >
                  <CheckCircle2 className="h-4 w-4" /> Concluir e voltar ao início
                </button>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">RPE e nota são opcionais.</p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
