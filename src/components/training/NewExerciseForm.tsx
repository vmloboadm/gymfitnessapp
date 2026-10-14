"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";

const CATS = [
  "peito",
  "costas",
  "ombro",
  "biceps",
  "triceps",
  "perna",
  "gluteo",
  "core",
  "panturrilha",
  "cardio",
] as const;

/**
 * Criar exercício do zero na academia (nome, grupo, músculos, dica).
 * Salva no banco e vale na hora: biblioteca, picker, equivalentes e IA.
 * Usado no picker de troca e na geração de treino.
 */
export function NewExerciseForm({ onSaved }: { onSaved?: (name: string) => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string>("peito");
  const [muscles, setMuscles] = useState("");
  const [tip, setTip] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const clean = name.trim();
    if (!clean || !profile?.gym_id || saving) return;
    setSaving(true);
    try {
      const { error } = await supabaseBrowser()
        .from("exercises")
        .insert({
          gym_id: profile.gym_id,
          name: clean,
          category: cat,
          muscles: muscles.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
          tips: tip.trim() ? [tip.trim()] : [],
        } as never);
      if (error) throw new Error(error.message);
      toast.success("Exercício criado", { description: `${clean} entrou na biblioteca e já vale aqui.` });
      setName("");
      setMuscles("");
      setTip("");
      setCat("peito");
      onSaved?.(clean);
    } catch (e) {
      toast.error("Não deu criar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand/[0.05] p-3">
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Nome do exercício
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Remada serrote no banco"
          aria-label="Nome do novo exercício"
          maxLength={80}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Grupo
          </span>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Grupo muscular"
            className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Dica (opcional)
          </span>
          <input
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="Ex.: sem balanço"
            aria-label="Dica de execução"
            maxLength={120}
            className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Músculos (opcional, vírgula)
        </span>
        <input
          value={muscles}
          onChange={(e) => setMuscles(e.target.value)}
          placeholder="Ex.: grande dorsal, bíceps"
          aria-label="Músculos trabalhados"
          maxLength={120}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving || !name.trim()}
        className="tactile flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[12.5px] font-black text-brand-foreground disabled:opacity-40"
      >
        {saving ? "Salvando..." : "Salvar e usar no treino"}
      </button>
      <p className="text-center text-[10px] text-muted-foreground">
        Entra na biblioteca da academia e vale na IA e nos próximos treinos.
      </p>
    </div>
  );
}
