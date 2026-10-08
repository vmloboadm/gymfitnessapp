"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Flame, Trophy, Target, CalendarCheck } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { startOfWeek } from "~/lib/utils/calculations";
import { formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoFallback } from "~/lib/demo-bridge";
import type { Leaderboard, Profiles } from "~/lib/types/models";

type Mate = { id: string; name: string | null; avatar_url: string | null; role: string | null };

const ROLE_LABEL: Record<string, string> = {
  student: "Aluno",
  trainer: "Personal",
  manager: "Gestor",
  admin: "Gestor",
};

/**
 * Perfil público de um membro da academia (aberto pelo ranking).
 * Mostra só a ficha esportiva da semana: posição, pontos, treinos e sequência.
 */
export default function PerfilAtletaPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const { user, profile, loading: authLoading } = useAuth();
  const demo = isDemoMode();

  useEffect(() => {
    if (!authLoading && user && id === user.id) router.replace("/perfil");
  }, [authLoading, user, id, router]);

  const { data, loading, error, refetch } = useAsyncQuery<{
    mate: Mate | null;
    points: number;
    sessions: number;
    streak: number;
    position: number;
    players: number;
  }>(
    async () => {
      if (demo) {
        const profiles = demoFallback("profiles") as Profiles[];
        const p = profiles.find((x) => x.id === id);
        if (!p) return { data: null, error: { message: "Atleta não encontrado" } };
        return {
          data: { mate: { id: p.id, name: p.name, avatar_url: p.avatar_url ?? null, role: "student" }, points: 1240, sessions: 4, streak: 5, position: 3, players: 12 },
          error: null,
        };
      }
      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
      const rpcRes = await supabase.rpc("gym_roster", { p_gym_id: profile.gym_id });
      if (rpcRes.error) return { data: null, error: rpcRes.error };
      const mate = ((rpcRes.data ?? []) as Mate[]).find((m) => m.id === id) ?? null;
      if (!mate) return { data: null, error: { message: "Atleta não encontrado" } };
      const weekStart = startOfWeek().toISOString().slice(0, 10);
      const { data: rows, error: lbErr } = await supabase
        .from("leaderboard")
        .select("student_id, points, sessions, streak")
        .eq("gym_id", profile.gym_id)
        .eq("week_start", weekStart)
        .eq("rank_type", "load")
        .order("points", { ascending: false })
        .limit(50);
      if (lbErr) return { data: null, error: lbErr };
      const list = (rows ?? []) as Array<Pick<Leaderboard, "student_id" | "points" | "sessions"> & { streak?: number | null }>;
      const idx = list.findIndex((r) => r.student_id === id);
      const me = idx >= 0 ? list[idx] : null;
      return {
        data: {
          mate,
          points: me?.points ?? 0,
          sessions: me?.sessions ?? 0,
          streak: me?.streak ?? 0,
          position: idx >= 0 ? idx + 1 : 0,
          players: list.length,
        },
        error: null,
      };
    },
    [id, user?.id, profile?.id, demo],
    { enabled: !authLoading && !!user && !!id && id !== user?.id }
  );

  const firstName = (data?.mate?.name ?? "Atleta").split(" ")[0];
  const initials = (data?.mate?.name ?? "A").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <TopBar title={firstName} subtitle={data?.mate ? ROLE_LABEL[data.mate.role ?? "student"] ?? "Aluno" : "Perfil do atleta"} />
      <div className="space-y-5 p-4">
        {loading ? (
          <SkeletonList rows={4} />
        ) : error || !data || !data.mate ? (
          <ErrorState message={error ?? "Atleta não encontrado"} onRetry={refetch} />
        ) : data.players === 0 ? (
          <EmptyState title="Semana ainda sem treinos" description="O ranking desta semana ainda não tem ninguém. Volte depois do primeiro treino." />
        ) : (
          <>
            <div className="gf-rise flex flex-col items-center gap-3 pt-2 text-center">
              <Avatar className="h-24 w-24 border-[3px] border-brand/50">
                {data.mate.avatar_url ? <AvatarImage src={data.mate.avatar_url} alt={data.mate.name ?? "Atleta"} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-2xl font-black text-brand-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-black text-foreground">{data.mate.name}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABEL[data.mate.role ?? "student"] ?? "Aluno"} · GymFitness
                </p>
              </div>
            </div>

            <div className="gf-rise grid grid-cols-2 gap-3" style={{ animationDelay: "80ms" }}>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-4">
                <Trophy className="h-4 w-4 text-[#FFC24D]" />
                <p className="pm-num text-[22px] text-foreground">{data.position > 0 ? `${data.position}º` : "-"}</p>
                <p className="text-[11px] text-muted-foreground">posição na semana</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-4">
                <Target className="h-4 w-4 text-brand" />
                <p className="pm-num text-[22px] text-foreground">{formatNumber(data.points)}</p>
                <p className="text-[11px] text-muted-foreground">pontos na semana</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-4">
                <CalendarCheck className="h-4 w-4 text-[#4ADE80]" />
                <p className="pm-num text-[22px] text-foreground">{data.sessions}</p>
                <p className="text-[11px] text-muted-foreground">{data.sessions === 1 ? "treino na semana" : "treinos na semana"}</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-4">
                <Flame className="h-4 w-4 text-[#FF9A5C]" />
                <p className="pm-num text-[22px] text-foreground">{data.streak}</p>
                <p className="text-[11px] text-muted-foreground">{data.streak === 1 ? "dia seguido" : "dias seguidos"}</p>
              </div>
            </div>

            <Link
              href="/ranking"
              className="gf-rise block rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-center text-[13px] font-bold text-brand"
              style={{ animationDelay: "160ms" }}
            >
              Ver ranking completo
            </Link>
          </>
        )}
      </div>
    </>
  );
}
