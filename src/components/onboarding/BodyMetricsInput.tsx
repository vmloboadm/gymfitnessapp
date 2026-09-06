"use client";

import { useState, useEffect } from "react";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { supabaseBrowser } from "~/lib/supabase/client";
import { toast } from "sonner";
import { calcBmi } from "~/lib/utils/calculations";
import type { Profiles } from "~/lib/types/models";

/**
 * STEP 3, Métricas corporais iniciais (blueprint §3.1).
 * Pré-preenche da última medição salva; deduplica por dia (uma medição por dia).
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

  // Pré-preencher da última medição
  useEffect(() => {
    if (!profile.id || profile.id === "demo-onboarding") return;
    const sb = supabaseBrowser();
    sb.from("body_metrics")
      .select("weight_kg, height_m, waist_cm")
      .eq("student_id", profile.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.weight_kg) setWeight(String(data.weight_kg).replace(".", ","));
          if (data.height_m) {
            const cm = Math.round(data.height_m * 100);
            setHeight(cm > 10 ? String(cm) : String(data.height_m).replace(".", ","));
          }
          if (data.waist_cm) setWaist(String(data.waist_cm).replace(".", ","));
        }
      });
  }, [profile.id]);

  const w = parseFloat(weight.replace(",", "."));
  const hRaw = parseFloat(height.replace(",", "."));
  const h = hRaw > 10 ? hRaw / 100 : hRaw;
  const bmi = w > 0 && h > 0.5 && h < 2.8 ? calcBmi(w, h) : null;
  const valid = w > 20 && w < 400 && h > 0.5 && h < 2.8;

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);

    const supabase = supabaseBrowser();
    const today = new Date().toISOString().slice(0, 10);

    // Deduplicar: checar se já existe medição hoje
    const { data: existing } = await supabase
      .from("body_metrics")
      .select("id")
      .eq("student_id", profile.id)
      .gte("recorded_at", today)
      .lt("recorded_at", today + "T23:59:59")
      .maybeSingle();

    if (existing) {
      // Atualiza a medição de hoje em vez de criar duplicata
      const { error } = await supabase
        .from("body_metrics")
        .update({
          weight_kg: w,
          height_m: h,
          waist_cm: waist ? parseFloat(waist.replace(",", ".")) : null,
          bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        } as never)
        .eq("id", existing.id);

      if (error) {
        toast.error("Falha ao atualizar medidas", { description: error.message });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("body_metrics").insert({
        gym_id: profile.gym_id,
        student_id: profile.id,
        weight_kg: w,
        height_m: h,
        waist_cm: waist ? parseFloat(waist.replace(",", ".")) : null,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        source: "manual",
      } as never);

      if (error) {
        toast.error("Falha ao salvar medidas", { description: error.message });
        setSaving(false);
        return;
      }
    }

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
          <Label htmlFor="height">Altura</Label>
          <Input
            id="height"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="1,81 ou 181"
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">Vale em metros (1,81) ou centímetros (181).</p>
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
