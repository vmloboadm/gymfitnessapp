"use client";

import { Info } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

/**
 * LGPD consent, checkbox explícito + texto lero (blueprint §3.1/9).
 * O consentimento (data/hora) é gravado em profiles.lgpd_consent_at
 * pelo fluxo de cadastro.
 */
export function LgpdConsent({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <Label className="text-xs leading-relaxed">
          Ao criar sua conta você concorda que a GymFitness colete seus dados de
          treino, medidas corporais e histórico de frequência para melhorar sua
          experiência e interações. Seus dados são tratados conforme a LGPD e
          podem ser usados pelo Assistente de Treino do GymFitness para recomendação de treinos,
          sempre com registro de auditoria.
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="lgpd"
          checked={checked}
          onCheckedChange={(v: boolean) => onChange(v === true)}
        />
        <label
          htmlFor="lgpd"
          className="text-sm font-medium text-foreground"
        >
          Li e aceito os termos e a política de privacidade
        </label>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}