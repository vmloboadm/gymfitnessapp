"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, ClipboardList, Flame, Dumbbell, Plus, Activity, Sparkles, Clock3, Feather, Link2, AlertTriangle } from "lucide-react";
import { insightOffline } from "~/lib/ai/local-gen";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Sparkline } from "~/components/common/Sparkline";
import {
  mockWeightSeries,
  mockWorkoutHistory,
  studentStatus,
  type PersonalStudent,
} from "~/lib/personal-data";
import { isDemoMode } from "~/lib/demo-bridge";
import { localDayKey, localDayStartDaysAgoISO } from "~/lib/utils/local-date";
import {
  listWorkoutsForStudent,
  streakOverride,
  TRAINER_WORKOUTS_EVENT,
  type AssignedWorkout,
} from "~/lib/trainer-store";
import { fetchMyAssignedPlans } from "~/lib/gym-api";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";
import { waStudentLink, buildQuickMessage } from "~/lib/whatsapp";
import { apiPath } from "~/lib/api-path";
import { cn } from "~/lib/utils";

const TONE = {
  green: "bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  amber: "bg-[#FFC24D] shadow-[0_0_8px_rgba(255,194,77,0.8)]",
  red: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.8)]",
} as const;

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "anamnese", label: "Anamnese" },
  { id: "treinos", label: "Treinos" },
  { id: "metricas", label: "Métricas" },
  { id: "fotos", label: "Fotos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 flex items-center justify-between">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[12px] font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Bottom sheet detalhado do aluno com abas, reusado pelo Cockpit e pela lista. */
export function StudentSheet({
  student,
  onClose,
}: {
  student: PersonalStudent | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("resumo");
  const router = useRouter();
  const { user: me, profile: myProfile } = useAuth();

  // Vínculo comigo: sem ele, fotos liberadas e outras visões do personal
  // não alcançam este aluno. O botão abaixo resolve em 1 toque.
  const [linkedToMe, setLinkedToMe] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);
  const [renewing, setRenewing] = useState(false);
  // Link de redefinição de senha (o e-mail automático do Supabase aponta
  // para localhost, então o staff gera e envia pelo WhatsApp).
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    if (!student?.id || !me?.id) {
      setLinkedToMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseBrowser()
          .from("student_trainers")
          .select("id")
          .eq("student_id", student.id)
          .eq("trainer_id", me.id)
          .limit(1)
          .maybeSingle();
        if (!cancelled) setLinkedToMe(!!data);
      } catch {
        if (!cancelled) setLinkedToMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, me?.id]);

  const linkMe = async () => {
    if (!student || !me || !myProfile?.gym_id || linking) return;
    setLinking(true);
    try {
      const { error } = await supabaseBrowser().from("student_trainers").insert({
        gym_id: myProfile.gym_id,
        student_id: student.id,
        trainer_id: me.id,
      } as never);
      if (error) throw new Error(error.message);
      setLinkedToMe(true);
      toast.success("Aluno vinculado a você", {
        description: "Fotos liberadas e acompanhamento passam a chegar.",
      });
    } catch (e) {
      toast.error("Não deu vincular agora", {
        description: String(e instanceof Error ? e.message : e).slice(0, 80),
      });
    } finally {
      setLinking(false);
    }
  };

  // Renova matrícula +1 mês via RPC (staff_renew_matricula). Sem isso o
  // staff não tinha como editar vencimento: só o onboarding seta, e as
  // RPCs staff_update_student/update_student_profile não tocam vencimento.
  const renewMatricula = async () => {
    if (!student || renewing) return;
    setRenewing(true);
    try {
      const { data, error } = await supabaseBrowser().rpc("staff_renew_matricula", {
        p_student_id: student.id,
        p_months: 1,
      });
      if (error) throw new Error(error.message);
      toast.success("Matrícula renovada", {
        description: `Novo vencimento: ${new Date(String(data) + "T12:00:00").toLocaleDateString("pt-BR")}.`,
      });
      onClose();
    } catch (e) {
      toast.error("Não deu para renovar agora", {
        description: String(e instanceof Error ? e.message : e).slice(0, 80),
      });
    } finally {
      setRenewing(false);
    }
  };

  // reseta pra aba Resumo a cada aluno aberto
  const studentId = student?.id;
  useEffect(() => {
    if (studentId) setTab("resumo");
    setResetLink(null);
  }, [studentId]);

  // Gera link de redefinição de senha do aluno (staff do mesmo gym).
  const gerarLinkSenha = async () => {
    if (!student || resetting) return;
    setResetting(true);
    try {
      const { data: sess } = await supabaseBrowser().auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const res = await fetch(apiPath("/api/staff/reset-link"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: student.id }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; link?: string; error?: string }
        | null;
      if (!res.ok || !body?.ok || !body.link) {
        throw new Error(body?.error ?? "Não deu para gerar o link.");
      }
      setResetLink(body.link);
      try {
        await navigator.clipboard.writeText(body.link);
        toast.success("Link copiado", {
          description: "Envie no WhatsApp do aluno. Ele define a nova senha.",
        });
      } catch {
        toast.success("Link gerado", { description: "Toque em copiar e envie para o aluno." });
      }
    } catch (e) {
      toast.error("Não deu para gerar o link", {
        description: String(e instanceof Error ? e.message : e).slice(0, 90),
      });
    } finally {
      setResetting(false);
    }
  };

  // re-render quando um treino novo é atribuído
  const [workoutsBump, setBump] = useState(0);
  useEffect(() => {
    const bump = () => setBump((b) => b + 1);
    window.addEventListener(TRAINER_WORKOUTS_EVENT, bump);
    return () => window.removeEventListener(TRAINER_WORKOUTS_EVENT, bump);
  }, []);

  const status = student ? studentStatus(student) : null;

  // Fotos de evolução liberadas pelo aluno (só leitura aqui)
  const [progressPhotos, setProgressPhotos] = useState<Array<{ id: string; url: string; angle: string; phase: string; taken_at: string }> | null>(null);
  useEffect(() => {
    if (!student?.id || tab !== "fotos") return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabaseBrowser()
          .from("progress_photos")
          .select("id, url, angle, phase, taken_at")
          .eq("student_id", student.id)
          .order("taken_at", { ascending: false })
          .limit(12);
        if (!cancelled) setProgressPhotos(error ? [] : (data ?? []));
      } catch {
        if (!cancelled) setProgressPhotos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, tab]);

  const openChat = async () => {
    if (!student) return;
    try {
      const { data, error } = await supabaseBrowser().rpc("get_or_create_conversation", {
        p_other_id: student.id,
      });
      if (error) throw new Error(error.message);
      onClose();
      router.push(`/personal/conversas/${data as string}`);
    } catch (e) {
      toast.error("Não deu abrir a conversa", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    }
  };

  // Nível editável pelo personal (só leitura para os dados clínicos)
  const [levelEdit, setLevelEdit] = useState<string | null>(null);
  const [savingLevel, setSavingLevel] = useState(false);
  // também acompanha o nível se a ficha for recarregada com valor novo
  const studentLevel = student?.experience_level ?? null;
  useEffect(() => {
    if (studentId) setLevelEdit(studentLevel);
  }, [studentId, studentLevel]);
  const saveLevel = async (v: string) => {
    if (!student || savingLevel || v === levelEdit) return;
    setSavingLevel(true);
    try {
      const { error } = await supabaseBrowser().rpc("staff_update_student", {
        p_student_id: student.id,
        p_experience_level: v,
      });
      if (error) throw new Error(error.message);
      setLevelEdit(v);
      toast.success("Nível atualizado", { description: `${student.name.split(" ")[0]} agora é ${v}.` });
    } catch (e) {
      toast.error("Não deu atualizar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setSavingLevel(false);
    }
  };

  // Métricas e histórico REAIS do aluno (body_metrics + workout_logs).
  // Séries mockadas saíram de produção: davam pesos/históricos inconsistentes.
  const demo = isDemoMode();
  const [realWeights, setRealWeights] = useState<number[] | null>(null);
  const [realHistory, setRealHistory] = useState<Array<{ date: string; name: string; volume: number; sets: number }> | null>(null);
  useEffect(() => {
    if (!student?.id || demo) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = supabaseBrowser();
        const [bm, lg] = await Promise.all([
          sb.from("body_metrics").select("weight_kg, recorded_at").eq("student_id", student.id).order("recorded_at", { ascending: true }).limit(12),
          sb.from("workout_logs").select("date, weight_kg, reps").eq("student_id", student.id).order("date", { ascending: false }).limit(180),
        ]);
        if (cancelled) return;
        setRealWeights(
          ((bm.data ?? []) as Array<{ weight_kg: number | null }>)
            .map((r) => r.weight_kg)
            .filter((w): w is number => typeof w === "number")
        );
        const rows = (lg.data ?? []) as Array<{ date: string; weight_kg: number | null; reps: number | null }>;
        const byDay = new Map<string, { sets: number; volume: number }>();
        for (const r of rows) {
          const day = localDayKey(r.date);
          const cur = byDay.get(day) ?? { sets: 0, volume: 0 };
          cur.sets += 1;
          cur.volume += (r.weight_kg ?? 0) * (Number(r.reps) || 0);
          byDay.set(day, cur);
        }
        setRealHistory(
          [...byDay.entries()].slice(0, 6).map(([day, v]) => ({
            date: day,
            name: student.activeWorkout ?? "Treino",
            volume: Math.round(v.volume),
            sets: v.sets,
          }))
        );
      } catch {
        if (!cancelled) {
          setRealWeights([]);
          setRealHistory([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, student?.activeWorkout, demo]);

  const weights = demo ? (student ? mockWeightSeries(student) : []) : (realWeights ?? []);
  const history = demo ? (student ? mockWorkoutHistory(student) : []) : (realHistory ?? []);
  const effectiveStreak = student ? (streakOverride(student.id) ?? student.streak) : 0;

  // Frequência real: dias com check-in nos últimos 30 dias (checkins).
  const [freqDays30, setFreqDays30] = useState<number | null>(null);
  useEffect(() => {
    if (!student?.id) { setFreqDays30(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const since = localDayStartDaysAgoISO(30);
        const { data, error } = await supabaseBrowser()
          .from("checkins")
          .select("checked_at")
          .eq("student_id", student.id)
          .gte("checked_at", since)
          .limit(400);
        if (cancelled) return;
        if (error) { setFreqDays30(null); return; }
        const days = new Set(((data ?? []) as Array<{ checked_at: string }>).map((r) => localDayKey(r.checked_at)));
        setFreqDays30(days.size);
      } catch {
        if (!cancelled) setFreqDays30(null);
      }
    })();
    return () => { cancelled = true; };
  }, [student?.id]);

  // Plano atribuído REAL do aluno: produção lê student_workouts; demo usa o store local.
  const [assigned, setAssigned] = useState<AssignedWorkout[]>([]);
  useEffect(() => {
    if (!student?.id) { setAssigned([]); return; }
    let cancelled = false;
    (async () => {
      try {
        if (demo) {
          if (!cancelled) setAssigned(listWorkoutsForStudent(student.id));
          return;
        }
        if (!myProfile?.gym_id) { if (!cancelled) setAssigned([]); return; }
        const rows = await fetchMyAssignedPlans(student.id, myProfile.gym_id);
        if (!cancelled) setAssigned(rows);
      } catch {
        if (!cancelled) setAssigned([]);
      }
    })();
    return () => { cancelled = true; };
  }, [student?.id, demo, myProfile?.gym_id, workoutsBump]);
  const latestWorkoutId = assigned[0]?.id;

  // Laudo médico real (medical_clearances): só alerta quando existe dado real.
  const [clearance, setClearance] = useState<"none" | "pending" | "approved" | null>(null);
  useEffect(() => {
    if (!student?.id || !student.medical_risk) { setClearance(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseBrowser()
          .from("medical_clearances")
          .select("approved")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setClearance(data ? ((data as { approved: boolean }).approved ? "approved" : "pending") : "none");
      } catch {
        if (!cancelled) setClearance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [student?.id, student?.medical_risk]);

  // Fetch último feedback do aluno (workout_sessions.meta)
  const [lastFeedback, setLastFeedback] = useState<{ feeling: string | null; note: string | null; duration_min: number | null; date: string } | null>(null);
  useEffect(() => {
    if (!student?.id) { setLastFeedback(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabaseBrowser() as any)
          .from("workout_sessions")
          .select("meta, started_at")
          .eq("student_id", student.id)
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .limit(5);
        if (cancelled) return;
        const rows = (data ?? []) as Array<{ meta: Record<string, any> | null; started_at: string }>;
        const withFeedback = rows.find((r) => r.meta?.feeling || r.meta?.feedback_at);
        if (withFeedback) {
          const meta = withFeedback.meta ?? {};
          setLastFeedback({
            feeling: (meta.feeling as string) ?? null,
            note: (meta.note as string) ?? null,
            duration_min: (meta.duration_min as number) ?? null,
            date: withFeedback.started_at,
          });
        } else {
          setLastFeedback(null);
        }
      } catch { if (!cancelled) setLastFeedback(null); }
    })();
    return () => { cancelled = true; };
  }, [student?.id]);

  return (
    <BottomSheet open={!!student} onClose={onClose}>
      {student ? (
        <div className="space-y-4">
          {/* identificação */}
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-brand/60">
              <AvatarImage src={student.avatar ?? undefined} alt="" />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
                {student.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">{student.name}</p>
              {status ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", TONE[status.tone])} aria-hidden />
                  {status.label}
                </p>
              ) : null}
            </div>
          </div>

          {/* abas */}
          {linkedToMe === false ? (
            <button
              type="button"
              onClick={linkMe}
              disabled={linking}
              className="tactile flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] py-2.5 text-[12px] font-black text-brand disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              {linking ? "Vinculando..." : "Vincular a mim"}
            </button>
          ) : null}
          <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors",
                  tab === t.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Ações rápidas de WhatsApp (mensagens prontas, 1 toque) */}
          {student.whatsapp_consent && student.phone
            ? (() => {
                const actions = [
                  { k: "sumido", label: "Está sumido" },
                  { k: "cobrar", label: "Cobrar treino" },
                  { k: "parabens", label: "Parabéns" },
                  { k: "incentivo", label: "Incentivo" },
                  { k: "vencido", label: "Vencido" },
                  { k: "avaliacao", label: "Avaliação" },
                ]
                  .map((a) => ({
                    ...a,
                    href: waStudentLink(student.phone, buildQuickMessage(a.k, student.name)),
                  }))
                  .filter((a): a is typeof a & { href: string } => !!a.href);
                return actions.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a) => (
                      <a
                        key={a.k}
                        href={a.href}
                        target="_blank"
                        rel="noreferrer"
                        className="tactile inline-flex items-center gap-1 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2.5 py-1.5 text-[10.5px] font-bold text-[#4ADE80]"
                      >
                        <MessageCircle className="h-3 w-3" /> {a.label}
                      </a>
                    ))}
                  </div>
                ) : null;
              })()
            : null}

          {/* conteúdo da aba */}
          {tab === "resumo" ? (
            <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3 w-3 text-[#FFC24D]" /> Streak
                </p>
                <p className={cn("mt-1 font-display text-lg font-black", effectiveStreak === 0 && student.streak > 0 ? "text-[#F87171]" : "text-foreground")}>
                  {effectiveStreak}d
                </p>
                {effectiveStreak === 0 && student.streak > 0 ? (
                  <p className="text-[9px] font-bold text-[#F87171]">zerado pelo personal</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Última vez
                </p>
                <p className="mt-1 text-[13px] font-bold text-foreground">
                  {student.lastTrainingDaysAgo == null
                    ? "Sem registro"
                    : student.lastTrainingDaysAgo === 0
                      ? "Hoje"
                      : `${student.lastTrainingDaysAgo}d atrás`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MessageCircle className="h-3 w-3 text-[#25D366]" /> WhatsApp
                </p>
                <p className={cn("mt-1 text-[13px] font-bold", student.whatsapp_consent ? "text-[#4ADE80]" : "text-[#F87171]")}>
                  {student.whatsapp_consent ? "Liberado" : "Sem ok"}
                </p>
              </div>
              <div className="col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Dumbbell className="h-3 w-3 text-brand" /> Treino ativo
                </p>
                <p className="mt-1 text-[13px] font-bold text-foreground">
                  {student.activeWorkout ?? "Sem treino"}
                </p>
                {student.lastRpe ? (
                  <p className="mt-0.5 text-[10px] text-[#FFC24D]">Último RPE: {student.lastRpe}</p>
                ) : null}
              </div>
            </div>
            {/* Matrícula (só Gymfitness tem vencimento editável no app) */}
            {student.plan_type === "Gymfitness" && student.vencimento ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Matrícula</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12.5px] font-bold",
                      student.vencimento < localDayKey(new Date())
                        ? "text-[#F87171]"
                        : "text-foreground"
                    )}
                  >
                    Vencimento: {student.vencimento.split("-").reverse().join("/")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={renewMatricula}
                  disabled={renewing}
                  className="tactile shrink-0 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-[10.5px] font-black text-brand disabled:opacity-50"
                >
                  {renewing ? "Renovando..." : "Renovar +1 mês"}
                </button>
              </div>
            ) : null}
            {/* Acesso: gera link de senha (o e-mail automático aponta pra localhost) */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Acesso</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">Aluno não consegue entrar?</p>
                </div>
                <button
                  type="button"
                  onClick={gerarLinkSenha}
                  disabled={resetting}
                  className="tactile shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10.5px] font-black text-foreground disabled:opacity-50"
                >
                  {resetting ? "Gerando..." : "Link de senha"}
                </button>
              </div>
              {resetLink ? (
                <div className="mt-2 space-y-1.5">
                  <p className="max-h-16 overflow-y-auto break-all rounded-lg bg-black/40 p-2 text-[9.5px] leading-snug text-muted-foreground">
                    {resetLink}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(resetLink);
                          toast.success("Link copiado");
                        } catch {
                          toast.error("Não deu para copiar");
                        }
                      }}
                      className="tactile flex-1 rounded-lg bg-brand/15 py-1.5 text-[10.5px] font-bold text-brand"
                    >
                      Copiar link
                    </button>
                    <a
                      href={waStudentLink(student.phone ?? "", `Oi! Segue o link para você criar uma nova senha no app da academia: ${resetLink}`) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="tactile flex-1 rounded-lg bg-[#25D366]/15 py-1.5 text-center text-[10.5px] font-bold text-[#25D366]"
                    >
                      Enviar no WhatsApp
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            {lastFeedback ? (
              <div className="rounded-2xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.06] p-3">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-[#4ADE80]">
                  <Feather className="h-3 w-3" /> Último feedback
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="text-[13px] font-bold text-foreground">
                    {lastFeedback.feeling === "leve" ? "Leve" : lastFeedback.feeling === "na_medida" ? "Na medida" : lastFeedback.feeling === "puxado" ? "Puxado" : lastFeedback.feeling === "no_limite" ? "No limite" : lastFeedback.feeling}
                  </span>
                  {lastFeedback.duration_min ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" /> {lastFeedback.duration_min} min
                    </span>
                  ) : null}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(lastFeedback.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                {lastFeedback.note ? (
                  <p className="mt-1.5 text-[11px] italic text-muted-foreground">“{lastFeedback.note}”</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Sem feedback registrado ainda</p>
              </div>
            )}
            </div>
          ) : null}

          {tab === "anamnese" ? (
            <div className="space-y-2">
              {student.medical_risk ? (
                <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F87171]">
                    <AlertTriangle className="h-3 w-3" /> Risco clínico ativo
                  </p>
                  <p className="mt-1 text-[11px] text-[#F87171]/80">
                    {clearance === "approved"
                      ? "Laudo médico já aprovado pelo gestor."
                      : clearance === "pending"
                        ? "Laudo médico enviado, aguardando aprovação pelo gestor."
                        : clearance === "none"
                          ? "Risco informado no onboarding. Ainda sem laudo médico enviado."
                          : "Risco informado no onboarding."}
                  </p>
                </div>
              ) : null}
              <InfoRow label="Objetivo" value={student.goal} />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Nível (editável)</span>
                  {savingLevel ? <span className="text-[9px] text-muted-foreground">salvando…</span> : null}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {["Iniciante", "Intermediário", "Avançado"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={savingLevel}
                      onClick={() => saveLevel(n)}
                      aria-pressed={levelEdit === n}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-[10.5px] font-bold transition-colors disabled:opacity-50",
                        levelEdit === n
                          ? "border-brand bg-brand/15 text-brand"
                          : "border-white/[0.08] text-muted-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <InfoRow label="Sexo" value={student.sex === "M" ? "Masculino" : student.sex === "F" ? "Feminino" : student.sex} />
              <InfoRow
                label="Check-ins (30 dias)"
                value={freqDays30 === null ? null : `${freqDays30} ${freqDays30 === 1 ? "dia" : "dias"}`}
              />
              {student.available_days?.length ? (
                <InfoRow label="Dias disponíveis" value={student.available_days.join(", ")} />
              ) : null}
              {student.medications ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Medicamentos</p>
                  <p className="mt-1 text-[12px] text-foreground">{student.medications}</p>
                </div>
              ) : null}
              {student.surgery_history ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Cirurgias</p>
                  <p className="mt-1 text-[12px] text-foreground">{student.surgery_history}</p>
                </div>
              ) : null}
              {student.emergency_contact ? (
                <InfoRow label="Emergência" value={`${student.emergency_contact.name} · ${student.emergency_contact.phone}`} />
              ) : null}
              {!student.goal && !student.experience_level && !student.medical_risk && !student.medications && !student.surgery_history ? (
                <p className="text-center text-[11px] text-muted-foreground py-4">Aluno ainda não completou o onboarding.</p>
              ) : null}
            </div>
          ) : null}

          {tab === "treinos" ? (
            <div className="space-y-2">
              {assigned.length > 0 ? (
                <div className="rounded-2xl border border-brand/30 bg-brand/[0.08] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand">
                    Do seu Personal · plano ativo
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-foreground">
                    {assigned[0].name} · {assigned[0].exercises.length} exercícios
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {assigned[0].frequency} · enviado {fmtDate(assigned[0].created_at)}
                  </p>
                  {assigned[0].plan?.dias?.length ? (
                    <div className="mt-2 space-y-1">
                      {assigned[0].plan.dias.map((d, i) => {
                        const slot = (d as { slot?: string }).slot ?? "ABCDEF"[i] ?? String(i + 1);
                        return (
                          <div
                            key={`${slot}-${i}`}
                            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/20 font-display text-[10.5px] font-black text-brand">
                              {slot}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
                              {d.nome}
                            </span>
                            <span className="shrink-0 text-[9.5px] font-semibold text-muted-foreground">
                              {d.exercicios.length} {d.exercicios.length === 1 ? "exercício" : "exercícios"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {history.length > 0 ? (
                <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-foreground">{h.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmtDate(h.date)} · {h.sets} séries
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-[11px] font-bold tabular-nums text-brand">
                        {h.volume.toLocaleString("pt-BR")} kg
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.1] p-5 text-center">
                  <p className="text-[12px] font-semibold text-foreground">Nenhum treino registrado ainda</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    O histórico aparece aqui depois do primeiro treino concluído.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {tab === "metricas" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-brand" /> Evolução de peso
                </p>
                {weights.length > 0 ? (
                  <>
                    <p className="mt-1 font-display text-xl font-black text-foreground">
                      {weights[weights.length - 1]} kg
                      {weights.length >= 2 ? (
                        <span
                          className={cn(
                            "ml-2 text-[11px] font-bold",
                            weights[weights.length - 1] >= weights[0] ? "text-[#4ADE80]" : "text-[#F87171]"
                          )}
                        >
                          {weights[weights.length - 1] >= weights[0] ? "+" : ""}
                          {Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10} kg no período
                        </span>
                      ) : null}
                    </p>
                    {weights.length >= 2 ? (
                      <div className="mt-2">
                        <Sparkline points={weights} height={56} />
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Primeira medição registrada. A curva aparece na próxima.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <Activity className="h-4 w-4 opacity-60" />
                    Nenhuma medição registrada ainda. Peça para o aluno salvar o peso em Métricas.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-brand/25 bg-brand/[0.08] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <Sparkles className="h-3 w-3" /> Leitura do assistente
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-foreground/90">
                  {insightOffline({
                    name: student.name,
                    streak: effectiveStreak,
                    lastTrainingDaysAgo: student.lastTrainingDaysAgo,
                    lastRpe: student.lastRpe,
                    weights,
                    activeWorkout: student.activeWorkout,
                  })}
                </p>
              </div>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10.5px] leading-snug text-muted-foreground">
                Medições reais do aluno: peso salvo no app (Métricas) e volume
                calculado dos treinos registrados.
              </p>
            </div>
          ) : null}

          {tab === "fotos" ? (
            <div className="space-y-2">
              <p className="text-[10.5px] leading-snug text-muted-foreground">
                Só aparecem as fotos que o aluno liberou para você.
              </p>
              {progressPhotos === null ? (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Carregando fotos…</p>
              ) : progressPhotos.length === 0 ? (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-[11px] text-muted-foreground">
                  Nenhuma foto liberada ainda. Peça ao aluno na conversa.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {progressPhotos.map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-xl border border-white/[0.07]">
                      <img src={p.url} alt={`${p.phase} · ${p.angle}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                      <figcaption className="bg-white/[0.03] px-1 py-1 text-center text-[9px] font-bold capitalize text-muted-foreground">
                        {p.phase} · {p.angle}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* ações rápidas */}
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const waHref = student.whatsapp_consent
                ? waStudentLink(
                    student.phone,
                    `Oi ${student.name.split(" ")[0]}! Passando pra acompanhar seu treino. Bora evoluir hoje?`
                  )
                : null;
              return waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/15 text-[10.5px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.97]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : (
                <span
                  title={
                    student.whatsapp_consent
                      ? "Sem telefone válido cadastrado"
                      : "Aluno ainda não liberou contato no WhatsApp"
                  }
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-[10px] font-medium text-muted-foreground ring-1 ring-white/[0.06]"
                >
                  <MessageCircle className="h-4 w-4" />
                  {student.whatsapp_consent ? "Sem telefone" : "Sem ok"}
                </span>
              );
            })()}
            {latestWorkoutId ? (
              <Link
                href={`/personal/treinos?aluno=${student.id}&edit=${latestWorkoutId}`}
                className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand/15 text-[10.5px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.97]"
              >
                <ClipboardList className="h-4 w-4" />
                Editar Treino
              </Link>
            ) : null}
            <button
              type="button"
              onClick={openChat}
              className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] text-[10.5px] font-bold text-foreground ring-1 ring-white/[0.08] transition-transform active:scale-[0.97]"
            >
              <Feather className="h-4 w-4" />
              Conversar
            </button>
            <Link
              href={`/personal/treinos?aluno=${student.id}`}
              className="tactile flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand text-[10.5px] font-bold text-brand-foreground transition-transform active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Novo Treino
            </Link>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
