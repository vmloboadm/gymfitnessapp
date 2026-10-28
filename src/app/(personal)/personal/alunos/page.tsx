"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { m, type Variants } from "framer-motion";
import {
  Search,
  ChevronRight,
  Sparkles,
  CalendarClock,
  Flame,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { StudentSheet } from "~/components/personal/StudentSheet";
import { useAuth } from "~/hooks/useAuth";
import { studentStatus, needsWorkout, goalLabel, type PersonalStudent } from "~/lib/personal-data";
import { getGymStudents } from "~/lib/gym-api";
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

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
  const [loadError, setLoadError] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    setLoadError(false);
    try {
      // Sonda direta: getGymStudents engole erro interno e devolve [],
      // então testamos a conexão com a tabela antes de confiar na lista.
      const probe = await supabaseBrowser()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", profile.gym_id)
        .eq("role", "student");
      if (probe.error) throw new Error(probe.error.message);
      const rows = await getGymStudents(profile.gym_id);
      setStudents(rows);
      setLoading(false);
    } catch {
      setStudents([]);
      setLoadError(true);
      setLoading(false);
    }
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
  type Tab = "todos" | "aprovar" | "sem-treino" | "com-treino";
  const [tab, setTab] = useState<Tab>("todos");
  // Atalho vindo do painel: ?aba=aprovar | sem-treino
  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get("aba");
    if (aba === "aprovar" || aba === "sem-treino" || aba === "com-treino") setTab(aba);
  }, []);
  const [selected, setSelected] = useState<PersonalStudent | null>(null);

  // Link "Abrir ficha do aluno" vindo de Aprovações: ?aluno=<id>
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current || students.length === 0) return;
    const alunoParam = new URLSearchParams(window.location.search).get("aluno");
    if (!alunoParam) { openedFromLink.current = true; return; }
    const target = students.find((s) => s.id === alunoParam);
    if (target) {
      openedFromLink.current = true;
      setSelected(target);
    }
  }, [students]);

  // a busca vale para as três seções (aprovação, aguardando treino e lista)
  const query = q.trim().toLowerCase();
  const matches = (s: PersonalStudent) => !query || s.name.toLowerCase().includes(query);
  const pending = students.filter((s) => !s.approved_at && matches(s));
  const approved = students.filter((s) => !!s.approved_at);
  const awaiting = approved.filter((s) => needsWorkout(s) && matches(s));
  const filtered = approved.filter(matches);
  const withPlan = approved.filter((s) => !needsWorkout(s) && matches(s));
  const TABS: Array<{ id: Tab; label: string; count: number; tone?: string }> = [
    { id: "todos", label: "Todos", count: filtered.length + pending.length },
    { id: "aprovar", label: "Aprovar", count: pending.length, tone: "bg-brand text-brand-foreground" },
    { id: "sem-treino", label: "Sem treino", count: awaiting.length, tone: "bg-[#FFC24D] text-black" },
    { id: "com-treino", label: "Com treino", count: withPlan.length },
  ];
  // Na aba Todos: quem precisa de ação primeiro (aprovar, sem treino), depois o resto.
  const list: PersonalStudent[] =
    tab === "aprovar"
      ? pending
      : tab === "sem-treino"
        ? awaiting
        : tab === "com-treino"
          ? withPlan
          : [...pending, ...awaiting, ...withPlan];
  // Lista longa: mostra 25 por vez (busca e troca de aba voltam ao início).
  const PAGE = 25;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [tab, query]);
  const shown = list.slice(0, limit);

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
    // Data informada pelo aluno, não é oficial da academia. Vencida não vira
    // alerta (a recepção confirma); só lembramos quando está perto de vencer.
    if (days < 0 || days > 14) return null;
    const tone =
      days <= 7
        ? "border-[#FFC24D]/30 bg-[#FFC24D]/10 text-[#FFC24D]"
        : "border-white/[0.1] bg-white/[0.05] text-muted-foreground";
    return (
      <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold", tone)}>
        <CalendarClock className="h-3 w-3" />
        {days === 0 ? "Vence hoje" : `Vence em ${days}d`}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Alunos</h1>
          <p className="text-[11px] text-muted-foreground">
            {approved.length} aluno{approved.length === 1 ? "" : "s"} aprovado{approved.length === 1 ? "" : "s"} na academia
          </p>
        </div>
      </header>

      {/* Busca + abas fixas no topo: a lista é longa */}
      <div className="sticky top-0 z-20 -mx-4 space-y-2.5 bg-background/90 px-4 pb-2.5 pt-1 backdrop-blur">
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
        <div role="tablist" aria-label="Filtrar alunos" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors",
                tab === t.id
                  ? "border-brand/50 bg-brand/15 text-foreground"
                  : "border-white/[0.06] bg-white/[0.03] text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-black tabular-nums",
                  t.tone && t.count > 0 ? t.tone : "bg-white/[0.08] text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tab === "sem-treino" && awaiting.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">Aprovados sem treino. Crie o treino para liberar no app deles.</p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.06] p-6 text-center">
          <p className="text-[13px] font-bold text-foreground">Não foi possível carregar os alunos</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Falha de conexão com o servidor. Tente novamente.</p>
          <button
            onClick={loadStudents}
            className="tactile mt-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[12px] font-bold text-foreground transition-colors hover:text-brand"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <m.ul
          key={tab}
          variants={{ hidden: {}, show: { transition: { staggerChildren: Math.min(0.04, 0.3 / Math.max(1, shown.length)) } } }}
          initial="hidden"
          animate="show"
          className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        >
          {shown.map((s) => {
            const isPending = !s.approved_at;
            const noPlan = !isPending && needsWorkout(s);
            const status = studentStatus(s);
            return (
              <m.li key={s.id} variants={row} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  onClick={() => setSelected(s)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Abrir ${s.name}`}
                >
                  <Avatar className="h-9 w-9 shrink-0 border border-white/[0.08]">
                    <AvatarImage src={s.avatar ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                      {s.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-muted-foreground">
                      {isPending ? (
                        <>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                          Aguardando aprovação · {goalLabel(s.goal) ?? "objetivo a definir"}
                        </>
                      ) : noPlan ? (
                        <>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC24D]" aria-hidden />
                          Sem treino · {goalLabel(s.goal) ?? "objetivo a definir"}
                          {s.experience_level ? ` · ${s.experience_level}` : ""}
                        </>
                      ) : (
                        <>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[status.tone])} aria-hidden />
                          {status.label}
                          {s.lastWorkout ? ` · último: ${s.lastWorkout}` : ""}
                        </>
                      )}
                    </p>
                  </div>
                </button>
                {isPending ? (
                  <button
                    onClick={() => approve(s)}
                    disabled={approvingId === s.id}
                    aria-label={`Aprovar ${s.name} e criar treino`}
                    className="tactile shrink-0 rounded-xl bg-brand px-3 py-1.5 text-[11px] font-black text-brand-foreground disabled:opacity-60"
                  >
                    {approvingId === s.id ? "..." : "Aprovar"}
                  </button>
                ) : noPlan ? (
                  <button
                    onClick={() => router.push(`/personal/treinos?aluno=${s.id}`)}
                    className="tactile flex shrink-0 items-center gap-1 rounded-xl border border-[#FFC24D]/40 bg-[#FFC24D]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFC24D]"
                  >
                    <Sparkles className="h-3 w-3" /> Criar
                  </button>
                ) : s.streak > 0 ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#FFC24D]/25 bg-[#FFC24D]/10 px-2 py-1 text-[10px] font-bold text-[#FFC24D]">
                    <Flame className="h-3 w-3" /> {s.streak}d
                  </span>
                ) : (
                  vencBadge(s) ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </m.li>
            );
          })}
          {list.length > shown.length ? (
            <li>
              <button
                onClick={() => setLimit((n) => n + PAGE)}
                className="tactile w-full px-3 py-3 text-center text-[12px] font-bold text-brand"
              >
                Mostrar mais {Math.min(PAGE, list.length - shown.length)} de {list.length - shown.length} restantes
              </button>
            </li>
          ) : null}
          {list.length === 0 ? (
            <li className="p-6 text-center text-xs text-muted-foreground">
              {query
                ? `Nenhum aluno encontrado para "${q}".`
                : tab === "aprovar"
                  ? "Ninguém esperando aprovação."
                  : tab === "sem-treino"
                    ? "Todo aluno aprovado já tem treino."
                    : "Nenhum aluno aqui ainda."}
            </li>
          ) : null}
        </m.ul>
      )}

      {/* Bottom Sheet de detalhes */}
      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
