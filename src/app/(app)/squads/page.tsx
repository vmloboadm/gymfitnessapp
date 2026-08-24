"use client";

import { Users, Trophy, ChevronRight, MessageSquare } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { formatDate } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { isDemoMode } from "~/lib/demo-bridge";
import type { SquadMembers, Squads } from "~/lib/types/models";

type SquadRow = Squads & { members: Array<SquadMembers & { name?: string }>; amIn: boolean };

const DEMO_SQUADS: SquadRow[] = [
  {
    id: "sq-1",
    gym_id: "1",
    name: "Turma das 6h",
    description: "Quem treina antes do sol. Café depois, sempre.",
    type: "grupo",
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    members: [
      { id: "sm-1", squad_id: "sq-1", user_id: "u2", joined_at: "", role: "member", name: "Lucas Andrade" },
      { id: "sm-2", squad_id: "sq-1", user_id: "u4", joined_at: "", role: "member", name: "Ana Júlia" },
      { id: "sm-3", squad_id: "sq-1", user_id: "u5", joined_at: "", role: "member", name: "Pedro Rocha" },
      { id: "sm-4", squad_id: "sq-1", user_id: "u6", joined_at: "", role: "member", name: "Marina Costa" },
      { id: "sm-5", squad_id: "sq-1", user_id: "u7", joined_at: "", role: "member", name: "Carlos Menezes" },
      { id: "sm-6", squad_id: "sq-1", user_id: "u8", joined_at: "", role: "member", name: "Juliana Ramos" },
    ],
    amIn: true,
    challenge_start: null,
    challenge_end: null,
  },
  {
    id: "sq-2",
    gym_id: "1",
    name: "Desafio Leg Press Total",
    description: "Maior volume acumulado no leg press até domingo vence. Vale ranking!",
    type: "desafio",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    members: [
      { id: "sm-7", squad_id: "sq-2", user_id: "u3", joined_at: "", role: "member", name: "Marina Costa" },
      { id: "sm-8", squad_id: "sq-2", user_id: "u4", joined_at: "", role: "member", name: "Pedro Rocha" },
      { id: "sm-9", squad_id: "sq-2", user_id: "u9", joined_at: "", role: "member", name: "Atleta Demo" },
    ],
    amIn: true,
    challenge_start: new Date(Date.now() - 4 * 86400000).toISOString(),
    challenge_end: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  {
    id: "sq-3",
    gym_id: "1",
    name: "Iniciantes 2026",
    description: "Apoio pra quem começou agora. Dúvidas, treinos e motivação.",
    type: "grupo",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    members: [
      { id: "sm-10", squad_id: "sq-3", user_id: "u10", joined_at: "", role: "member", name: "Ana Souza" },
      { id: "sm-11", squad_id: "sq-3", user_id: "u11", joined_at: "", role: "member", name: "Camila Ferreira" },
    ],
    amIn: false,
    challenge_start: null,
    challenge_end: null,
  },
] as unknown as SquadRow[];

/** % decorrido de um desafio (0–100) para a barra de progresso. */
function challengePct(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now >= e) return 100;
  if (now <= s) return 0;
  return Math.round(((now - s) / (e - s)) * 100);
}

/**
 * Squads do aluno: grupos e desafios da academia + membros contados.
 * (Chat completo dos times fica em /squads/[id] — futura iteração.)
 */
export default function SquadsPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<SquadRow[]>(
    async () => {
      if (demo) {
        return { data: DEMO_SQUADS, error: null };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const sqRes = await supabase
        .from("squads")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false });
      if (sqRes.error) return { data: null, error: sqRes.error };

      const squads = (sqRes.data ?? []) as Squads[];
      const ids = squads.map((s) => s.id);
      let members: SquadMembers[] = [];
      if (ids.length) {
        const mRes = await supabase.from("squad_members").select("*").in("squad_id", ids);
        if (mRes.error) return { data: null, error: mRes.error };
        members = (mRes.data ?? []) as SquadMembers[];
      }

      return {
        data: squads.map((s) => ({
          ...s,
          members: members.filter((m) => m.squad_id === s.id),
          amIn: members.some((m) => m.squad_id === s.id && m.user_id === user.id),
        })),
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  return (
    <>
      <TopBar title="Squads" subtitle="Grupos e desafios" />
      <div className="space-y-4 p-4">
        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.length === 0 ? (
          <EmptyState
            title="Nenhum grupo ainda"
            description="Squads são criados pelos personais e gestores da academia."
            icon={Users}
          />
        ) : (
          <div className="space-y-3">
            {data?.map((s, i) => {
              const pct = challengePct(s.challenge_start, s.challenge_end);
              const isChallenge = s.type === "desafio";
              return (
                <div
                  key={s.id}
                  className={cn(
                    "gf-rise rounded-xl border bg-card/40 p-4",
                    isChallenge && s.amIn ? "border-warning/40 bg-warning/[0.06]" : "border-border"
                  )}
                  style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {isChallenge ? <Trophy className="h-4 w-4 shrink-0 text-warning" /> : <Users className="h-4 w-4 shrink-0 text-brand" />}
                        <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      </div>
                      {s.description ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                      ) : null}
                      {s.challenge_start && s.challenge_end ? (
                        <p className="text-[11px] text-muted-foreground">
                          Desafio de {formatDate(s.challenge_start)} a {formatDate(s.challenge_end)}
                        </p>
                      ) : null}
                    </div>
                    {s.amIn ? <Badge variant="success">Você está dentro</Badge> : <Badge variant="secondary">{s.type}</Badge>}
                  </div>

                  {/* progresso do desafio em andamento */}
                  {isChallenge && pct != null ? (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                        <span>{s.amIn ? "Seu desafio" : "Andamento"}</span>
                        <span className="gf-hero-num !text-[10px]">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-card/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-warning transition-all duration-500"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex -space-x-2">
                      {s.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} className="h-6 w-6 border-2 border-card">
                          <AvatarFallback className="bg-secondary text-[9px] text-secondary-foreground">
                            {(m.name?.[0] ?? m.user_id[0] ?? "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {s.members.length > 5 ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-semibold text-secondary-foreground">
                          +{s.members.length - 5}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {s.members.length} {s.members.length === 1 ? "membro" : "membros"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
