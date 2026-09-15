"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";
import type { Profiles } from "~/lib/types/models";

const PLAN_TYPES = ["Gymfitness", "Gympass", "TotalPass"] as const;

const PlanTypeBadge = ({ type }: { type: (typeof PLAN_TYPES)[number] }) => {
  const colors = {
    Gymfitness: "bg-green-100 text-green-800 border-green-200",
    Gympass: "bg-purple-100 text-purple-800 border-purple-200",
    TotalPass: "bg-orange-100 text-orange-800 border-orange-200",
  };
  const bg = colors[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
        bg
      )}
    >
      {type}
    </span>
  );
}

/**
 * STEP 4, Tipo de matrícula (blueprint §3.1).
 * Gymfitness → pede data de vencimento; Gympass/TotalPass → só o tipo.
 */
export function EnrollmentTypeForm({
  profile,
  onSave,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
}) {
  const [planType, setPlanType] = useState<"Gymfitness" | "Gympass" | "TotalPass" | null>(
    profile.plan_type ?? null
  );
  const [vencimento, setVencimento] = useState(profile.vencimento ?? "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];

    if (!planType) errs.push("Selecione o tipo de matrícula.");
    if (planType === "Gymfitness" && !vencimento.trim()) errs.push("Informe a data de vencimento da matrícula.");
    if (vencimento.trim()) {
      const parsed = new Date(`${vencimento}T12:00:00`);
      if (isNaN(parsed.getTime())) errs.push("Data de vencimento inválida.");
      else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsed < today) errs.push("A data de vencimento não pode ser no passado.");
      }
    }

    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    await onSave(
      {
        plan_type: planType,
        vencimento: planType === "Gymfitness" ? vencimento.trim() : null,
      },
      5
    );
    setSaving(false);
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <div className="space-y-3">
        <p className="text-base font-bold text-foreground">Tipo de matrícula</p>
        <p className="text-[11px] text-muted-foreground">
          Como você veio se inscrever?
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PLAN_TYPES.map((pt) => {
          const isSelected = planType === pt;
          return (
            <label
              key={pt}
              className={cn(
                "rounded-xl border transition-colors cursor-pointer",
                isSelected
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-brand/30"
              )}
              onClick={() => setPlanType(pt)}
            >
              <PlanTypeBadge type={pt} /> {pt}
            </label>
          );
        })}
      </div>

      {planType === "Gymfitness" && (
        <div className="space-y-3">
          <Label htmlFor="vencimento">Data de vencimento da matrícula</Label>
          <Input
            id="vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            placeholder="AAAA-MM-DD"
            className="mt-1 block w-full rounded-lg border border-white/[0.06] bg-white/[0.05] p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-[#F87171]/40 bg-[#F87171]/10 p-3 text-xs text-[#F87171]">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={saving}
      >
        {saving ? <Loader2 className="animate-spin" /> : null}
        Continuar, Saúde
      </Button>
    </form>
  );
}