"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "~/lib/supabase/client";
import { OnboardingStepper } from "~/components/onboarding/OnboardingStepper";
import { OnboardingProgress } from "~/components/onboarding/OnboardingProgress";
import { ProfileBasicForm } from "~/components/onboarding/ProfileBasicForm";
import { AnamneseForm } from "~/components/onboarding/AnamneseForm";
import { IntentInput } from "~/components/onboarding/BodyMetricsInput";
import { MedicalRestrictionForm } from "~/components/onboarding/MedicalRestrictionForm";
import { OnboardingReview } from "~/components/onboarding/OnboardingReview";
import { AuthSkeleton } from "~/components/common/AuthSkeleton";
import type { Profiles } from "~/lib/types/models";

/**
 * Onboarding multi-step (blueprint §3.1): cada step salva incrementalmente
 * em profiles — o aluno pode sair e retomar onde parou (onboarding_step).
 */
const STEP_COMPONENTS = [
  null, // 0 index base
  ProfileBasicForm, // step 1
  AnamneseForm, // step 2
  IntentInput, // step 3
  MedicalRestrictionForm, // step 4
  OnboardingReview, // step 5
] as const;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = Number(searchParams.get("step") ?? "1");
  const [step, setStep] = useState(requested);
  const [maxReached, setMaxReached] = useState(requested);
  const [profile, setProfile] = useState<Profiles | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const supabase = supabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    let { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!data) {
      const { data: gym } = await supabase
        .from("gyms")
        .select("id")
        .limit(1)
        .maybeSingle();
      const base = {
        id: user.id,
        gym_id: gym?.id ?? "00000000-0000-0000-0000-000000000001",
        role: "student" as const,
        status: "active" as const,
        name: (user.user_metadata?.name as string) ?? "",
        email: user.email ?? "",
        onboarding_step: requested,
        lgpd_consent_at: new Date().toISOString(),
      } as never;
      await supabase.from("profiles").insert(base);
      const { data: d2 } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      data = d2;
    }

    const p = data as Profiles | null;
    setProfile(p);
    setMaxReached(p?.onboarding_step ?? requested);
    setStep(Math.min(requested, p?.onboarding_step ?? requested) || requested);
    setLoading(false);
  }, [requested, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /** Cada step chama esta função para salvar e avançar (incremental). */
  const saveAndGo = useCallback(
    async (patch: Partial<Profiles>, nextStep: number) => {
      if (!profile) return;
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("profiles")
        .update({ ...patch, onboarding_step: nextStep } as never)
        .eq("id", profile.id);
      if (!error) {
        setProfile((prev) => (prev ? { ...prev, ...patch, onboarding_step: nextStep } : prev));
        setMaxReached((m) => Math.max(m, nextStep));
        router.replace(`/onboarding?step=${nextStep}`);
      }
    },
    [profile, router]
  );

  const finish = useCallback(async () => {
    if (!profile) return;
    const supabase = supabaseBrowser();
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true, onboarding_step: 5 } as never)
      .eq("id", profile.id);
    router.replace("/");
  }, [profile, router]);

  if (loading || !profile) {
    return <AuthSkeleton />;
  }

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Boas-vindas, {profile.name?.split(" ")[0] ?? "atleta"}!
        </h1>
        <OnboardingProgress current={step} total={5} />
        <OnboardingStepper current={step} maxReached={maxReached} />
      </div>

      {StepComponent ? <StepComponent profile={profile} onSave={saveAndGo} onFinish={finish} /> : null}
    </div>
  );
}