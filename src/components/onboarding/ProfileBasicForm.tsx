"use client";

import { useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { GoalSelector } from "~/components/onboarding/GoalSelector";
import type { Profiles } from "~/lib/types/models";

/**
 * STEP 1, Dados pessoais + objetivo (blueprint §3.1).
 */
export function ProfileBasicForm({
  profile,
  onSave,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
}) {
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [goal, setGoal] = useState(profile.goal ?? "");
  const [dailyIntake, setDailyIntake] = useState(profile.daily_intake ?? "");
  const [saving, setSaving] = useState(false);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(
      {
        birth_date: birthDate || null,
        phone: phone || null,
        goal,
        daily_intake: dailyIntake || null,
      },
      2
    );
    setSaving(false);
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="birth">Data de nascimento</Label>
          <Input
            id="birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>
      </div>

      <GoalSelector value={goal} onChange={setGoal} />

      <div className="space-y-2">
        <Label htmlFor="intake">
          Frequência semanal desejada
        </Label>
        <Input
          id="intake"
          type="number"
          min={1}
          max={7}
          value={dailyIntake ?? ""}
          onChange={(e) => setDailyIntake(e.target.value)}
          placeholder="Ex: 4 vezes por semana"
        />
        <p className="text-xs text-muted-foreground">
          Sua meta de frequência ajuda o app a montar um plano realista.
        </p>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Target />}
        Continuar, Anamnese
      </Button>
    </form>
  );
}