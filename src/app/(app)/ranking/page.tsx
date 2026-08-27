"use client";

import { Crown, Medal, Trophy, Users, Flame, TrendingUp, ChevronRight, Gem, Award } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { startOfWeek } from "~/lib/utils/calculations";
import { formatNumber, formatDate } from "~/lib/utils/format";
import { LEAGUES, leagueFor } from "~/lib/utils/leagues";
import { cn } from "~/lib/utils";
import { isDemoMode, demoFallback } from "~/lib/demo-bridge";
import { recentAchievements } from "~/lib/achievements";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import type { Leaderboard, Profiles } from "~/lib/types/models";

// Ligas por faixa (gamificação estilo Duolingo)

const ME = "00000000-0000-0000-0000-000000000099";

/** Avatar mock determinístico, campo avatar_url do perfil assume em produção. */
function avatarFor(id: string | undefined): string {
  let n = 0;
  for (const ch of id ?? "") n = (n * 31 + ch.charCodeAt(0)) % 70;
  return `https://i.pravatar.cc/96?img=${n + 1}`;
}

/* Ícones de liga em traço consistente (nada de emoji): mesmo padrão da home */
const LEAGUE_GLYPHS: Record<string, { Icon: typeof Trophy; color: string }> = {
  bronze: { Icon: Award, color: "#C98A4B" },
  prata: { Icon: Award, color: "#B8C4D8" },
  ouro: { Icon: Trophy, color: "#FFC24D" },
  platina: { Icon: Gem, color: "#67E8F9" },
  diamante: { Icon: Crown, color: "#F4711E" },
};

function LeagueGlyph({ id, className, size = 16 }: { id: string; className?: string; size?: number }) {
  const glyph = LEAGUE_GLYPHS[id] ?? LEAGUE_GLYPHS.bronze;
  const Icon = glyph.Icon;
  return <Icon className={className} style={{ color: glyph.color, width: size, height: size }} aria-hidden />;
}

export default function RankingPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{
    rows: (Leaderboard & { student: Profiles | null })[];
    mine: Leaderboard | null;
  }>(
    async () => {
      if (demo) {
        const ranks = demoFallback("leaderboard") as Leaderboard[];
        const profiles = demoFallback("profiles") as Profiles[];
        // garante o "eu" na primeira posição pra gamificação ficar viva
        const meIdx = ranks.findIndex((r) => r.student_id === ME);
        if (meIdx === -1) {
          ranks.unshift({
            id: "rk-me", gym_id: "1", week_start: "2026-08-10",
            student_id: ME, rank_type: "load", points: 1980, load_kg: 15200, sessions: 10,
          });
        }
        return {
          data: {
            rows: ranks.map((r) => ({
              ...r,
              student: profiles.find((p) => p.id === r.student_id) ?? (r.student_id === ME ? { id: ME, name: "Atleta Demo" } as any : null),
            })),
            mine: ranks.find((r) => r.student_id === ME) ?? null,
          },
          error: null,
        };
      }
      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
      const weekStart = startOfWeek().toISOString();
      const { data: rows, error } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .eq("week_start", weekStart)
        .eq("rank_type", "load")
        .order("points", { ascending: false })
        .limit(20);
      if (error) return { data: null, error };
      const list = (rows ?? []) as Leaderboard[];
      const ids = [...new Set(list.map((r) => r.student_id))];
      let students: Profiles[] = [];
      if (ids.length) {
        const sRes = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
        if (!sRes.error) students = (sRes.data ?? []) as Profiles[];
      }
      const mine = list.find((r) => r.student_id === user.id) ?? null;
      return {
        data: {
          rows: list.map((r) => ({ ...r, student: students.find((s) => s.id === r.student_id) ?? null })),
          mine,
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  const mine = data?.mine ?? null;
  const myLeague = leagueFor(mine?.points ?? 0);
  const myRank = data?.rows.findIndex((r) => r.student_id === (user?.id ?? ME)) ?? -1;
  const weekStart = startOfWeek();

  // minutos pra reset
  const resetMins = useResetCountdown(weekStart);

  return (
    <>
      <TopBar title="Ranking" subtitle="Liga da semana · competição saudável" />

      <div className="space-y-6 p-4">
        {/* Minha liga + reset */}
        <div className="gf-rise relative overflow-hidden rounded-[20px] border border-brand/40 bg-gradient-to-br from-brand/20 via-card to-card p-5 shadow-[0_20px_40px_-20px_rgba(244,113,30,0.4)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "radial-gradient(90% 90% at 85% -10%, var(--brand-soft), transparent 55%)" }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="gf-section">Sua liga</p>
              <p className={cn("flex items-center gap-2 font-display text-2xl font-bold tracking-tight", myLeague.color)}>
                <LeagueGlyph id={myLeague.id} size={28} />
                {myLeague.label}
              </p>
              <p className="gf-hero-num text-sm text-foreground">
                {mine ? `${formatNumber(mine.points)} pts · ${myRank + 1}º` : "Sem pontos esta semana"}
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-[11px] font-semibold text-warning">
                <span className="hero-live-dot" /> reset em {resetMins}m
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                próximos: {LEAGUES[(LEAGUES.findIndex((l) => l.id === myLeague.id) + 1) % LEAGUES.length].label}
              </p>
            </div>
          </div>
          {/* progresso até próxima liga */}
          <div className="relative mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-card/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-warning"
                style={{ width: `${Math.min(100, ((mine?.points ?? 0) % 800) / 8)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{leagueFor((mine?.points ?? 0) - 800).label}</span>
              <span className="font-semibold text-brand">subir com +{800 - ((mine?.points ?? 0) % 800)} pts</span>
            </div>
          </div>
        </div>

        {/* Trilha de ligas, onde você está e o que vem depois */}
        <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "60ms" }}>
          <p className="gf-section mb-3">Trilha de ligas</p>
          <div className="flex items-center justify-between gap-1">
            {LEAGUES.map((l) => {
              const reached = (mine?.points ?? 0) >= l.min;
              const current = l.id === myLeague.id;
              return (
                <div key={l.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      current ? "border-brand bg-brand-soft shadow-[0_0_14px_rgba(244,113,30,0.35)]" : reached ? "border-border bg-card/50" : "border-border/60 bg-card/20 opacity-40 grayscale"
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    <LeagueGlyph id={l.id} size={16} />
                  </span>
                  <span className={cn("text-[9px] font-bold uppercase tracking-wide", current ? "text-brand" : "text-muted-foreground")}>
                    {l.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pódio, top 3 da semana em destaque — 1º central, mais alto */}
        {!loading && !error && data && data.rows.length >= 3 ? (
          <div className="gf-rise rounded-[20px] border border-border bg-card/40 p-4" style={{ animationDelay: "120ms" }}>
            <p className="gf-section mb-3">Pódio da semana</p>
            <div className="grid grid-cols-3 items-end gap-2">
              {[1, 0, 2].map((pos) => {
                const row = data.rows[pos];
                if (!row) return null;
                // altura por MÉRITO: 1º mais alto no centro
                const height = pos === 0 ? "h-28" : pos === 1 ? "h-20" : "h-14";
                const avatarSize = pos === 0 ? "h-16 w-16" : "h-14 w-14";
                const MedalIcon = pos === 0 ? Crown : Medal;
                const medalColor = pos === 0 ? "#FBBF24" : pos === 1 ? "#E5E7EB" : "#D97706";
                const medalTone = pos === 0 ? "text-[#FBBF24]" : pos === 1 ? "text-[#E5E7EB]" : "text-[#D97706]";
                return (
                  <Link
                    key={row.id}
                    href="/perfil"
                    className="group flex flex-col items-center gap-1.5"
                    aria-label={`${pos + 1}º lugar: ${row.student?.name ?? "Aluno"}`}
                  >
                    <MedalIcon className={cn("h-5 w-5", medalTone)} aria-hidden />
                    <Avatar
                      className={cn(
                        "ring-[3px] transition-transform group-hover:scale-105",
                        avatarSize
                      )}
                      style={{ boxShadow: `0 0 22px ${medalColor}66` }}
                    >
                      <span
                        className="absolute inset-0 rounded-full"
                        style={{ boxShadow: `inset 0 0 0 3px ${medalColor}` }}
                        aria-hidden
                      />
                      <AvatarImage src={row.student?.avatar_url ?? avatarFor(row.student_id)} alt={row.student?.name ?? "Atleta"} />
                      <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                        {(row.student?.name?.[0] ?? "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="max-w-full truncate text-[11px] font-semibold text-foreground group-hover:text-brand">
                      {row.student?.name?.split(" ")[0] ?? "Aluno"}
                      {row.student_id === (user?.id ?? ME) ? " (você)" : ""}
                    </p>
                    <div
                      className={cn(
                        "flex w-full items-start justify-center rounded-t-xl border-t border-x pt-2",
                        height,
                        pos === 0 ? "bg-gradient-to-b from-[#FBBF24]/20 to-transparent" : pos === 1 ? "bg-gradient-to-b from-[#E5E7EB]/15 to-transparent" : "bg-gradient-to-b from-[#D97706]/20 to-transparent"
                      )}
                      style={{ borderColor: `${medalColor}88`, boxShadow: `inset 0 12px 24px -12px ${medalColor}55` }}
                    >
                      <span className="gf-hero-num text-base">{formatNumber(row.points)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Badges de gamificação */}
        <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "180ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="gf-section">Suas conquistas</p>
            <Link href="/conquistas" className="flex items-center gap-0.5 text-[11px] font-semibold text-brand">
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {recentAchievements(3).map((a) => (
              <div key={a.id} className="flex flex-col items-center gap-1 rounded-xl border border-brand/30 bg-brand-soft/25 px-2 py-3 text-center">
                <FitnessIcon glyph={fitnessForName(a.name)} size={20} />
                <span className="text-[9px] leading-tight text-muted-foreground">{a.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Últimas conquistas · lista completa no seu Perfil</p>
        </div>

        {/* Ranking numérico — continuação direta do pódio (4º em diante) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Trophy className="h-4 w-4 text-brand" /> Ranking da semana
            </h3>
            <Badge variant="outline" className="text-[10px]">
              reset {formatDate(weekStart.toISOString())}
            </Badge>
          </div>
          <p className="mb-2 text-[10px] text-muted-foreground">
            4º lugar em diante · mesma liga, ordenado por pontos
          </p>

          {loading ? (
            <SkeletonList rows={8} />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : data?.rows.length === 0 ? (
            <EmptyState
              title="Ranking vazio esta semana"
              description="As posições são calculadas pela carga total dos treinos da semana."
              icon={Users}
            />
          ) : (
            <div className="space-y-2 pb-4">
              {data?.rows.slice(3).map((row, i) => {
                const league = leagueFor(row.points);
                const glyphC = LEAGUE_GLYPHS[league.id]?.color ?? "#B8C4D8";
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "gf-rise relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card/40 p-3",
                      row.student_id === (user?.id ?? ME) ? "border-brand/50 bg-brand/5" : "border-border"
                    )}
                    style={{ borderLeft: `3px solid ${glyphC}`, animationDelay: `${Math.min(i * 40, 320)}ms` }}
                  >
                    <div className="w-7 shrink-0 text-center">
                      <span className="gf-hero-num text-sm font-bold text-muted-foreground">{i + 4}</span>
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={row.student?.avatar_url ?? avatarFor(row.student_id)} alt={row.student?.name ?? "Atleta"} />
                      <AvatarFallback className="bg-secondary text-[11px] text-secondary-foreground">
                        {(row.student?.name?.[0] ?? "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {row.student?.name ?? "Aluno"}
                      {row.student_id === (user?.id ?? ME) ? <span className="ml-1 text-xs text-brand">(você)</span> : null}
                    </p>
                    <span className="gf-hero-num shrink-0 text-sm text-foreground">{formatNumber(row.points)}<span className="text-[10px] text-muted-foreground"> pts</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card fixo: você fora do pódio — quanto falta pro Top 3 */}
        {!loading && !error && data && myRank >= 3 && mine ? (
          (() => {
            const third = data.rows[2];
            const target = third?.points ?? 0;
            const gap = Math.max(0, target - mine.points);
            const pct = target > 0 ? Math.min(100, (mine.points / target) * 100) : 100;
            return (
              <div
                className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 mx-auto max-w-md px-4"
                aria-live="polite"
              >
                <div className="rounded-2xl border border-brand/50 bg-[#081020]/95 p-3.5 shadow-[0_0_24px_rgba(244,113,30,0.25)] backdrop-blur">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-black text-foreground">
                      Você está em <span className="text-[#F4711E]">{myRank + 1}º</span> lugar
                    </span>
                    <span className="font-semibold text-muted-foreground">
                      {gap > 0 ? `faltam ${formatNumber(gap)} pts pro 3º` : "no pódio!"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-warning"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}

        {/* Explanations */}
        <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "240ms" }}>
          <p className="gf-section mb-2">Como pontua</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                <Flame className="h-3.5 w-3.5 text-brand" />
              </span>
              <span>Carga movida conta pontos. Suba de liga acumulando entre 800 e 2.600+ pontos.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                <TrendingUp className="h-3.5 w-3.5 text-brand" />
              </span>
              <span>Reset toda segunda-feira, todo mundo recomeça, mantendo iniciante competitivo.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function useResetCountdown(weekStart: Date): number {
  const nextMonday = new Date(weekStart);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const secondsUntil = Math.max(0, Math.floor((nextMonday.getTime() - Date.now()) / 1000));
  return Math.ceil(Math.min(secondsUntil, 7 * 24 * 60) / 60);
}