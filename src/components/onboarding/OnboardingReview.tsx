"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PartyPopper } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { Profiles } from "~/lib/types/models";

const SUMMARY: Array<{ label: string; get: (p: Profiles) => string }> = [
  { label: "Nome", get: (p) => p.name },
  { label: "Data de nascimento", get: (p) => p.birth_date ?? "-" },
  { label: "Objetivo", get: (p) => p.goal ?? "-" },
  {
    label: "Frequência semanal",
    get: (p) => (p.daily_intake ? `${p.daily_intake}×` : "-"),
  },
  {
    label: "Restrição clínica",
    get: (p) => (p.medical_risk ? "Sim, laudo requisitado" : "Nenhuma"),
  },
];

/**
 * STEP 5, Revisão + confirmação (blueprint §3.1).
 */
export function OnboardingReview({
  profile,
  onFinish,
}: {
  profile: Profiles;
  onFinish: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    await onFinish();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <h2 className="text-sm font-semibold text-foreground">
          Confira seus dados
        </h2>
      </div>

      <dl className="divide-y divide-border rounded-lg border border-border">
        {SUMMARY.map(({ label, get }) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-right text-sm font-medium text-foreground">
              {get(profile)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
        Com o cadastro completo, nosso time de personal trainers montará um treino
        inicial para você. Na primeira aula, fazemos o check-in e o treino do dia
        já fica disponível.
      </p>

      <Button
        onClick={finish}
        className={cn("w-full")}
        size="lg"
        disabled={saving}
      >
        {saving ? <Loader2 className="animate-spin" /> : <PartyPopper />}
        Começar a treinar
      </Button>
    </div>
  );
}