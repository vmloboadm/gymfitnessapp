"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";
import { OnboardingStepper } from "~/components/onboarding/OnboardingStepper";
import { OnboardingProgress } from "~/components/onboarding/OnboardingProgress";
import { ProfileBasicForm } from "~/components/onboarding/ProfileBasicForm";
import { AnamneseForm } from "~/components/onboarding/AnamneseForm";
import { IntentInput } from "~/components/onboarding/BodyMetricsInput";
import { MedicalRestrictionForm } from "~/components/onboarding/MedicalRestrictionForm";
import { OnboardingReview } from "~/components/onboarding/OnboardingReview";
import { AuthSkeleton } from "~/components/common/AuthSkeleton";
import { readOnboarding, saveOnboarding } from "~/lib/profile-store";
import type { Profiles } from "~/lib/types/models";

/**
 * Onboarding multi-step (blueprint §3.1): cada step salva incrementalmente
 * em profiles, o aluno pode sair e retomar onde parou (onboarding_step).
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

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

  const loadProfile = useCallback(async () => {
    // Modo teste: onboarding local (mesma forma de dados; produção usa profiles no Supabase)
    if (isDemo) {
      const saved = readOnboarding();
      const p = {
        id: "demo-onboarding",
        gym_id: "00000000-0000-0000-0000-000000000001",
        role: "student" as const,
        status: "active" as const,
        name: saved.name ?? "",
        email: saved.email ?? "admin@gymfitness.com",
        onboarding_step: saved.onboarding_step ?? 1,
        onboarding_completed: saved.onboarding_completed ?? false,
        lgpd_consent_at: new Date().toISOString(),
        birth_date: saved.birth_date ?? null,
        phone: saved.phone ?? null,
        goal: saved.goal ?? null,
        daily_intake: saved.daily_intake ?? null,
        medical_risk: saved.medical_risk ?? null,
      } as unknown as Profiles;
      setProfile(p);
      setMaxReached(Math.max(requested, saved.onboarding_step ?? requested));
      setStep(saved.onboarding_step ? Math.min(requested, saved.onboarding_step) || requested : requested);
      setLoading(false);
      return;
    }

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
      const { error: insertErr } = await supabase.from("profiles").insert(base);
      if (insertErr) {
        toast.error("Falha ao criar perfil", { description: "Tente novamente ou entre em contato." });
        setLoading(false);
        return;
      }
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
  }, [requested, router, isDemo]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /** Cada step chama esta função para salvar e avançar (incremental). */
  const saveAndGo = useCallback(
    async (patch: Partial<Profiles>, nextStep: number) => {
      // Modo teste: salva local e avança
      if (isDemo) {
        const merged = saveOnboarding({ ...(patch as Record<string, unknown>), onboarding_step: nextStep });
        setProfile((prev) => (prev ? { ...prev, ...merged } as Profiles : prev));
        setMaxReached((m) => Math.max(m, nextStep));
        router.replace(`/onboarding?step=${nextStep}`);
        return;
      }
      if (!profile) return;
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc("update_onboarding_step", {
        p_patch: patch,
        p_next_step: nextStep,
      });
      if (error) {
        toast.error("Falha ao salvar progresso", { description: "Verifique sua conexão e tente novamente." });
        return;
      }
      setProfile((prev) => (prev ? { ...prev, ...patch, onboarding_step: nextStep } : prev));
      setMaxReached((m) => Math.max(m, nextStep));
      router.replace(`/onboarding?step=${nextStep}`);
    },
    [profile, router, isDemo]
  );

  const finish = useCallback(async () => {
    // Modo teste: marca completo e vai pro dashboard
    if (isDemo) {
      saveOnboarding({ onboarding_completed: true, onboarding_step: 5 });
      document.cookie = "gf_test=1; path=/; SameSite=Lax";
      router.replace("/");
      return;
    }
    if (!profile) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.rpc("finish_onboarding");
    if (error) {
      toast.error("Erro ao finalizar onboarding", { description: "Seus dados foram salvos, mas houve um problema ao concluir." });
    }
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