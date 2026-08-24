"use client";

import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { supabaseBrowser } from "~/lib/supabase/client";
import { calcBmi } from "~/lib/utils/calculations";
import type { Profiles } from "~/lib/types/models";

/**
 * STEP 3, Métricas corporais iniciais (blueprint §3.1).
 * Calcula IMC ao vivo e salva em body_metrics + profile.daily_intake
 * com frequência meta.
 */
export function IntentInput({
  profile,
  onSave,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
}) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [waist, setWaist] = useState("");
  const [saving, setSaving] = useState(false);

  const w = parseFloat(weight.replace(",", "."));
  const h = parseFloat(height.replace(",", "."));
  const bmi = w > 0 && h > 0 ? calcBmi(w, h) : null;
  const valid = w > 0 && h > 0;

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);

    const supabase = supabaseBrowser();
    await supabase.from("body_metrics").insert({
      gym_id: profile.gym_id,
      student_id: profile.id,
      weight_kg: w,
      height_m: h,
      waist_cm: waist ? parseFloat(waist.replace(",", ".")) : null,
      bmi: bmi ? Math.round(bmi * 10) / 10 : null,
      source: "manual",
    } as never);

    await onSave({}, 4);
    setSaving(false);
  };

  const bmiLabel = bmi
    ? bmi < 18.5
      ? "Abaixo do peso"
      : bmi < 25
        ? "Peso normal"
        : bmi < 30
          ? "Sobrepeso"
          : "Obesidade"
    : null;

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold text-foreground">Suas métricas hoje</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="weight">Peso (kg)</Label>
          <Input
            id="weight"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="80,5"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Altura (m)</Label>
          <Input
            id="height"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="1,81"
            className="font-mono"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="waist">Cintura (cm, opcional)</Label>
        <Input
          id="waist"
          inputMode="decimal"
          value={waist}
          onChange={(e) => setWaist(e.target.value)}
          placeholder="82"
          className="font-mono"
        />
      </div>

      {bmi && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Seu IMC</p>
            <p className="font-mono text-lg font-bold text-foreground">
              {bmi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            </p>
          </div>
          <div className="rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">
            {bmiLabel}
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={saving || !valid}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        Continuar, Saúde e restrições
      </Button>
    </form>
  );
}