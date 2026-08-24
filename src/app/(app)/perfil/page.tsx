"use client";

import dynamic from "next/dynamic";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, CalendarClock, ChevronRight, Scale, Award, ListMusic, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { formatDate } from "~/lib/utils/format";
import { isDemoMode, demoMetricsData } from "~/lib/demo-bridge";
import { sortedAchievements } from "~/lib/achievements";
import type { StudentSubscriptions } from "~/lib/types/models";

/**
 * Perfil DESTILADO: identidade, matrícula, peso, conquistas e ações.
 * Gráficos duplicados e recordes mockados saíram (vivem em Progresso/Métricas).
 */
const WeightAreaD = dynamic(() => import("~/components/charts/PerfilWeightArea"), {
  ssr: false,
  loading: () => <div className="skeleton-line h-32 w-full rounded-xl" />,
});

export default function PerfilPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const demo = isDemoMode();

  const { data } = useAsyncQuery<{
    sub: StudentSubscriptions | null;
    metrics: any[];
  }>(
    async () => {
      if (demo) {
        const sub = {
          id: "sub-demo", gym_id: "1", student_id: "u1", plan_name: "Gympass",
          type: "gympass", status: "active", price: 149.9,
          starts_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          payment_method: "gympass", auto_renew: true,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        } as StudentSubscriptions;
        return { data: { sub, metrics: demoMetricsData().metrics }, error: null };
      }
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
      const [sRes, mRes] = await Promise.all([
        supabaseBrowser().from("student_subscriptions").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseBrowser().from("body_metrics").select("*").eq("student_id", user.id).order("recorded_at", { ascending: true }).limit(20),
      ]);
      return {
        data: { sub: (sRes.data ?? null) as StudentSubscriptions | null, metrics: (mRes.data ?? []) as any[] },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  const initials = useMemo(() => {
    const parts = (profile?.name ?? "?").trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  }, [profile?.name]);

  const avatarUrl = demo ? "https://i.pravatar.cc/160?img=12" : profile?.avatar_url || null;

  const weightSeries = useMemo(
    () =>
      (data?.metrics ?? []).map((m: any) => ({
        label: new Date(m.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        peso: m.weight_kg ?? 0,
      })),
    [data?.metrics]
  );

  const handleLogout = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const sub = data?.sub ?? null;
  const expiring = sub && sub.ends_at && new Date(sub.ends_at).getTime() - Date.now() < 14 * 86400000;
  const achievements = useMemo(() => sortedAchievements(), []);
  const earned = achievements.filter((a) => a.earned_at);
  const latestWeight = weightSeries[weightSeries.length - 1]?.peso ?? null;

  return (
    <>
      <TopBar title="Meu Perfil" subtitle={profile?.email ?? undefined} />

      <div className="space-y-6 p-4">
        {/* Identidade */}
        <div className="relative overflow-hidden rounded-[20px] border border-border">
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(120% 100% at 85% -20%, rgba(244,113,30,0.5), transparent 55%), linear-gradient(160deg, #16294C 0%, #0B1A33 70%)" }}
          />
          <button
            onClick={handleLogout}
            className="gf-touch absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:text-destructive"
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <div className="relative p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-[72px] w-[72px] border-[3px] border-card bg-card">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={`Foto de ${profile?.name ?? "perfil"}`} />}
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xl font-black text-brand-foreground">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-success" aria-label="Conta ativa" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black leading-tight text-white">{profile?.name || "Atleta"}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{profile?.email}</p>
                <div className="mt-2 flex gap-1.5">
                  <Badge variant="secondary">Aluno</Badge>
                  <Badge variant="success">Ativo</Badge>
                </div>
              </div>
            </div>

            {!avatarUrl ? (
              <button
                onClick={() => toast.info("Upload de foto em breve", { description: "Em produção você adiciona sua foto aqui." })}
                className="gf-touch mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/40 bg-brand/15 py-2 text-[11px] font-bold text-brand"
              >
                Adicionar foto
              </button>
            ) : null}
          </div>
        </div>

        {/* Matrícula */}
        <div className="gf-card gf-glass !py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="gf-section">Matrícula</p>
              <p className="text-sm font-bold text-foreground">
                {sub
                  ? `${sub.plan_name}${sub.type === "gympass" || sub.type === "totalpass" ? ` · ${sub.type === "gympass" ? "Gympass" : "TotalPass"}` : ""}`
                  : "Sem plano ativo"}
              </p>
            </div>
            {sub ? (
              expiring ? (
                <Badge variant="warning" className="gap-1"><CalendarClock className="h-3 w-3" /> vence {formatDate(sub.ends_at!)}</Badge>
              ) : (
                <Badge variant="success" className="gap-1"><CalendarClock className="h-3 w-3" /> até {formatDate(sub.ends_at!)}</Badge>
              )
            ) : (
              <Badge variant="warning">Vencida</Badge>
            )}
          </div>
          {sub && (sub.type === "gympass" || sub.type === "totalpass") ? (
            <p className="mt-2 rounded-lg bg-muted/70 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Matrícula via plataforma. Compareça nesta unidade para acumular streak, ranking e benefícios.
            </p>
          ) : null}
        </div>

        {/* Peso atual + evolução em um só bloco */}
        <div className="gf-card gf-glass !py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Evolução de peso</p>
            {latestWeight != null ? (
              <span className="gf-hero-num text-lg text-brand">
                {latestWeight}
                <span className="text-[11px] font-semibold text-muted-foreground"> kg</span>
              </span>
            ) : null}
          </div>
          {weightSeries.length > 0 ? (
            <div className="h-32">
              <WeightAreaD data={weightSeries} />
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Scale className="h-4 w-4 opacity-60" /> Registre medições para ver sua evolução.
            </p>
          )}
        </div>

        {/* Conquistas compactas (fonte única) */}
        <div className="gf-card gf-glass !py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Conquistas</p>
            <Link href="/conquistas" className="flex items-center gap-0.5 text-[11px] font-semibold text-brand">
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="gf-hero-num text-[28px] text-foreground">
              {earned.length}
              <span className="text-sm font-semibold text-muted-foreground">/{achievements.length}</span>
            </span>
            <div className="flex flex-1 -space-x-1.5">
              {earned.slice(0, 4).map((a) => (
                <span key={a.id} className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/25 bg-brand-soft text-lg" title={a.name}>
                  {a.icon}
                </span>
              ))}
              {earned.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhuma ainda. Bora treinar!</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Ações rápidas em lista única */}
        <div className="overflow-hidden rounded-[18px] border border-border">
          <Link href="/playlist" className="tactile flex w-full items-center gap-3 border-b border-border bg-card/40 px-4 py-3.5 transition-colors hover:bg-card/70">
            <ListMusic className="h-4 w-4 shrink-0 text-[#1DB954]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Playlist da academia</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <Link href="/premium" className="tactile flex w-full items-center gap-3 bg-card/40 px-4 py-3.5 transition-colors hover:bg-card/70">
            <FileText className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Relatórios avançados (PDF)</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </>
  );
}
