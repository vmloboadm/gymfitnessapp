"use client";

import { useMemo, useState } from "react";
import { Feather, ThumbsUp, Flame, Zap, Clock3, Check } from "lucide-react";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { saveSessionFeedback } from "~/lib/supabase/workout-session";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

const FEELINGS = [
  { id: "leve", label: "Leve", icon: Feather, active: "border-sky-400/60 bg-sky-400/15 text-sky-300", idle: "text-muted-foreground" },
  { id: "na_medida", label: "Na medida", icon: ThumbsUp, active: "border-[#4ADE80]/60 bg-[#4ADE80]/15 text-[#4ADE80]", idle: "text-muted-foreground" },
  { id: "puxado", label: "Puxado", icon: Flame, active: "border-[#FFC24D]/60 bg-[#FFC24D]/15 text-[#FFC24D]", idle: "text-muted-foreground" },
  { id: "no_limite", label: "No limite", icon: Zap, active: "border-brand/60 bg-brand/15 text-brand", idle: "text-muted-foreground" },
];

export const FEEDBACK_EXAMPLES = [
  "Treino puxado hoje!",
  "Treino concluído com excelência hoje!",
  "Treinei leve hoje, estava cansado!",
];

const DURATIONS = [30, 45, 60, 75];

/**
 * Feedback pós-treino: sensação rápida + duração + nota opcional com exemplos.
 * Aparece quando uma sessão terminou sem feedback (auto-finish, app fechado)
 * ou ao concluir o treino. Salva em workout_sessions.meta e alimenta o Diário.
 */
export default function WorkoutFeedbackSheet({
  open,
  sessionId,
  sessionDateLabel,
  estimatedMin,
  onSaved,
  onClose,
}: {
  open: boolean;
  sessionId: string | null;
  sessionDateLabel: string;
  estimatedMin?: number | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [feeling, setFeeling] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const nearest = useMemo(() => {
    if (!estimatedMin || estimatedMin <= 0) return 45;
    return DURATIONS.reduce((a, b) => (Math.abs(b - estimatedMin) < Math.abs(a - estimatedMin) ? b : a));
  }, [estimatedMin]);

  const activeMin = minutes ?? nearest;

  const save = async () => {
    if (!sessionId || !feeling || saving) return;
    setSaving(true);
    const ok = await saveSessionFeedback(sessionId, {
      feeling,
      note: note.trim() || null,
      duration_min: activeMin,
      finished_by: "student",
    });
    setSaving(false);
    if (ok) {
      toast.success("Feedback salvo! Seu personal já vê sua evolução.");
      navigator.vibrate?.([40, 30, 60]);
      setFeeling(null);
      setMinutes(null);
      setNote("");
      onSaved();
    } else {
      toast.error("Não deu pra salvar agora", { description: "Tente novamente." });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand">Feedback do treino</p>
          <h3 className="mt-1 text-lg font-black text-foreground">Como foi o treino {sessionDateLabel}?</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Rapidinho — 10 segundos e seu personal acompanha você.</p>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sensação</p>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Sensação do treino">
            {FEELINGS.map((f) => {
              const Icon = f.icon;
              const on = feeling === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFeeling(f.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition-colors",
                    on ? f.active : "border-white/[0.08] bg-white/[0.03]"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5", on ? "" : f.idle)} />
                  <span className={cn("text-[10px] font-bold", on ? "" : "text-muted-foreground")}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Clock3 className="h-3 w-3" /> Quanto tempo durou?
          </p>
          <div className="flex gap-1.5" role="group" aria-label="Duração do treino">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                aria-pressed={activeMin === m}
                className={cn(
                  "flex-1 rounded-full border py-2 text-[11px] font-bold tabular-nums transition-colors",
                  activeMin === m
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
                )}
              >
                {m === 75 ? "75+" : m} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Nota <span className="font-medium normal-case">(opcional)</span>
          </p>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
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
            placeholder="Conte como foi (opcional)..."
            aria-label="Nota sobre o treino"
            className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tactile rounded-2xl border border-white/[0.08] px-4 py-3 text-[12px] font-bold text-muted-foreground"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!feeling || saving}
            className="tactile flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {saving ? "Salvando..." : "Salvar feedback"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
