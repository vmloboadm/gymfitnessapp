"use client";

import { useState } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { Modal } from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { FormInput } from "~/components/ui/form-input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { isDemoMode } from "~/lib/demo-bridge";

interface WorkoutLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  equipmentName: string;
  onClose: () => void;
}

export function WorkoutLogModal({ open, onOpenChange, sessionId, equipmentName, onClose }: WorkoutLogModalProps) {
  const [form, setForm] = useState({ sets: "", reps: "", weightKg: "", rpe: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const demo = isDemoMode();

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.sets || !(Number(form.sets) > 0)) next.sets = "Informe as séries (ex: 4)";
    if (!form.reps || !(Number(form.reps) > 0)) next.reps = "Informe as repetições (ex: 12)";
    if (form.weightKg && !(Number(form.weightKg) >= 0)) next.weightKg = "Peso não pode ser negativo";
    if (form.rpe && (Number(form.rpe) < 1 || Number(form.rpe) > 10)) next.rpe = "RPE deve ser de 1 a 10";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (!demo) {
        const supabase = supabaseBrowser();
        const { error } = await supabase.from("workout_logs").insert({
          session_id: sessionId,
          exercise_id: "demo-placeholder",
          date: new Date().toISOString().split("T")[0],
          weight_kg: form.weightKg ? Number(form.weightKg) : 0,
          reps: Number(form.reps),
          rpe: form.rpe ? Number(form.rpe) : null,
          technique: "standard",
        } as never);
        if (error) throw error;
      }

      confetti({
        particleCount: 140,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#F4711E", "#33D17A", "#3B82F6", "#F5A623"],
      });
      toast.success("Treino registrado com sucesso!");
      setForm({ sets: "", reps: "", weightKg: "", rpe: "" });
      onClose();
    } catch (err: any) {
      toast.error("Falha ao registrar treino", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${equipmentName} · registro`}>
      <p className="-mt-2 text-xs text-muted-foreground">
        Preencha o resultado da série para contabilizar no seu progresso.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sets">Séries</Label>
            <FormInput
              id="sets"
              type="number"
              inputMode="numeric"
              min="1"
              value={form.sets}
              onChange={(e) => setForm({ ...form, sets: e.target.value })}
              error={errors.sets}
            />
          </div>
          <div>
            <Label htmlFor="reps">Repetições</Label>
            <FormInput
              id="reps"
              type="number"
              inputMode="numeric"
              min="1"
              value={form.reps}
              onChange={(e) => setForm({ ...form, reps: e.target.value })}
              error={errors.reps}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="weightKg">Carga (kg) · opcional</Label>
            <FormInput
              id="weightKg"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              error={errors.weightKg}
            />
          </div>
          <div>
            <Label htmlFor="rpe">RPE (1-10) · opcional</Label>
            <FormInput
              id="rpe"
              type="number"
              inputMode="numeric"
              min="1"
              max="10"
              value={form.rpe}
              onChange={(e) => setForm({ ...form, rpe: e.target.value })}
              error={errors.rpe}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onClose()}>
            Pular
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : "Registrar treino"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}