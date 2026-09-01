"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Trophy,
  MoreVertical,
  BadgeCheck,
  Sparkles,
  Flame,
  TrendingUp,
  Medal,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { isDemoMode, demoFallback } from "~/lib/demo-bridge";
import {
  adjustedPoints,
  addPointAdjustment,
  applyPenalty,
  listPointAdjustments,
  streakOverride,
  TRAINER_POINTS_EVENT,
  type PointAdjustment,
} from "~/lib/trainer-store";
import { demoPersonalStudents, studentStatus } from "~/lib/personal-data";
import type { Leaderboard, Profiles } from "~/lib/types/models";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

const MEDALS = ["#FFC24D", "#C9D4E8", "#E0965A"];

type RankRow = Leaderboard & { student: Profiles | null; final?: number };

/**
 * Ranking com PODERES DE GESTÃO: o personal valida conquistas, dá bônus
 * e zera streak. O score ajustado cai no ranking do aluno em tempo real.
 */
export default function PersonalRankingPage() {
  const demo = isDemoMode();
  const students = useMemo(() => demoPersonalStudents(), []);
  const [menuFor, setMenuFor] = useState<RankRow | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(TRAINER_POINTS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(TRAINER_POINTS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const { data, loading } = useAsyncQuery<{ rows: RankRow[] }>(
    async () => {
      void version;
      if (demo) {
        const ranks = [...(demoFallback("leaderboard") as Leaderboard[])];
        const profiles = demoFallback("profiles") as Profiles[];
        return {
          data: {
            rows: ranks.map((r) => ({
              ...r,
              student: profiles.find((p) => p.id === r.student_id) ?? null,
            })),
          },
          error: null,
        };
      }
      // produção: mesma query do ranking do aluno
      const { supabaseBrowser } = await import("~/lib/supabase/client");
      const supabase = supabaseBrowser();
      const { data: rows, error } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("rank_type", "load")
        .order("points", { ascending: false })
        .limit(20);
      if (error) return { data: null, error };
      const list = (rows ?? []) as Leaderboard[];
      const ids = [...new Set(list.map((r) => r.student_id))];
      let studentsDb: Profiles[] = [];
      if (ids.length) {
        const sRes = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
        if (!sRes.error) studentsDb = (sRes.data ?? []) as Profiles[];
      }
      return {
        data: {
          rows: list.map((r) => ({ ...r, student: studentsDb.find((s) => s.id === r.student_id) ?? null })),
        },
        error: null,
      };
    },
    [demo, version]
  );

  // nome mais confiável: perfil do leaderboard ou lista de alunos do personal
  const nameFor = (r: RankRow) =>
    r.student?.name ??
    students.find((s) => s.id === r.student_id || s.profile_id === r.student_id)?.name ??
    "Aluno";

  /** unifica o id: ajustes e streak ficam na chave do aluno do personal (st-*) */
  const studentIdFor = (r: RankRow) =>
    students.find((s) => s.profile_id === r.student_id)?.id ?? r.student_id;

  const sorted = useMemo(() => {
    const rows: RankRow[] = (data?.rows ?? []).map((r) => {
      const sid = studentIdFor(r);
      return { ...r, student_id: sid, final: adjustedPoints(r.points, sid) };
    });
    return rows.sort((a, b) => (b.final ?? 0) - (a.final ?? 0));
  }, [data, version]);

  const act = (r: RankRow, action: "validacao" | "bonus" | "penalidade") => {
    const name = nameFor(r);
    const sid = studentIdFor(r);
    if (action === "validacao") {
      addPointAdjustment({
        studentId: sid,
        studentName: name,
        type: "validacao",
        points: 75,
        reason: "Conquista validada pelo Personal",
      });
      toast.success(`Conquista validada: +75 pts para ${name.split(" ")[0]}`);
    } else if (action === "bonus") {
      addPointAdjustment({
        studentId: sid,
        studentName: name,
        type: "bonus",
        points: 50,
        reason: "Bônus por esforço excepcional",
      });
      toast.success(`Bônus aplicado: +50 pts para ${name.split(" ")[0]}`);
    } else {
      applyPenalty(sid, name);
      toast.success(`Streak de ${name.split(" ")[0]} zerado`);
    }
    setMenuFor(null);
  };

  const totalAdjustments = listPointAdjustments().length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Trophy className="h-5 w-5 text-brand" />
            Ranking
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {sorted.length} atletas · {totalAdjustments} ajustes seus aplicados
          </p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <motion.ul variants={container} initial="hidden" animate="show" className="space-y-2">
          {sorted.map((r, i) => {
            const name = nameFor(r);
            const student = students.find((s) => s.id === r.student_id || s.profile_id === r.student_id);
            const bonus = (r.final ?? r.points) - r.points;
            const zeroed = student ? streakOverride(student.id) === 0 : false;
            return (
              <motion.li key={r.id} variants={row}>
                <div
                  className={cn(
                    "gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-3.5",
                    i < 3 && "border-[#FFC24D]/20"
                  )}
                >
                  <span className="flex w-7 shrink-0 items-center justify-center">
                    {i < 3 ? (
                      <Medal className="h-5 w-5" style={{ color: MEDALS[i] }} />
                    ) : (
                      <span className="text-[13px] font-black tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <Avatar className="h-10 w-10 border border-white/[0.08]">
                    <AvatarImage src={student?.avatar ?? r.student?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                      {name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">{name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {zeroed ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#F87171]">
                          <Flame className="h-3 w-3" /> streak zerado
                        </span>
                      ) : student ? (
                        <span>{studentStatus(student).label}</span>
                      ) : (
                        <span>{r.sessions} sessões</span>
                      )}
                      {bonus !== 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 font-bold",
                            bonus > 0 ? "text-[#4ADE80]" : "text-[#F87171]"
                          )}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {bonus > 0 ? "+" : ""}
                          {bonus} pts
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="font-display text-base font-black tabular-nums text-foreground">
                      {r.final}
                    </span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      pts
                    </span>
                  </p>
                  <button
                    onClick={() => setMenuFor(r)}
                    aria-label={`Ações de gestão para ${name}`}
                    className="tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      {/* Menu de ações de gestão */}
      <BottomSheet open={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">{nameFor(menuFor)}</p>
              <p className="text-[11px] text-muted-foreground">
                {menuFor.final ?? menuFor.points} pts · base {menuFor.points} · poderes de gestão
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => act(menuFor, "validacao")}
                className="tactile flex w-full items-center gap-3 rounded-2xl border border-[#4ADE80]/25 bg-[#4ADE80]/[0.08] p-3.5 text-left transition-transform active:scale-[0.98]"
              >
                <BadgeCheck className="h-5 w-5 text-[#4ADE80]" />
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-foreground">Validar Conquista</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Aluno bateu uma meta, +75 pts ao confirmar
                  </span>
                </span>
              </button>
              <button
                onClick={() => act(menuFor, "bonus")}
                className="tactile flex w-full items-center gap-3 rounded-2xl border border-brand/25 bg-brand/[0.08] p-3.5 text-left transition-transform active:scale-[0.98]"
              >
                <Sparkles className="h-5 w-5 text-brand" />
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-foreground">Bônus de Pontos</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Esforço excepcional, +50 pts
                  </span>
                </span>
              </button>
              <button
                onClick={() => act(menuFor, "penalidade")}
                className="tactile flex w-full items-center gap-3 rounded-2xl border border-[#F87171]/25 bg-[#F87171]/[0.08] p-3.5 text-left transition-transform active:scale-[0.98]"
              >
                <Flame className="h-5 w-5 text-[#F87171]" />
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-foreground">Zerar Streak</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Punição por faltas, streak volta a zero
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
