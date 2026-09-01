"use client";

/**
 * Store de edições de perfil do aluno (modo demo: persistência local;
 * produção: trocar por update no Supabase — mesma forma de dados).
 *
 * Também guarda métricas de peso supervisionadas:
 *   pendente (aluno lançou + foto do visor) → comprovada (personal valida).
 * Só métrica comprovada pontua no ranking.
 */

const KEY_PROFILE = "gymfit_profile_edits_v1";
const KEY_METRICS = "gymfit_metrics_v1";

export type ProfileEdits = {
  name?: string;
  bio?: string;
  objetivo?: "hipertrofia" | "emagrecimento" | "condicionamento" | "saude";
  avatar_url?: string;
};

export type SupervisedMetric = {
  id: string;
  peso_kg: number;
  gordura_pct?: number | null;
  photo_url?: string | null;
  status: "pendente" | "comprovada";
  created_at: string;
  comprovada_em?: string | null;
  fonte: "foto-visor" | "personal";
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("gymfit-profile-store"));
  } catch {}
}

/* ---------- perfil ---------- */

export function getProfileEdits(): ProfileEdits {
  return read<ProfileEdits>(KEY_PROFILE) ?? {};
}

export function saveProfileEdits(edit: ProfileEdits): ProfileEdits {
  const next = { ...getProfileEdits(), ...edit };
  write(KEY_PROFILE, next);
  return next;
}

/* ---------- métricas supervisionadas ---------- */

export function listMetrics(): SupervisedMetric[] {
  return read<SupervisedMetric[]>(KEY_METRICS) ?? [];
}

export function addMetric(m: Omit<SupervisedMetric, "id" | "status" | "created_at">): SupervisedMetric {
  const metric: SupervisedMetric = {
    ...m,
    id: `bm-${Date.now()}`,
    status: m.photo_url || m.fonte === "personal" ? "pendente" : "pendente",
    created_at: new Date().toISOString(),
  };
  const all = [metric, ...listMetrics()].slice(0, 50);
  write(KEY_METRICS, all);
  return metric;
}

export function approveMetric(id: string): void {
  const all = listMetrics().map((m) =>
    m.id === id ? { ...m, status: "comprovada" as const, comprovada_em: new Date().toISOString() } : m
  );
  write(KEY_METRICS, all);
}

/** pontuação de ranking: só métricas comprovadas contam */
export function rankingMetricsPoints(): number {
  return listMetrics().filter((m) => m.status === "comprovada").length * 15;
}

/* ---------- onboarding do aluno ---------- */

const KEY_ONBOARDING = "gymfit_onboarding_v1";

export type OnboardingState = {
  name?: string;
  email?: string;
  birth_date?: string | null;
  phone?: string | null;
  goal?: string | null;
  daily_intake?: string | null;
  medical_risk?: string | null;
  weight_kg?: number | null;
  height_m?: number | null;
  onboarding_step?: number;
  onboarding_completed?: boolean;
};

export function readOnboarding(): OnboardingState {
  return read<OnboardingState>(KEY_ONBOARDING) ?? {};
}

export function saveOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...readOnboarding(), ...patch };
  write(KEY_ONBOARDING, next);
  return next;
}
