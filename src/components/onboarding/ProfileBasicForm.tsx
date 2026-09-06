"use client";

import { useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { GoalSelector } from "~/components/onboarding/GoalSelector";
import { cn } from "~/lib/utils";
import type { Profiles } from "~/lib/types/models";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
const LEVELS = ["Iniciante", "Intermediário", "Avançado"] as const;

function calcAge(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

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
  const [sex, setSex] = useState(profile.sex ?? "");
  const [experienceLevel, setExperienceLevel] = useState(profile.experience_level ?? "");
  const [availableDays, setAvailableDays] = useState<Set<string>>(
    new Set(profile.available_days ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const toggleDay = (d: string) =>
    setAvailableDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!goal.trim()) errs.push("Informe seu objetivo de treino.");
    if (birthDate) {
      const age = calcAge(birthDate);
      if (age !== null && (age < 14 || age > 90)) errs.push("Idade deve ser entre 14 e 90 anos.");
    }
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    await onSave(
      {
        birth_date: birthDate || null,
        phone: phone || null,
        goal,
        daily_intake: dailyIntake || null,
        sex: sex || null,
        experience_level: experienceLevel || null,
        available_days: availableDays.size > 0 ? [...availableDays] : null,
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

      <div className="space-y-2">
        <Label>Sexo biológico</Label>
        <div className="flex gap-2">
          {(["M", "F"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSex(v)}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm font-bold transition-colors",
                sex === v
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
              )}
            >
              {v === "M" ? "Masculino" : "Feminino"}
            </button>
          ))}
        </div>
      </div>

      <GoalSelector value={goal} onChange={setGoal} />

      <div className="space-y-2">
        <Label htmlFor="intake">Frequência semanal desejada</Label>
        <Input
          id="intake"
          type="number"
          min={1}
          max={7}
          value={dailyIntake ?? ""}
          onChange={(e) => setDailyIntake(e.target.value)}
          placeholder="Ex: 4 vezes por semana"
        />
      </div>

      <div className="space-y-2">
        <Label>Nível de experiência</Label>
        <div className="flex gap-2">
          {LEVELS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setExperienceLevel(v)}
              className={cn(
                "flex-1 rounded-xl border py-2 text-[13px] font-bold transition-colors",
                experienceLevel === v
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Dias disponíveis na semana</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = availableDays.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                  on ? "border-brand bg-brand text-brand-foreground" : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-[#F87171]/40 bg-[#F87171]/10 p-3 text-xs text-[#F87171]">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Target />}
        Continuar, Anamnese
      </Button>
    </form>
  );
}
