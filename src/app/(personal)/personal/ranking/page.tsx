"use client";

import { useEffect, useMemo, useState } from "react";
import { m, type Variants } from "framer-motion";
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
import { useAuth } from "~/hooks/useAuth";
import { getGymStudents, getRankingRows, saveAdjustment } from "~/lib/gym-api";
import type { PersonalStudent } from "~/lib/personal-data";
import type { PointAdjustment } from "~/lib/trainer-store";
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

type RankRow = {
  studentId: string;
  name: string;
  avatar: string | null;
  basePoints: number;
  adjustments: PointAdjustment[];
  streakZeroed: boolean;
};

/**
 * Ranking com PODERES DE GESTÃO: valida conquistas, dá bônus e zera streak.
 * Produção: leaderboard do banco + leaderboard_adjustments persistidos.
 */
export default function PersonalRankingPage() {
  const { profile, user } = useAuth();
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [menuFor, setMenuFor] = useState<RankRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const gymId = profile?.gym_id ?? "";

  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    (async () => {
      try {
        const st = await getGymStudents(gymId);
        if (!alive) return;
        setStudents(st);
        const r = await getRankingRows(gymId, st);
        if (!alive) return;
        setRows(r);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId, tick]);

  const totalAdjustments = useMemo(
    () => rows.reduce((acc, r) => acc + r.adjustments.length, 0),
    [rows]
  );

  const act = async (r: RankRow, action: "validacao" | "bonus" | "penalidade") => {
    if (!profile || !user) return;
    const student = students.find((s) => s.id === r.studentId);
    if (!student) return;
    const name = r.name.split(" ")[0];
    try {
      if (action === "validacao") {
        await saveAdjustment({
          gymId: profile.gym_id,
          userId: user.id,
          student,
          type: "validacao",
          points: 75,
          reason: "Conquista validada pelo Personal",
        });
        toast.success(`Conquista validada: +75 pts para ${name}`);
      } else if (action === "bonus") {
        await saveAdjustment({
          gymId: profile.gym_id,
          userId: user.id,
          student,
          type: "bonus",
          points: 50,
          reason: "Bônus por esforço excepcional",
        });
        toast.success(`Bônus aplicado: +50 pts para ${name}`);
      } else {
        await saveAdjustment({
          gymId: profile.gym_id,
          userId: user.id,
          student,
          type: "penalidade",
          points: 0,
          reason: "Streak zerado pelo Personal (faltas)",
        });
        toast.success(`Streak de ${name} zerado`);
      }
      setMenuFor(null);
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar. Tente novamente.");
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Trophy className="h-5 w-5 text-brand" />
            Ranking
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {rows.length} atletas · {totalAdjustments} ajustes seus aplicados
          </p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
          <Trophy className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Nenhum atleta no ranking ainda</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Assim que os alunos treinarem e fizerem check-in, os pontos aparecem aqui.
          </p>
        </div>
      ) : (
        <m.ul variants={container} initial="hidden" animate="show" className="space-y-2">
          {rows.map((r, i) => {
            const final = r.basePoints + r.adjustments.reduce((x, a) => x + a.points, 0);
            const bonus = final - r.basePoints;
            return (
              <m.li key={r.studentId} variants={row}>
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
                    <AvatarImage src={r.avatar ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                      {r.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">{r.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {r.streakZeroed ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#F87171]">
                          <Flame className="h-3 w-3" /> streak zerado
                        </span>
                      ) : (
                        <span>{r.basePoints} pts base</span>
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
                      {final}
                    </span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      pts
                    </span>
                  </p>
                  <button
                    onClick={() => setMenuFor(r)}
                    aria-label={`Ações de gestão para ${r.name}`}
                    className="tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </m.li>
            );
          })}
        </m.ul>
      )}

      {/* Menu de ações de gestão */}
      <BottomSheet open={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">{menuFor.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {menuFor.basePoints + menuFor.adjustments.reduce((x, a) => x + a.points, 0)} pts ·
                base {menuFor.basePoints} · poderes de gestão
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
