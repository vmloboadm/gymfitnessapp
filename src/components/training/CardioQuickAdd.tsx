"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bike, Loader2, Timer } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

const MODALITIES = [
  { id: "corrida", label: "Corrida" },
  { id: "esteira", label: "Esteira" },
  { id: "bike", label: "Bike" },
  { id: "natacao", label: "Natação" },
  { id: "outros", label: "Outros" },
] as const;

const INTENSITY = [
  { id: 3, label: "Leve" },
  { id: 6, label: "Moderado" },
  { id: 9, label: "Forte" },
] as const;

/**
 * Registro rápido de cardio (tempo + intensidade). Trilha própria: soma
 * minutos na comunidade e rende conquistas, sem substituir o treino.
 */
export function CardioQuickAdd() {
  const { user, profile, loading: authLoading } = useAuth();
  const [modality, setModality] = useState<string>("esteira");
  const [minutes, setMinutes] = useState("20");
  const [intensity, setIntensity] = useState<number>(6);
  const [saving, setSaving] = useState(false);

  const { data: weekMin, refetch } = useAsyncQuery<number>(
    async () => {
      if (!user || !profile?.gym_id) return { data: 0, error: null };
      const monday = (() => {
        const d = new Date();
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return d.toISOString().slice(0, 10);
      })();
      const { data, error } = await supabaseBrowser()
        .from("cardio_logs")
        .select("minutes")
        .eq("student_id", user.id)
        .gte("date", monday);
      if (error) return { data: null, error };
      return { data: ((data ?? []) as Array<{ minutes: number }>).reduce((a, r) => a + (r.minutes ?? 0), 0), error: null };
    },
    [user?.id, profile?.gym_id],
    { enabled: !authLoading && !!user }
  );

  const save = async () => {
    const mins = Math.max(1, Math.min(600, parseInt(minutes) || 0));
    if (!mins || !user || !profile?.gym_id || saving) return;
    setSaving(true);
    try {
      const { error } = await supabaseBrowser()
        .from("cardio_logs")
        .insert({
          gym_id: profile.gym_id,
          student_id: user.id,
          modality,
          minutes: mins,
          intensity,
        } as never);
      if (error) throw new Error(error.message);
      toast.success("Cardio registrado", { description: `${mins} min de ${MODALITIES.find((m) => m.id === modality)?.label}.` });
      setMinutes("20");
      refetch();
    } catch (e) {
      toast.error("Não deu registrar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Bike className="h-4 w-4 text-brand" /> Cardio
        </h2>
        {(weekMin ?? 0) > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Timer className="h-3 w-3" /> {weekMin} min na semana
          </span>
        ) : null}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modalidade do cardio">
          {MODALITIES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModality(m.id)}
              aria-pressed={modality === m.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                modality === m.id
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-white/[0.08] text-muted-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Minutos de cardio"
            className="h-10 w-20 rounded-xl border border-white/[0.08] bg-white/[0.05] text-center text-sm font-bold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
          <span className="text-[11px] text-muted-foreground">min</span>
          <div className="ml-auto flex gap-1.5" role="group" aria-label="Intensidade">
            {INTENSITY.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setIntensity(o.id)}
                aria-pressed={intensity === o.id}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[10.5px] font-bold transition-colors",
                  intensity === o.id
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-white/[0.08] text-muted-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !minutes}
          className="tactile mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[12.5px] font-black text-brand-foreground disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
          {saving ? "Registrando..." : "Registrar cardio"}
        </button>
      </div>
    </div>
  );
}
