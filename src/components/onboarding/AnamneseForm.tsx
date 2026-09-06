"use client";

import { useState } from "react";
import { HeartPulse, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { Profiles } from "~/lib/types/models";

interface RiskFlag {
  id: string;
  label: string;
  highImpact: boolean; // se true e marcado → medical_risk = true
}

const RISK_FLAGS: RiskFlag[] = [
  { id: "cardiaco", label: "Problema cardíaco (angina, arritmia, infarto)", highImpact: true },
  { id: "articular", label: "Lesão articular/cirurgia recente (joelho, ombro, coluna)", highImpact: true },
  { id: "hipertensao", label: "Hipertensão não controlada", highImpact: true },
  { id: "respiratorio", label: "Problema respiratório grave", highImpact: true },
  { id: "diabetes", label: "Diabetes", highImpact: false },
  { id: "gravidez", label: "Gravidez", highImpact: false },
  { id: "lesao_recente", label: "Lesão muscular nas últimas 4 semanas", highImpact: true },
];

/**
 * STEP 2, Anamnese completíssima (blueprint §3.1/§6.3d).
 * Se marcar condição grave → medical_risk = true → TRAVA CLÍNICA ativa
 * (status = pending_clearance) no step 4.
 */
export function AnamneseForm({
  profile,
  onSave,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [medications, setMedications] = useState("");
  const [surgery, setSurgery] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const medicalRisk = selected.some((id) =>
    RISK_FLAGS.find((r) => r.id === id)?.highImpact
  );

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(
      {
        medical_risk: medicalRisk,
        medications: medications.trim() || null,
        surgery_history: surgery.trim() || null,
      },
      3
    );
    setSaving(false);
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold text-foreground">Anamnese de saúde</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Marque o que se aplica. Isso é usado apenas para montar um treino seguro
          (LGPD: dado sensível, processado com auditoria).
        </p>
      </div>

      <div className="grid gap-2">
        {RISK_FLAGS.map((r) => {
          const checked = selected.includes(r.id);
          return (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                checked ? "border-brand bg-brand/10" : "border-border bg-card/40"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(r.id)}
                className="mt-0.5"
              />
              <div>
                <span className="block text-sm font-medium text-foreground">
                  {r.label}
                </span>
                {r.highImpact && (
                  <span className="text-[11px] text-warning">
                    exigirá liberação por laudo médico
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="med">Medicamentos em uso</Label>
        <Textarea
          id="med"
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          placeholder="Nome e dose (se houver)"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="surgery">Cirurgias / internações recentes</Label>
        <Textarea
          id="surgery"
          value={surgery}
          onChange={(e) => setSurgery(e.target.value)}
          placeholder="Descreva, se houver"
          rows={2}
        />
      </div>

      {medicalRisk && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          Identificamos um possível risco. Você precisará enviar um laudo médico no
          próximo passo para liberar o treino de alto impacto. Isso protege sua
          segurança.
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        Continuar, Métricas
      </Button>
    </form>
  );
}