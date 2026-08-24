"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, LogOut, Trophy, FileText, Music2, ChevronRight, CalendarClock, TrendingUp, Lock, Camera } from "lucide-react";
import { toast } from "sonner";
import { PesoAreaChart, CargaAreaChart } from "~/components/charts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatDate, formatBRL } from "~/lib/utils/format";
import { isDemoMode, demoMetricsData, demoWorkoutLogs } from "~/lib/demo-bridge";
import { STUDENT_ACHIEVEMENTS } from "~/lib/achievements";
import type { StudentSubscriptions } from "~/lib/types/models";

const CONQUISTAS = STUDENT_ACHIEVEMENTS.map((a) => ({ code: a.id, name: a.name, emoji: a.icon, got: !!a.earned_at }));

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
        return {
          data: { sub, metrics: demoMetricsData().metrics },
          error: null,
        };
      }
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
      const [sRes, mRes] = await Promise.all([
        supabaseBrowser()
          .from("student_subscriptions")
          .select("*")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseBrowser().from("body_metrics").select("*").eq("student_id", user.id).order("recorded_at", { ascending: true }).limit(20),
      ]);
      return {
        data: {
          sub: (sRes.data ?? null) as StudentSubscriptions | null,
          metrics: (mRes.data ?? []) as any[],
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  const initials = useMemo(() => {
    const parts = (profile?.name ?? "?").trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  }, [profile?.name]);

  // Foto de perfil: obrigatória — mock usa pravatar; produção usa avatar_url real.
  const avatarUrl = demo
    ? "https://i.pravatar.cc/160?img=12"
    : profile?.avatar_url || null;

  // Gráfico de evolução de peso (métricas)
  const weightChart = useMemo(
    () =>
      (data?.metrics ?? []).map((m: any) => ({
        label: new Date(m.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        peso: m.weight_kg ?? 0,
      })),
    [data?.metrics]
  );

  // Evolução de carga (demo) — mesma lógica visual do Progresso
  const loadChart = useMemo(
    () =>
      demo
        ? [
            { label: "S1", kg: 60 },
            { label: "S2", kg: 62.5 },
            { label: "S3", kg: 65 },
            { label: "S4", kg: 67.5 },
            { label: "S5", kg: 70 },
            { label: "S6", kg: 72.5 },
          ]
        : [],
    [demo]
  );

  // Recordes pessoais (demo): top cargas
  const records = useMemo(() => {
    if (!demo) return [];
    const logs = demoWorkoutLogs();
    const byEx: Record<string, { name: string; max: number }> = {};
    logs.forEach((l: any) => {
      const n = "Supino Reto";
      if (!byEx[n] || l.weight_kg > byEx[n].max) byEx[n] = { name: n, max: l.weight_kg };
    });
    return Object.values(byEx)
      .sort((a, b) => b.max - a.max)
      .slice(0, 3);
  }, [demo]);

  const handleLogout = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  // Status da matrícula
  const sub = data?.sub ?? null;
  const expiring = sub && sub.ends_at && new Date(sub.ends_at).getTime() - Date.now() < 14 * 86400000;

  return (
    <>
      <TopBar title="Meu Perfil" subtitle={profile?.email ?? "Atleta"} />

      <div className="space-y-6 p-4">
        {/* Header com capa + foto */}
        <div className="relative overflow-hidden rounded-[20px] border border-border pm-surface">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 85% -20%, rgba(244,113,30,0.5), transparent 55%), linear-gradient(160deg, #16294C 0%, #0B1A33 70%)",
            }}
          />
          <div className="relative p-5 pb-4">
            <div className="flex items-end justify-between gap-3">
              <div className="relative">
                <Avatar className="h-16 w-16 border-[3px] border-card bg-card">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={`Foto de ${profile?.name ?? "perfil"}`} />}
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xl font-black text-brand-foreground">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-success text-[10px] text-success-foreground">
                  ✓
                </span>
              </div>
              <div className="relative pb-0.5">
                {!avatarUrl ? (
                  <button
                    onClick={() => toast.info("Upload de foto em breve", { description: "Em produção você adiciona sua foto aqui. Por enquanto, aproveite o demo." })}
                    className="gf-touch flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/15 px-3 py-1.5 text-[11px] font-bold text-brand"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Adicionar foto
                  </button>
                ) : (
                  <p className="pm-mono text-[9px] text-[#3A4152]">foto verificada</p>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="gf-touch flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:text-destructive"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 truncate text-lg font-bold text-foreground">{profile?.name || "Atleta"}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" /> {profile?.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">Aluno</Badge>
              <Badge variant="success" className="gap-1">Ativo</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label="Tempo médio/sessão" value="48 min" emoji="⏱️" />
              <MiniStat label="Grupo mais treinado" value="Perna" emoji="🦵" />
            </div>
          </div>
        </div>

        {/* Matrícula */}
        <div className="gf-card gf-glass !py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="gf-section">Matrícula</p>
              <p className="text-sm font-bold text-foreground">
                {sub
                  ? `${sub.plan_name}${sub.type === "gympass" || sub.type === "totalpass" ? ` · ${sub.type === "gympass" ? "Gympass" : "TotalPass"}` : ` · ${formatBRL(sub.price)}`}`
                  : "Sem plano ativo"}
              </p>
            </div>
            {sub ? (
              expiring ? (
                <Badge variant="warning" className="gap-1">
                  <CalendarClock className="h-3 w-3" /> vence {formatDate(sub.ends_at!)}
                </Badge>
              ) : (
                <Badge variant="success" className="gap-1">
                  <CalendarClock className="h-3 w-3" /> até {sub.ends_at ? formatDate(sub.ends_at) : "—"}
                </Badge>
              )
            ) : (
              <Badge variant="warning">Vencida</Badge>
            )}
          </div>
          {sub && (sub.type === "gympass" || sub.type === "totalpass") && (
            <p className="mt-2 rounded-lg bg-muted/70 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Matrícula via plataforma — compareça nesta unidade para acumular streak, ranking e benefícios da comunidade.
            </p>
          )}
        </div>

        {/* Evolução de peso */}
        <div className="gf-card gf-glass !py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Evolução de peso</p>
            <Badge variant="outline" className="text-[10px]">
              {weightChart.length} medições
            </Badge>
          </div>
          {weightChart.length > 0 ? (
            <div className="h-32">
              <PesoAreaChart data={weightChart} />
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Registre medições para ver sua evolução.
            </p>
          )}
        </div>

        {/* Evolução de carga (demo) — mesmo estilo recharts do Progresso */}
        <div className="gf-card gf-glass !py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Evolução de carga (supino)</p>
            <Badge variant="success" className="gap-1 text-[10px]">
              <TrendingUp className="h-3 w-3" /> +22%
            </Badge>
          </div>
          <div className="h-28">
            <CargaAreaChart data={loadChart} />
          </div>
        </div>

        {/* Recordes */}
        {records.length > 0 && (
          <div className="gf-card gf-glass !py-4">
            <p className="mb-2 flex items-center gap-1.5 gf-section">
              <Trophy className="h-3.5 w-3.5 text-brand" /> Recordes pessoais
            </p>
            <div className="space-y-1.5">
              {records.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between rounded-xl bg-card/60 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="text-base">{["🥇", "🥈", "🥉"][i]}</span>
                    {r.name}
                  </span>
                  <span className="gf-hero-num text-sm text-brand">{r.max} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conquistas — timeline */}
        <div className="gf-card gf-glass !py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Conquistas</p>
            <Link href="/conquistas" className="flex items-center gap-0.5 text-[11px] font-semibold text-brand">
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {CONQUISTAS.map((c) => (
              <div key={c.code} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", c.got ? "bg-card/60" : "bg-card/30 opacity-55")}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg", c.got ? "bg-brand-soft" : "bg-muted")}>
                  {c.got ? c.emoji : <Lock className="h-4 w-4 text-muted-foreground" />}
                </span>
                <span className={cn("flex-1 text-[13px] font-semibold", c.got ? "text-foreground" : "text-muted-foreground")}>{c.name}</span>
                {c.got ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">✓</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">em breve</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Spotify */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1DB954]/20 text-[#1DB954]">
            <Music2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Playlist da academia</p>
            <p className="text-xs text-muted-foreground">Música certa pro seu treino</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/playlist">Abrir</Link>
          </Button>
        </div>

        {/* Premium */}
        <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft/20 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Relatórios avançados</p>
            <p className="text-xs text-muted-foreground">PDF de evolução sob solicitação</p>
          </div>
          <Button size="sm" asChild>
            <Link href="/premium">Solicitar</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
      <p className="text-lg">{emoji}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}