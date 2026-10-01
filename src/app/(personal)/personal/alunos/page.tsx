"use client";

import { useEffect, useState, useCallback } from "react";
import { m, type Variants } from "framer-motion";
import {
  Search,
  ChevronRight,
  UserCheck,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { StudentSheet } from "~/components/personal/StudentSheet";
import { useAuth } from "~/hooks/useAuth";
import { studentStatus, type PersonalStudent } from "~/lib/personal-data";
import { getGymStudents } from "~/lib/gym-api";
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

const TONE = {
  green: "bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  amber: "bg-[#FFC24D] shadow-[0_0_8px_rgba(255,194,77,0.8)]",
  red: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.8)]",
} as const;

/**
 * Gestão de alunos (mobile): lista limpa com micro-status e bottom sheet
 * de detalhes com ações rápidas. Padrão visual idêntico ao app do aluno.
 */
export default function PersonalAlunosPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadStudents = useCallback(() => {
    if (!profile?.gym_id) return;
    getGymStudents(profile.gym_id)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [profile?.gym_id]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Realtime: atualiza lista quando novo aluno se cadastra
  useEffect(() => {
    if (!profile?.gym_id) return;
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`alunos-${profile.gym_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles", filter: `gym_id=eq.${profile.gym_id}` },
        () => loadStudents()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `gym_id=eq.${profile.gym_id}` },
        () => loadStudents()
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [profile?.gym_id, loadStudents]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PersonalStudent | null>(null);

  const pending = students.filter((s) => !s.approved_at);
  const approved = students.filter((s) => !!s.approved_at);

  const filtered = approved.filter((s) =>
    s.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  /** Aprova o aluno novo e leva o personal direto para criar o treino dele. */
  const approve = async (s: PersonalStudent) => {
    setApprovingId(s.id);
    try {
      const { error } = await supabaseBrowser().rpc("approve_student", {
        p_student_id: s.id,
      });
      if (error) throw new Error(error.message);
      toast.success(`${s.name.split(" ")[0]} aprovado!`, {
        description: "Abrindo a criação do treino dele...",
      });
      setStudents((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, approved_at: new Date().toISOString() } : x))
      );
      router.push(`/personal/treinos?aluno=${s.id}`);
    } catch (e) {
      toast.error("Não deu para aprovar agora", { description: String(e).slice(0, 80) });
    } finally {
      setApprovingId(null);
    }
  };

  /** Matrícula Gymfitness vencendo (lembrete do cliente) */
  const vencBadge = (s: PersonalStudent) => {
    if (s.plan_type !== "Gymfitness" || !s.vencimento) return null;
    const days = Math.ceil(
      (new Date(`${s.vencimento}T12:00:00`).getTime() - Date.now()) / 864e5
    );
    if (days > 14) return null;
    const tone =
      days < 0
        ? "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]"
        : days <= 7
          ? "border-[#FFC24D]/30 bg-[#FFC24D]/10 text-[#FFC24D]"
          : "border-white/[0.1] bg-white/[0.05] text-muted-foreground";
    return (
      <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold", tone)}>
        <CalendarClock className="h-3 w-3" />
        {days < 0 ? "Vencida" : days === 0 ? "Vence hoje" : `Vence em ${days}d`}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Alunos</h1>
          <p className="text-[11px] text-muted-foreground">
            {approved.length} sob sua responsabilidade
          </p>
        </div>
      </header>

      {/* Aprovações: aluno novo chega aqui antes de entrar na lista */}
      {!loading && pending.length > 0 ? (
        <section aria-labelledby="approvals-title" className="space-y-2">
          <h2 id="approvals-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <UserCheck className="h-4 w-4 text-brand" />
            Aprovações
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-brand-foreground">
              {pending.length}
            </span>
          </h2>
          {pending.map((s) => (
            <div key={s.id} className="gf-card gf-glass space-y-3 !rounded-2xl !p-3.5">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-white/[0.08]">
                  <AvatarImage src={s.avatar ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                    {s.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    Novo aluno · aguardando aprovação
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {s.goal ?? "Objetivo a definir"}
                    {s.experience_level ? ` · ${s.experience_level}` : ""}
                    {s.whatsapp_consent && s.phone ? ` · ${s.phone}` : ""}
                  </p>
                </div>
                {vencBadge(s)}
              </div>
              <button
                onClick={() => approve(s)}
                disabled={approvingId === s.id}
                className="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {approvingId === s.id ? "Aprovando..." : "Aprovar e criar treino"}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar aluno por nome..."
          aria-label="Buscar aluno"
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </div>

      {/* Lista com stagger */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
      <m.ul variants={container} initial="hidden" animate="show" className="space-y-2">
        {filtered.map((s) => {
          const status = studentStatus(s);
          return (
            <m.li key={s.id} variants={row}>
              <button
                onClick={() => setSelected(s)}
                className="gf-card gf-glass flex w-full items-center gap-3 !rounded-2xl !p-3.5 text-left transition-transform active:scale-[0.985]"
              >
                <Avatar className="h-11 w-11 border border-white/[0.08]">
                  <AvatarImage src={s.avatar ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                    {s.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", TONE[status.tone])} aria-hidden />
                    {status.label}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {s.lastWorkout ? (
                      <>Último: <span className="font-semibold text-foreground/80">{s.lastWorkout}</span></>
                    ) : (
                      "Sem registro de treino"
                    )}
                  </p>
                </div>
                {s.streak > 0 ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#FFC24D]/25 bg-[#FFC24D]/10 px-2 py-1 text-[10px] font-bold text-[#FFC24D]">
                    🔥 {s.streak} {s.streak === 1 ? "dia" : "dias"}
                  </span>
                ) : vencBadge(s) ? (
                  vencBadge(s)
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </m.li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center text-xs text-muted-foreground">
            {approved.length === 0
              ? pending.length > 0
                ? "Nenhum aluno aprovado ainda — aprove os novos acima."
                : "Nenhum aluno matriculado na academia ainda."
              : `Nenhum aluno encontrado para "${q}".`}
          </li>
        ) : null}
      </m.ul>
      )}

      {/* Bottom Sheet de detalhes */}
      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
