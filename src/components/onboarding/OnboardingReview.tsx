"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PartyPopper, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { saveOnboarding } from "~/lib/profile-store";
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
  const [consent, setConsent] = useState(false);

  const finish = async () => {
    if (!consent) return;
    setSaving(true);
    // Persiste o consentimento LGPD (demo: profile-store; produção: coluna nova)
    saveOnboarding({ whatsapp_consent: true });
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

      {/* Consentimento obrigatório de contato (LGPD) */}
      <label
        htmlFor="consent-whatsapp"
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
          consent ? "border-brand/40 bg-brand/[0.08]" : "border-border bg-card/40"
        )}
      >
        <Checkbox
          id="consent-whatsapp"
          checked={consent}
          onCheckedChange={(v: boolean | "indeterminate") => setConsent(v === true)}
          className="mt-0.5"
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-brand" />
            Autorizo receber mensagens e contato da GymFitness e do meu Personal no WhatsApp
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
            Necessário para avisos de treino, alertas de retenção e feedbacks do Personal.
            Você pode revogar esse consentimento a qualquer momento nas configurações.
          </span>
        </span>
      </label>

      <Button
        onClick={finish}
        className={cn("w-full")}
        size="lg"
        disabled={saving || !consent}
      >
        {saving ? <Loader2 className="animate-spin" /> : <PartyPopper />}
        Começar a treinar
      </Button>
      {!consent ? (
        <p className="text-center text-[10px] text-muted-foreground">
          Marque o consentimento acima para continuar
        </p>
      ) : null}
    </div>
  );
}