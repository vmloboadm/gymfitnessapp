"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  TrendingUp,
  Flame,
  Medal,
  CalendarRange,
  ChevronDown,
  Star,
  Shield,
  Zap,
  Crown,
  Users,
  Dumbbell,
  Compass,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  MASC_TITLES,
  FEM_TITLES,
  POINTS_RULES,
  type Gender,
  type MonthlyScore,
  type TitleDef,
} from "./mocks";

const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReduced()) {
      setVal(target);
      return;
    }
    let start: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

type MedalCategory = "consistencia" | "social" | "carga" | "exploracao";

const CATEGORY_LABEL: Record<MedalCategory, string> = {
  consistencia: "Consistência",
  social: "Social",
  carga: "Carga",
  exploracao: "Exploração",
};

interface MedalReq {
  ci?: number;
  streak?: number;
  auloes?: number;
  reacoes?: number;
  recebidas?: number;
  recordes?: number;
  grupos?: number;
  aparelhos?: number;
}

interface MedalDef {
  id: string;
  label: string;
  icon: typeof Star | typeof Shield | typeof Zap | typeof Crown | typeof Flame | typeof Trophy | typeof Users | typeof Dumbbell | typeof Compass;
  color: string;
  category: MedalCategory;
  req: MedalReq;
  rarity: "common" | "rare" | "epic" | "legendary";
  /** O que a pessoa precisa fazer — sem siglas, em português simples. */
  how: string;
}

const MEDALS: MedalDef[] = [
  // Consistência
  { id: "first-checkin", label: "Primeiro Passo", icon: Star, color: "#FFC24D", category: "consistencia", req: { ci: 1 }, rarity: "common", how: "Faça 1 check-in (venha à academia e registre a chegada)." },
  { id: "week-warrior", label: "Guerreiro da Semana", icon: Flame, color: "#FF6F16", category: "consistencia", req: { ci: 7, streak: 7 }, rarity: "common", how: "Treine 7 dias seguidos, sem pular." },
  { id: "streak-14", label: "Fogo Constante", icon: Zap, color: "#FF9A5C", category: "consistencia", req: { ci: 14, streak: 14 }, rarity: "rare", how: "Complete 14 dias seguidos de treino." },
  { id: "month-master", label: "Mestre do Mês", icon: Shield, color: "#4ADE80", category: "consistencia", req: { ci: 25, streak: 21 }, rarity: "rare", how: "Treine 25 vezes no mês e mantenha 21 dias seguidos." },
  { id: "iron-will", label: "Vontade de Ferro", icon: Crown, color: "#FFC24D", category: "consistencia", req: { ci: 40, streak: 30, auloes: 1 }, rarity: "legendary", how: "40 treinos no mês, 30 dias seguidos e pelo menos 1 aulão." },
  // Social
  { id: "first-react", label: "Primeira Reação", icon: Users, color: "#38BDF8", category: "social", req: { reacoes: 1 }, rarity: "common", how: "De 1 DAR FOGO (reação) numa conquista de um colega." },
  { id: "hype-welder", label: "Criador de Hype", icon: Flame, color: "#FB7185", category: "social", req: { reacoes: 5 }, rarity: "rare", how: "Reaja 🔥 5 conquistas de colegas." },
  { id: "mega-hype", label: "Sensei do Hype", icon: Crown, color: "#A78BFA", category: "social", req: { recebidas: 10 }, rarity: "epic", how: "Receba 10 reações 🔥 nas suas conquistas." },
  // Carga
  { id: "first-pr", label: "Primeiro Recorde", icon: Dumbbell, color: "#FBBF24", category: "carga", req: { recordes: 1 }, rarity: "common", how: "Bata seu recorde pessoal em 1 exercício." },
  { id: "pr-master", label: "Caçador de Records", icon: Zap, color: "#F97316", category: "carga", req: { recordes: 3 }, rarity: "epic", how: "Bata recorde pessoal em 3 exercícios diferentes." },
  // Exploração
  { id: "full-body", label: "Corpo Completo", icon: Compass, color: "#4ADE80", category: "exploracao", req: { grupos: 6 }, rarity: "rare", how: "Treine os 6 grupos musculares (peito, costas, pernas, ombros, braços, abdômen)." },
  { id: "explorer", label: "Explorador", icon: Compass, color: "#22D3EE", category: "exploracao", req: { aparelhos: 4 }, rarity: "epic", how: "Use 4 aparelhos diferentes na academia." },
];

export type MedalStats = {
  reacoes: number;
  recebidas: number;
  recordes: number;
  grupos: number;
  aparelhos: number;
};

export const MEDAL_STATS: MedalStats = {
  reacoes: 4,
  recebidas: 12,
  recordes: 2,
  grupos: 6,
  aparelhos: 3,
};

function isEarned(m: MedalDef, score: MonthlyScore, streak: number, stats: MedalStats) {
  const r = m.req;
  return (
    (r.ci ? score.checkins >= r.ci : true) &&
    (r.streak ? streak >= r.streak : true) &&
    (r.auloes ? score.auloes >= r.auloes : true) &&
    (r.reacoes ? stats.reacoes >= r.reacoes : true) &&
    (r.recebidas ? stats.recebidas >= r.recebidas : true) &&
    (r.recordes ? stats.recordes >= r.recordes : true) &&
    (r.grupos ? stats.grupos >= r.grupos : true) &&
    (r.aparelhos ? stats.aparelhos >= r.aparelhos : true)
  );
}

function getRarityGlow(rarity: MedalDef["rarity"]) {
  switch (rarity) {
    case "common":
      return "none";
    case "rare":
      return "0 0 8px rgba(74,222,128,0.4)";
    case "epic":
      return "0 0 10px rgba(168,85,247,0.5)";
    case "legendary":
      return "0 0 14px rgba(255,194,77,0.7)";
  }
}

/** Título mensal (identidade) — desbloqueado por check-ins + streak. */
export function TitleCard({ gender, checkins, streak }: { gender: Gender; checkins: number; streak: number }) {
  const titles: TitleDef[] = gender === "feminino" ? FEM_TITLES : MASC_TITLES;
  const current = [...titles].reverse().find((t) => checkins >= t.req[0] && streak >= t.req[1]) ?? titles[0];
  const next = titles.find((t) => t.req[0] > current.req[0] || t.req[1] > current.req[1]);

  const checkinsNeeded = next ? Math.max(0, next.req[0] - checkins) : 0;
  const streakNeeded = next ? Math.max(0, next.req[1] - streak) : 0;
  const checkinsProg = next ? Math.min(1, checkins / Math.max(1, next.req[0])) : 1;
  const streakProg = next ? Math.min(1, streak / Math.max(1, next.req[1])) : 1;

  return (
    <section className="pm-surface p-6">
      <div className="flex items-center justify-between">
        <p className="pm-mono text-[#7E8AA0]">Título do mês</p>
        <Trophy className="h-4 w-4 text-[#FFC24D]" />
      </div>
      <p className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-[#F4F6FB]">
        {current.label}
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-[#7E8AA0]">
          <span className="pm-mono">{checkins} check-ins · {streak}d streak</span>
          {next && (
            <span className="pm-mono text-[#FF9A5C]">
              {checkinsNeeded > 0 ? `${checkinsNeeded} check-ins` : ""}
              {checkinsNeeded > 0 && streakNeeded > 0 ? " + " : ""}
              {streakNeeded > 0 ? `${streakNeeded}d streak` : ""}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF8A3C] to-[#F4711E] shadow-[0_0_8px_rgba(244,113,30,0.6)]"
            style={{ width: `${Math.round(checkinsProg * 100)}%` }}
          />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF9A5C] to-[#FF7A2F] shadow-[0_0_8px_rgba(255,154,92,0.5)]"
            style={{ width: `${Math.round(streakProg * 100)}%` }}
          />
        </div>
        {next ? (
          <p className="mt-2 text-[12px] text-[#8B95A9]">
            Falta{" "}
            <span className="font-semibold text-[#E6EAF3]">
              {checkinsNeeded > 0 ? `${checkinsNeeded} check-ins` : ""}
              {checkinsNeeded > 0 && streakNeeded > 0 ? " e " : ""}
              {streakNeeded > 0 ? `${streakNeeded}d streak` : ""}
            </span>{" "}
            para desbloquear <span className="font-semibold text-[#FF9A5C]">“{next.label}”</span>
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[#8B95A9]">Título máximo do mês desbloqueado. Monstro!</p>
        )}
      </div>
    </section>
  );
}

/** Medalhas estilo Duolingo — retrátil. Ao abrir, explica cada conquista em linguagem simples. */
export function MedalsCard({
  score,
  streak,
  stats = MEDAL_STATS,
}: {
  score: MonthlyScore;
  streak: number;
  stats?: MedalStats;
}) {
  const [open, setOpen] = useState(false);
  const earned = (m: MedalDef) => isEarned(m, score, streak, stats);
  const earnedIds = new Set(MEDALS.filter(earned).map((m) => m.id));
  const nextMedal = MEDALS.find((m) => !earnedIds.has(m.id));
  const categories: MedalCategory[] = ["consistencia", "social", "carga", "exploracao"];

  return (
    <section className="pm-surface p-6">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="medals-body"
        className="tactile flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="pm-mono text-[#7E8AA0]">Conquistas</p>
          <p className="mt-0.5 text-[12px] text-[#8B95A9]">
            {earnedIds.size} de {MEDALS.length} desbloqueadas
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <span className="pm-mono text-[10px] text-[#7E8AA0]">{open ? "esconder" : "ver todas"}</span>
          <ChevronDown className={cn("h-4 w-4 text-[#7E8AA0] transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div id="medals-body" className="mt-5 space-y-4">
          {categories.map((cat) => {
            const group = MEDALS.filter((m) => m.category === cat);
            const got = group.filter((m) => earnedIds.has(m.id)).length;
            return (
              <div key={cat}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="pm-mono text-[10px] uppercase tracking-[0.12em] text-[#7E8AA0]">{CATEGORY_LABEL[cat]}</p>
                  <p className="pm-mono text-[9px] text-[#6E7A90]">{got} de {group.length}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {group.map((m) => {
                    const isOk = earnedIds.has(m.id);
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-[14px] border p-3.5",
                          isOk ? "border-brand/40" : "border-white/[0.06] opacity-60"
                        )}
                        style={{ boxShadow: isOk ? getRarityGlow(m.rarity) : "none" }}
                        aria-label={isOk ? `${m.label} desbloqueada` : `${m.label} — bloqueada`}
                        title={`${m.how}${isOk ? "" : " (ainda não conquistada)"}`}
                      >
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-[12px] border"
                          style={isOk ? { background: `linear-gradient(135deg, ${m.color}33, ${m.color}0d)`, borderColor: `${m.color}55` } : { borderColor: "rgba(255,255,255,0.07)" }}
                        >
                          <Icon className="h-6 w-6" style={isOk ? { color: m.color } : { color: "#6E7A90" }} />
                        </div>
                        <p className={cn("text-center text-[11px] font-semibold leading-tight", isOk ? "text-[#F4F6FB]" : "text-[#7E8AA0]")}>
                          {m.label}
                        </p>
                        <p className="pm-mono text-[8px] leading-snug text-[#6E7A90]">
                          {isOk ? "conquistada ✓" : "toque e leia como fazer"}
                        </p>
                        {isOk && m.rarity !== "common" && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-brand/90 px-1.5 py-0.5 text-[7px] font-bold uppercase text-white">
                            {m.rarity === "legendary" ? "LENDA" : m.rarity}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* legenda leiga — explica as siglas */}
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-[11px] leading-relaxed text-[#8B95A9]">
            <p className="pm-mono mb-1.5 text-[9px] text-[#7E8AA0]">como ler as conquistas</p>
            <p><span className="font-semibold text-[#BFC7D8]">CI</span> = ida à academia (check-in)</p>
            <p><span className="font-semibold text-[#BFC7D8]">STK</span> = sequência de dias seguidos</p>
            <p><span className="font-semibold text-[#BFC7D8]">AUL</span> = aula coletiva (aulão)</p>
            <p className="mt-1.5">Toque numa medalha para ler o passo a passo de como conquistá-la.</p>
          </div>
        </div>
      ) : (
        nextMedal ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[12px] text-[#8B95A9]">Próxima conquista</p>
              <p className="pm-mono mt-0.5 truncate text-[10px] text-[#BFC7D8]">“{nextMedal.label}”</p>
            </div>
            <p className="shrink-0 pm-mono text-[9px] text-[#6E7A90]">{nextMedal.how.slice(0, 34)}…</p>
          </div>
        ) : null
      )}
    </section>
  );
}

/** Pontos do mês + regras de constância. */
export function PointsCard({ score }: { score: MonthlyScore }) {
  const val = useCountUp(score.total);
  const rows = [
    { icon: Flame, label: `${score.checkins} check-ins`, pts: score.checkins * POINTS_RULES.CHECKIN },
    { icon: CalendarRange, label: `${score.auloes} aulões`, pts: score.auloes * POINTS_RULES.AULAO },
    { icon: Medal, label: `${score.metasBatidas} metas na semana`, pts: score.metasBatidas * POINTS_RULES.META_SEMANAL },
  ];

  return (
    <section className="pm-surface p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="pm-mono text-[#7E8AA0]">Seus pontos no mês</p>
          <p className="mt-1 pm-num text-[44px] text-[#F4F6FB]">{val}</p>
        </div>
        <TrendingUp className="mb-1 h-5 w-5 text-[#4ADE80]" />
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <span className="flex items-center gap-2.5 text-[12px] text-[#D6DCEC]">
                <Icon className="h-4 w-4 text-[#FF9A5C]" />
                {r.label}
              </span>
              <span className="pm-num text-[14px] text-[#E6EAF3]">+{r.pts}</span>
            </div>
          );
        })}
      </div>

      <p className={cn("pm-mono mt-4 text-[9px] text-[#6E7A90]")}>
        check-in 10 · aulão 30 · meta semanal 50 — o ranking zera todo dia 1º
      </p>
    </section>
  );
}
/** Título do mês em formato compacto — para exibição como linha secundária
    dentro do card de liga/ranking (consolidação de gamificação). */
export function titleFor(gender: Gender, checkins: number, streak: number): { label: string; nextLabel: string | null } {
  const titles: TitleDef[] = gender === "feminino" ? FEM_TITLES : MASC_TITLES;
  const current = [...titles].reverse().find((t) => checkins >= t.req[0] && streak >= t.req[1]) ?? titles[0];
  const next = titles.find((t) => t.req[0] > current.req[0] || t.req[1] > current.req[1]);
  return { label: current.label, nextLabel: next?.label ?? null };
}
