"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { m, type Variants } from "framer-motion";
import {
  Search,
  ChevronRight,
  UserCheck,
  Sparkles,
  CalendarClock,
  Dumbbell,
  Flame,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { StudentSheet } from "~/components/personal/StudentSheet";
import { useAuth } from "~/hooks/useAuth";
import { studentStatus, needsWorkout, type PersonalStudent } from "~/lib/personal-data";
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
  const [showAllPending, setShowAllPending] = useState(false);
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
  // com muitas aprovações a lista empurrava o resto pra baixo: mostra 3
  const PENDING_PREVIEW = 3;
  const pendingShown = showAllPending || query ? pending : pending.slice(0, PENDING_PREVIEW);

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
          {pendingShown.map((s) => (
            <div key={s.id} className="gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-3.5">
              <Avatar className="h-10 w-10 shrink-0 border border-white/[0.08]">
                <AvatarImage src={s.avatar ?? undefined} alt="" />
                <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                  {s.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {s.goal ?? "Objetivo a definir"}
                  {s.experience_level ? ` · ${s.experience_level}` : ""}
                  {s.whatsapp_consent && s.phone ? ` · ${s.phone}` : ""}
                </p>
                {vencBadge(s) ? <div className="mt-1.5 flex">{vencBadge(s)}</div> : null}
              </div>
              <button
                onClick={() => approve(s)}
                disabled={approvingId === s.id}
                aria-label={`Aprovar ${s.name} e criar treino`}
                className="tactile flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[11.5px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {approvingId === s.id ? "Aprovando..." : "Aprovar"}
              </button>
            </div>
          ))}
          {pending.length > pendingShown.length ? (
            <button
              type="button"
              onClick={() => setShowAllPending(true)}
              className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] py-2.5 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todas as {pending.length} aprovações
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Aguardando treino: aprovado sem treino criado, botão para criar */}
      {!loading && awaiting.length > 0 ? (
        <section aria-labelledby="awaiting-title" className="space-y-2">
          <h2 id="awaiting-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Dumbbell className="h-4 w-4 text-[#FFC24D]" />
            Aguardando treino
            <span className="rounded-full bg-[#FFC24D] px-2 py-0.5 text-[10px] font-black text-black">
              {awaiting.length}
            </span>
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Alunos aprovados ainda sem treino criado. Crie o treino para liberar no app deles.
          </p>
          {awaiting.map((s) => (
            <div key={s.id} className="gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-3.5">
              <Avatar className="h-10 w-10 shrink-0 border border-white/[0.08]">
                <AvatarImage src={s.avatar ?? undefined} alt="" />
                <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                  {s.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {s.goal ?? "Objetivo a definir"}
                  {s.experience_level ? ` · ${s.experience_level}` : ""}
                  {s.sex ? ` · ${s.sex === "F" ? "Fem" : "Masc"}` : ""}
                </p>
              </div>
              <button
                onClick={() => router.push(`/personal/treinos?aluno=${s.id}`)}
                className="tactile flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[11.5px] font-black text-brand-foreground shadow-lg shadow-brand/25"
              >
                <Sparkles className="h-3.5 w-3.5" /> Criar treino
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {/* Lista com stagger (limitado em listas grandes) */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.06] p-6 text-center">
          <p className="text-[13px] font-bold text-foreground">Não foi possível carregar os alunos</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Falha de conexão com o servidor. Tente novamente.
          </p>
          <button
            onClick={loadStudents}
            className="tactile mt-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[12px] font-bold text-foreground transition-colors hover:text-brand"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
      <m.ul
        variants={{ hidden: {}, show: { transition: { staggerChildren: Math.min(0.06, 0.4 / Math.max(1, filtered.length)), delayChildren: 0.04 } } }}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
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
                    <Flame className="h-3 w-3" /> {s.streak} {s.streak === 1 ? "dia" : "dias"}
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
                ? "Nenhum aluno aprovado ainda. Aprove os novos acima."
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
