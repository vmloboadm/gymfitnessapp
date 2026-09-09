"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  Send,
  Sparkles,
  Loader2,
  MessageSquareText,
  ClipboardCheck,
  Users,
  Check,
  Layers,
  Plus,
  GripVertical,
  Trash2,
  Search,
  UserRoundPlus,
  Pencil,
  History,
  Flame,
  Clock,
  Target,
  ArrowLeftRight,
  Dumbbell,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { buildWorkoutPrompt } from "~/lib/ai/prompts";
import {
  generatePlanOffline,
  parsePlanFromLLM,
  validateAndFixExercises,
  type WorkoutPlan,
  type DBExercise,
  type DBEquipment,
} from "~/lib/ai/local-gen";
import { demoLib } from "~/lib/demo-bridge";
import {
  demoTemplates,
  type PersonalStudent,
  type WorkoutTemplate,
} from "~/lib/personal-data";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";
import {
  approvePlan,
  deleteAssignedWorkout,
  getGymStudents,
  listAssignedWorkouts,
  updateAssignedWorkout,
  fetchGymAssignedPlans,
  fetchMyAssignedPlans,
  completeStudentWorkout,
  type GymAssignedPlan,
} from "~/lib/gym-api";
import { cn } from "~/lib/utils";

import { apiPath } from "~/lib/api-path";
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/* ------------------------------------------------------------------ */
/* Assistente guiado: a IA faz perguntas (nível, objetivo, foco,        */
/* restrições) antes de gerar, em vez de uma frase livre.              */
/* ------------------------------------------------------------------ */

const NIVEL_OPTS = ["Iniciante", "Intermediário", "Avançado"];
const OBJETIVO_OPTS = ["Hipertrofia", "Emagrecimento", "Força", "Condicionamento"];

type FocoOption = { id: string; label: string; sub: string; focus: string[] };

const FOCO_OPTS: FocoOption[] = [
  { id: "full", label: "Corpo inteiro", sub: "todos os grupos em cada dia", focus: ["Corpo inteiro"] },
  { id: "ul", label: "Superiores e inferiores", sub: "Upper / Lower alternado", focus: ["Peito", "Costas", "Ombro", "Inferiores", "Glúteo"] },
  { id: "ppl", label: "Empurrar / Puxar / Pernas", sub: "divisão clássica", focus: ["Empurrar", "Puxar", "Pernas"] },
  { id: "lower", label: "Pernas e glúteos", sub: "ênfase em membros inferiores", focus: ["Inferiores", "Posterior", "Glúteo"] },
  { id: "upper", label: "Superior completo", sub: "peito, costas, ombro e braço", focus: ["Peito", "Costas", "Ombro", "Bíceps", "Tríceps"] },
  { id: "arms", label: "Braços", sub: "bíceps e tríceps como prioridade", focus: ["Bíceps", "Tríceps"] },
];

type RestricaoOption = { label: string; sub: string; value: string | null };

const RESTRICAO_OPTS: RestricaoOption[] = [
  { label: "Nenhuma", sub: "pode tudo", value: null },
  { label: "Ombro", sub: "problema ou lesão", value: "Cuidado com ombro" },
  { label: "Joelho", sub: "problema ou lesão", value: "Cuidado com joelho" },
  { label: "Lombar", sub: "problema ou lesão", value: "Cuidado com lombar" },
  { label: "Sem impacto", sub: "articulações sensíveis", value: "Sem impacto articular" },
];

/** Normaliza o nível salvo no perfil para uma das opções do assistente. */
function normNivel(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/iniciante|come[çc]ando|leve/.test(v)) return "Iniciante";
  if (/avan[çc]ado|atleta|experiente/.test(v)) return "Avançado";
  if (/intermedi/.test(v)) return "Intermediário";
  return null;
}

/** Normaliza o objetivo salvo no perfil para uma das opções do assistente. */
function normObjetivo(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/massa|hipertrof|musc|ganho|volume/.test(v)) return "Hipertrofia";
  if (/emagrec|perd|defin|seca|cutting/.test(v)) return "Emagrecimento";
  if (/for[çc]a/.test(v)) return "Força";
  if (/condic|resist|cardio|saude|saúde/.test(v)) return "Condicionamento";
  return null;
}

/** Converte um template simples no formato de plano (1 dia). */
function templateToPlan(t: WorkoutTemplate): WorkoutPlan {
  return {
    nome: t.name,
    frequencia: `${t.days}x semana`,
    nivel: t.level,
    objetivo: "Hipertrofia",
    observacao_geral: t.description,
    dias: [
      {
        nome: "A · Principal",
        foco: t.name,
        aquecimento: ["5 min de esteira em ritmo leve", "Mobilidade articular, 3 min"],
        exercicios: t.exercises.map((e) => ({
          exercicio: e.name,
          series: e.sets,
          reps: e.reps,
          descanso: e.rest,
          rpe: t.level === "Iniciante" ? 6 : 8,
          dica: "Execução controlada, sem roubar a fase excêntrica.",
        })),
        finalizador: "Prancha 3x30s, descanso 20s",
      },
    ],
    cardio: "10 a 15 min de cardio leve ao final de 2 treinos.",
  };
}

/**
 * Montar Treino Automático: seleção de aluno, pedido em linguagem natural
 * com contexto completo, plano multi-dias gerado pelo modelo real
 * (via /api/assistente; sem modelo, o gerador local do app assume) e
 * revisão editável com drag antes de atribuir.
 */
export default function PersonalTreinosPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Carregando...</div>}>
      <PersonalTreinosContent />
    </Suspense>
  );
}

function PersonalTreinosContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile, user } = useAuth();
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const gymId = profile?.gym_id ?? "";
  // Planos-modelo REAIS: reaproveita os programas já criados no gym (ai_draft).
  // Só usa os exemplos fixos quando o acervo ainda está vazio.
  const [modelos, setModelos] = useState<WorkoutTemplate[] | null>(null);
  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await (supabaseBrowser() as any)
          .from("workout_programs")
          .select("id, name, objective, ai_draft")
          .eq("gym_id", gymId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (!alive) return;
        const rows = (data ?? []) as Array<{ id: string; name: string; objective: string | null; ai_draft: string | null }>;
        const real: WorkoutTemplate[] = [];
        for (const r of rows) {
          try {
            const plan = JSON.parse(r.ai_draft ?? "") as WorkoutPlan;
            const dias = plan.dias ?? [];
            const ex = dias.flatMap((d) => (d.exercicios ?? []).map((e) => ({ name: e.exercicio, sets: e.series, reps: e.reps, rest: e.descanso })));
            if (ex.length === 0) continue;
            real.push({
              id: r.id,
              name: r.name,
              description: r.objective ?? plan.objetivo ?? "Plano do acervo",
              level: plan.nivel ?? "Intermediário",
              days: dias.length,
              exercises: ex.slice(0, 12),
            });
          } catch { /* pula plano ilegível */ }
        }
        setModelos(real.length > 0 ? real : demoTemplates());
      } catch { if (alive) setModelos(demoTemplates()); }
    })();
    return () => { alive = false; };
  }, [gymId]);
  const templates = modelos ?? [];

  const targetId = params.get("aluno") ?? "";
  const editId = params.get("edit") ?? "";
  const target = students.find((s) => s.id === targetId) ?? null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [notes, setNotes] = useState("");
  const [daysSelected, setDaysSelected] = useState<Set<string>>(new Set());
  const [assigned, setAssigned] = useState<GymAssignedPlan[]>([]);
  const [adjustSwId, setAdjustSwId] = useState<string | null>(null);
  const [massTemplate, setMassTemplate] = useState<WorkoutTemplate | null>(null);
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  // ===== Assistente guiado (a IA faz perguntas antes de gerar) =====
  const [ansNivel, setAnsNivel] = useState<string | null>(null);
  const [ansObjetivo, setAnsObjetivo] = useState<string | null>(null);
  const [ansFoco, setAnsFoco] = useState<string | null>(null); // id do FOCO_OPTS
  const [ansRestricoes, setAnsRestricoes] = useState<string[]>([]); // valores "Cuidado com ..."
  const [restDone, setRestDone] = useState(false);

  // zera as respostas ao trocar de aluno
  useEffect(() => {
    setAnsNivel(null);
    setAnsObjetivo(null);
    setAnsFoco(null);
    setAnsRestricoes([]);
    setRestDone(false);
  }, [targetId]);

  // pré-preenche nível/objetivo do perfil do aluno
  useEffect(() => {
    if (!targetId || students.length === 0) return;
    const st = students.find((s) => s.id === targetId);
    if (!st) return;
    const n = normNivel(st.experience_level);
    const o = normObjetivo(st.goal ?? st.activeWorkout);
    if (n) setAnsNivel((prev) => prev ?? n);
    if (o) setAnsObjetivo((prev) => prev ?? o);
  }, [targetId, students]);

  // passo atual do assistente: 0 nível, 1 objetivo, 2 foco, 3 restrições, 4 resumo
  const askStep = !ansNivel
    ? 0
    : !ansObjetivo
      ? 1
      : !ansFoco
        ? 2
        : !restDone
          ? 3
          : 4;

  const focoSel = FOCO_OPTS.find((f) => f.id === ansFoco) ?? null;
  const guidedReady = !!ansNivel && !!ansObjetivo && !!ansFoco && restDone;

  // Pré-seleciona os dias do aluno (disponibilidade do onboarding) ao abrir o modo atribuição
  useEffect(() => {
    if (!targetId) return;
    setDaysSelected((prev) => {
      if (prev.size > 0) return prev;
      const avail = students.find((s) => s.id === targetId)?.available_days;
      return avail?.length ? new Set(avail) : prev;
    });
  }, [targetId, students]);

  // Exercícios e equipamentos reais do banco
  const [dbExercises, setDbExercises] = useState<DBExercise[]>([]);
  const [dbEquipment, setDbEquipment] = useState<DBEquipment[]>([]);
  // Biblioteca carregada? Sem ela a IA inventa nomes fora do catálogo.
  const [libReady, setLibReady] = useState(false);

  const refresh = () => {
    if (!gymId) {
      setAssigned(listAssignedWorkouts().map((w) => ({
        id: w.id,
        studentId: w.studentId,
        studentName: w.studentName,
        programId: "",
        name: w.name,
        objective: w.level,
        status: "active",
        assigned_at: w.created_at,
        days: w.plan?.dias.length ?? 1,
        exercises: w.exercises.length,
      })));
      return;
    }
    fetchGymAssignedPlans(gymId).then(setAssigned).catch(() => setAssigned([]));
  };
  useEffect(refresh, [gymId]);
  useEffect(() => {
    if (!gymId) return;
    getGymStudents(gymId).then(setStudents).catch(() => setStudents([]));
  }, [gymId]);

  // Busca exercícios e equipamentos reais do banco
  useEffect(() => {
    if (!gymId) return;
    const sb = supabaseBrowser();
    Promise.all([
      sb.from("exercises").select("id, name, category, muscles, equipment_id, photo_url, tips").or(`gym_id.is.null,gym_id.eq.${gymId}`),
      sb.from("equipment").select("id, name, category").eq("gym_id", gymId).neq("status", "pending"),
    ]).then(([exRes, eqRes]) => {
      if (exRes.data) setDbExercises(exRes.data as DBExercise[]);
      if (eqRes.data) setDbEquipment(eqRes.data as DBEquipment[]);
      setLibReady(true);
    }).catch(() => { setLibReady(true); });
  }, [gymId]);

  // modo edição/ajuste: carrega o plano (demo via localStorage, produção via banco)
  const adjustId = params.get("adjust") ?? "";
  useEffect(() => {
    const loadId = editId || adjustId;
    if (!loadId) return;
    if (loadId.startsWith("aw-")) {
      const w = listAssignedWorkouts().find((x) => x.id === loadId);
      if (w) {
        const synthesized: WorkoutPlan = {
            nome: w.name,
            frequencia: w.frequency,
            nivel: w.level,
            objetivo: "Hipertrofia",
            observacao_geral: w.notes ?? "",
            dias: [
              {
                nome: "A · Principal",
                foco: w.name,
                aquecimento: [],
                exercicios: w.exercises.map((e) => ({
                  exercicio: e.name,
                  series: e.sets,
                  reps: e.reps,
                  descanso: e.rest,
                  rpe: 7,
                  dica: "",
                })),
                finalizador: "Prancha 3x30s",
              },
            ],
            cardio: "",
        };
        setPlan(w.plan ?? synthesized);
        setNotes(w.notes ?? "");
      }
      if (adjustId) setAdjustSwId(adjustId);
      return;
    }
    // produção: busca o plano atribuído no banco
    if (!targetId || !gymId) return;
    fetchMyAssignedPlans(targetId, gymId)
      .then((rows) => {
        const w = rows.find((x) => x.id === loadId);
        if (w?.plan) {
          setPlan(w.plan);
          setNotes(w.notes ?? "");
          if (adjustId) setAdjustSwId(adjustId);
          if (w.plan.daysSelected?.length) setDaysSelected(new Set(w.plan.daysSelected));
          // pré-preenche o assistente a partir do plano carregado (com fallback seguro)
          setAnsNivel((p) => p ?? normNivel(w.plan!.nivel) ?? "Intermediário");
          setAnsObjetivo((p) => p ?? normObjetivo(w.plan!.objetivo) ?? "Hipertrofia");
          setAnsFoco((p) => p ?? "full");
          setRestDone(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, adjustId, targetId, gymId]);

  const equipmentSample = useMemo(
    () => dbEquipment.length > 0
      ? dbEquipment.map((e) => e.name)
      : demoLib.flatMap((c) => c.name).slice(0, 10),
    [dbEquipment]
  );

  // Lista de nomes de exercícios válidos para enviar ao LLM
  const validExerciseNames = useMemo(
    () => dbExercises.map((e) => e.name),
    [dbExercises]
  );

  // ===== Trocar exercício por outro da biblioteca (na revisão) =====
  const [swapTarget, setSwapTarget] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [swapQuery, setSwapQuery] = useState("");

  const swapList = useMemo(() => {
    const q = swapQuery.trim().toLowerCase();
    return dbExercises
      .filter((e) => e.name.toLowerCase() !== "registro livre")
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [dbExercises, swapQuery]);

  /** Troca o exercício mantendo séries/reps/RPE/dica do original. */
  const swapExercise = (newName: string) => {
    if (!plan || !swapTarget) return;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, di) =>
        di === swapTarget.dayIdx
          ? {
              ...d,
              exercicios: d.exercicios.map((x, xi) =>
                xi === swapTarget.exIdx ? { ...x, exercicio: newName } : x
              ),
            }
          : d
      ),
    });
    setSwapTarget(null);
    setSwapQuery("");
  };

  /** Monta a frase estruturada a partir das respostas do assistente + observações livres. */
  const buildGuidedRequest = (obs: string): string => {
    const parts = [
      `Plano ${ansNivel} para ${target?.name ?? "o aluno"}.`,
      `Objetivo: ${ansObjetivo}.`,
      `Foco: ${focoSel?.label ?? "Corpo inteiro"}.`,
    ];
    if (ansRestricoes.length) parts.push(`Restrições e lesões a respeitar: ${ansRestricoes.join(", ")}.`);
    if (obs) parts.push(`Observações do personal: ${obs}`);
    return parts.join(" ");
  };

  const run = async () => {
    if (loading || !target) return;
    if (!libReady) {
      toast.info("Biblioteca carregando, aguarde 3 segundos.");
      return;
    }
    if (dbExercises.length === 0) {
      toast.error("Catálogo vazio", { description: "Não achei exercícios no banco. Gere de novo em instantes." });
      return;
    }
    if (!guidedReady) {
      toast.info("Responda as perguntas do assistente para gerar o plano.");
      return;
    }
    const obs = prompt.trim();
    const guidedRequest = buildGuidedRequest(obs);
    // modo ajuste: pede à IA para MODIFICAR o plano atual, não criar do zero
    const effectiveRequest = adjustSwId && plan
      ? `AJUSTE do plano atual (mantenha dias, estrutura e o que não foi citado; aplique SÓ a mudança pedida). Mudança pedida: ${obs || "otimizar o plano"}. Plano atual em JSON: ${JSON.stringify(plan).slice(0, 6000)}`
      : guidedRequest;
    setLoading(true);
    const daysArr = [...daysSelected];
    const daysMeta = {
      nivel: ansNivel,
      objetivo: ansObjetivo,
      focus: focoSel?.focus ?? ["Corpo inteiro"],
      restricoes: ansRestricoes,
      observacoes: obs || null,
    };
    const fallback = generatePlanOffline(effectiveRequest, target.name, {
      dbExercises: dbExercises.length > 0 ? dbExercises : undefined,
      equipment: dbEquipment.length > 0 ? dbEquipment : undefined,
      student: {
        name: target.name,
        sex: target.sex,
        experience_level: target.experience_level,
        available_days: target.available_days,
        goal: target.goal,
        medical_risk: target.medical_risk,
        medications: target.medications,
        birth_date: target.birth_date,
        restrictions: target.surgery_history,
      },
      daysSelected: daysArr.length > 0 ? daysArr : target.available_days ?? undefined,
      daysMeta,
    });
    try {
      const res = await fetch(apiPath("/api/assistente"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: buildWorkoutPrompt({
            studentName: target.name,
            goal: ansObjetivo,
            level: ansNivel,
            frequency: fallback.frequencia,
            days: daysArr.length > 0 ? daysArr : target.available_days ?? [],
            restrictions: [target.surgery_history, target.medications, ...ansRestricoes].filter(Boolean).join(", ") || undefined,
            equipment: equipmentSample,
            request: effectiveRequest,
            sex: target.sex,
            experience_level: ansNivel,
            medications: target.medications,
            medical_risk: target.medical_risk,
            birth_date: target.birth_date,
            available_days: target.available_days,
          }),
          context: "personal",
          extras: validExerciseNames.length > 0
            ? {
                "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)":
                  validExerciseNames.slice(0, 200).join(" | "),
              }
            : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
      setLoading(false);
      if (data.ok && data.text) {
        let parsed = parsePlanFromLLM(data.text, fallback);
        // Valida e corrige nomes de exercícios contra o banco
        if (dbExercises.length > 0) {
          parsed = validateAndFixExercises(parsed, dbExercises);
        }
        setPlan(parsed);
      } else {
        toast.error(data.error ?? "O Assistente está offline no momento. Tente novamente.");
        toast.info("Montei com o gerador local do app. Revise antes de enviar.");
        setPlan(fallback);
      }
      setActiveDay(0);
      setNotes("");
    } catch {
      setLoading(false);
      toast.error("O Assistente está offline no momento. Tente novamente.");
      setPlan(fallback);
      setActiveDay(0);
    }
  };

  const updateDay = (dayIdx: number, patch: Partial<WorkoutPlan["dias"][number]>) => {
    if (!plan) return;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)),
    });
  };

  // ===== PASSO 5: aprovar e atribuir (ou salvar edição / ajuste v2) =====
  const approve = async () => {
    if (!plan || !target || !profile || !user) return;
    const flat = plan.dias.flatMap((d) =>
      d.exercicios.map((e) => ({ name: e.exercicio, sets: e.series, reps: e.reps, rest: e.descanso }))
    );
    if (editId && editId.startsWith("aw-") && !adjustSwId) {
      updateAssignedWorkout(editId, {
        name: plan.nome,
        notes: notes.trim() || null,
        frequency: plan.frequencia,
        level: plan.nivel,
        exercises: flat,
        plan,
      });
      toast.success("Plano atualizado com sucesso!", {
        description: `${target.name} recebeu a nova versão com ${plan.dias.length} ${plan.dias.length === 1 ? "dia" : "dias"} de treino.`,
      });
    } else {
      try {
        await approvePlan({
          gymId: profile.gym_id,
          trainerId: user.id,
          student: target,
          plan: { ...plan, daysSelected: [...daysSelected] },
          notes: notes.trim() || null,
        });
        // edição/ajuste em produção: conclui o plano anterior (vira histórico)
        const prevId = adjustSwId ?? (editId && !editId.startsWith("aw-") ? editId : null);
        if (prevId) {
          await completeStudentWorkout(prevId).catch(() => {});
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu salvar o plano. Tente novamente.");
        return;
      }
      toast.success(adjustSwId ? "Plano ajustado com sucesso!" : editId ? "Plano atualizado com sucesso!" : "Plano enviado com sucesso!", {
        description: `${target.name} recebeu "${plan.nome}" com ${plan.dias.length} ${plan.dias.length === 1 ? "dia" : "dias"} de treino.`,
      });
    }
    setPlan(null);
    setPrompt("");
    setNotes("");
    setAdjustSwId(null);
    refresh();
    router.replace("/personal/treinos");
  };

  const applyMass = async () => {
    if (!massTemplate || massSelected.size === 0 || !profile || !user) return;
    const targets = [...massSelected]
      .map((sid) => students.find((s) => s.id === sid))
      .filter((s): s is PersonalStudent => !!s);
    const results = await Promise.allSettled(
      targets.map((student) =>
        approvePlan({
          gymId: profile.gym_id,
          trainerId: user.id,
          student,
          plan: templateToPlan(massTemplate),
          notes: null,
        })
      )
    );
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const failNames = targets.filter((_, i) => results[i].status === "rejected").map((s) => s.name.split(" ")[0]);
    if (failNames.length > 0) {
      toast.error(`Falha ao enviar para ${failNames.join(", ")}`);
    }
    if (okCount > 0) {
      toast.success("Plano enviado com sucesso!", {
        description: `Plano aplicado para ${okCount} aluno${okCount === 1 ? "" : "s"}.`,
      });
    }
    setMassTemplate(null);
    setMassSelected(new Set());
    refresh();
  };

  // ===== MODO ATRIBUIÇÃO =====
  if (target) {
    const day = plan?.dias[Math.min(activeDay, (plan?.dias.length ?? 1) - 1)];
    return (
      <div className="space-y-5">
        {/* Passo 2: aluno fixo */}
        <header className="gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-4">
          <Avatar className="h-11 w-11 border-2 border-brand/60">
            <AvatarImage src={target.avatar ?? undefined} alt="" />
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
              {target.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
              {editId ? "Editando plano de" : "Montando plano para:"}
            </p>
            <p className="truncate text-base font-bold text-foreground">{target.name}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-xl text-[11px]"
            onClick={() => router.replace("/personal/treinos")}
          >
            Trocar
          </Button>
        </header>

        {/* Passo 3: assistente guiado — a IA faz perguntas antes de gerar */}
        <section className="gf-card gf-glass !p-4" aria-label="Assistente de montagem">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
            </span>
            <p className="text-[13px] font-semibold text-foreground">
              {adjustSwId ? "Ajustar plano com IA · gera a v2" : `Assistente GF · montando o plano de ${target.name.split(" ")[0]} com você`}
            </p>
          </div>
          {adjustSwId && plan ? (
            <div className="mb-3 rounded-2xl border border-[#FFC24D]/25 bg-[#FFC24D]/[0.07] p-3">
              <p className="text-[11.5px] leading-snug text-foreground">
                Ajustando <strong>“{plan.nome}”</strong>. Descreva a mudança nas observações abaixo
                (ex.: trocar supino por crucifixo, subir volume de pernas) e gere — o aluno recebe a v2 e a anterior vira histórico.
              </p>
            </div>
          ) : null}

          {/* Pergunta 1: nível */}
          <div className="mb-2.5 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
            Qual o nível de {target.name.split(" ")[0]} hoje?
          </div>
          {askStep > 0 && ansNivel ? (
            <div className="mb-2.5 flex justify-end">
              <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                {ansNivel}
              </span>
            </div>
          ) : null}
          {askStep === 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Nível do aluno">
              {NIVEL_OPTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnsNivel(n)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[11.5px] font-bold transition-colors",
                    ansNivel === n
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-brand/40 hover:text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}

          {/* Pergunta 2: objetivo */}
          {askStep >= 1 ? (
            <>
              <div className="mb-2.5 mt-1 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                E qual o objetivo principal?
              </div>
              {askStep > 1 && ansObjetivo ? (
                <div className="mb-2.5 flex justify-end">
                  <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                    {ansObjetivo}
                  </span>
                </div>
              ) : null}
              {askStep === 1 ? (
                <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Objetivo do plano">
                  {OBJETIVO_OPTS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setAnsObjetivo(o)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-[11.5px] font-bold transition-colors",
                        ansObjetivo === o
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-brand/40 hover:text-foreground"
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {/* Pergunta 3: foco */}
          {askStep >= 2 ? (
            <>
              <div className="mb-2.5 mt-1 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                Qual o foco do plano?
              </div>
              {askStep > 2 && focoSel ? (
                <div className="mb-2.5 flex justify-end">
                  <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                    {focoSel.label}
                  </span>
                </div>
              ) : null}
              {askStep === 2 ? (
                <div className="mb-3 grid grid-cols-2 gap-1.5" role="group" aria-label="Foco do plano">
                  {FOCO_OPTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAnsFoco(f.id)}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-colors",
                        ansFoco === f.id
                          ? "border-brand bg-brand/10"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-brand/40"
                      )}
                    >
                      <p className={cn("text-[11.5px] font-bold", ansFoco === f.id ? "text-brand" : "text-foreground")}>
                        {f.label}
                      </p>
                      <p className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{f.sub}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {/* Pergunta 4: restrições */}
          {askStep >= 3 ? (
            <>
              <div className="mb-2.5 mt-1 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                {target.name.split(" ")[0]} tem alguma restrição ou lesão? Toque em quantas precisar.
              </div>
              {(target.medical_risk || target.medications) && !restDone ? (
                <p className="mb-2 rounded-xl border border-[#FFC24D]/25 bg-[#FFC24D]/[0.07] p-2.5 text-[10.5px] leading-snug text-[#FFC24D]">
                  Atenção: ficha do aluno marca risco médico
                  {target.medications ? ` (usa ${target.medications.split(",")[0].trim()})` : ""}. Confira as restrições abaixo.
                </p>
              ) : null}
              {restDone && askStep > 3 ? (
                <div className="mb-2.5 flex justify-end">
                  <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                    {ansRestricoes.length ? ansRestricoes.join(" · ") : "Sem restrições"}
                  </span>
                </div>
              ) : null}
              {!restDone ? (
                <div className="mb-1 flex flex-wrap gap-1.5" role="group" aria-label="Restrições do aluno">
                  {RESTRICAO_OPTS.map((r) => {
                    const on = r.value === null ? false : ansRestricoes.includes(r.value);
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => {
                          if (r.value === null) {
                            setAnsRestricoes([]);
                            setRestDone(true);
                            return;
                          }
                          setAnsRestricoes((prev) => {
                            const next = prev.includes(r.value!) ? prev.filter((x) => x !== r.value) : [...prev, r.value!];
                            if (next.length) setRestDone(true);
                            return next;
                          });
                        }}
                        aria-pressed={on}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left transition-colors",
                          on
                            ? "border-brand bg-brand/15"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-brand/40"
                        )}
                      >
                        <p className={cn("text-[11px] font-bold", on ? "text-brand" : "text-foreground")}>{r.label}</p>
                        <p className="text-[9px] text-muted-foreground">{r.sub}</p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!restDone && ansRestricoes.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setRestDone(true)}
                  className="tactile mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-brand"
                >
                  Sem restrições, continuar
                </button>
              ) : null}
            </>
          ) : null}

          {/* Resumo + observações + dias */}
          {askStep >= 4 ? (
            <div className="mt-2 rounded-2xl border border-brand/25 bg-brand/[0.05] p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Resumo para gerar
              </p>
              <p className="text-[11.5px] leading-relaxed text-foreground">
                <strong>{ansNivel}</strong> · <strong>{ansObjetivo}</strong> · <strong>{focoSel?.label}</strong>
                {ansRestricoes.length ? (
                  <span className="text-[#FFC24D]"> · {ansRestricoes.join(", ")}</span>
                ) : (
                  " · sem restrições"
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAnsNivel(null);
                  setAnsObjetivo(null);
                  setAnsFoco(null);
                  setAnsRestricoes([]);
                  setRestDone(false);
                }}
                className="mt-1.5 text-[10.5px] font-bold text-brand hover:underline"
              >
                Refazer perguntas
              </button>
            </div>
          ) : null}

          {/* dias da semana */}
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dias da semana do aluno
            </p>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => {
                const on = daysSelected.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setDaysSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(d)) next.delete(d);
                        else next.add(d);
                        return next;
                      })
                    }
                    aria-pressed={on}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                      on ? "border-brand bg-brand text-brand-foreground" : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* observações livres do personal */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder={adjustSwId ? "Descreva o ajuste: ex. trocar supino por crucifixo, mais volume de pernas" : "Observações (opcional): ex. evita impacto, prefere máquinas, semana de retorno"}
            aria-label="Observações do personal"
            className="mt-2.5 w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />

          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-[9.5px] text-muted-foreground">
              Dias, aparelhos e ficha do aluno entram automaticamente.
            </p>
            <Button onClick={run} disabled={loading || !guidedReady || !libReady} size="sm" className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {!libReady ? "Carregando biblioteca..." : adjustSwId ? "Gerar ajuste (v2)" : "Gerar plano completo"}
            </Button>
          </div>
        </section>

        {/* Estado de geração */}
        <AnimatePresence>
          {loading ? (
            <motion.section
              key="thinking"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="gf-card gf-glass space-y-2.5 !p-4"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <Sparkles className="h-4 w-4 animate-pulse text-brand" />
                Periodizando o plano de {target.name.split(" ")[0]}...
              </p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                  <span className="h-2.5 w-1/2 animate-pulse rounded-full bg-white/[0.07]" />
                  <span className="h-2.5 w-14 animate-pulse rounded-full bg-white/[0.07]" />
                </div>
              ))}
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* Passo 4: plano editável multi-dias */}
        <AnimatePresence mode="wait">
          {plan && day ? (
            <motion.section
              key={plan.nome + plan.dias.length}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="gf-card gf-glass space-y-3 !p-4"
              aria-label="Plano de treino editável"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                  <Sparkles className="h-4 w-4 text-brand" />
                </span>
                <input
                  value={plan.nome}
                  onChange={(e) => setPlan({ ...plan, nome: e.target.value })}
                  aria-label="Nome do plano"
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-sm font-bold text-foreground hover:border-white/[0.08] focus-visible:border-brand/40 focus-visible:outline-none"
                />
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                  {plan.frequencia}
                </span>
              </div>

              {/* resumo do plano */}
              <div className="flex flex-wrap gap-1.5 text-[9.5px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold text-muted-foreground">
                  <Target className="h-3 w-3 text-brand" /> {plan.objetivo}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold text-muted-foreground">
                  <Flame className="h-3 w-3 text-[#FFC24D]" /> {plan.nivel}
                </span>
                {plan.cardio ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold text-muted-foreground">
                    <Clock className="h-3 w-3 text-[#4ADE80]" /> cardio semanal
                  </span>
                ) : null}
              </div>
              <p className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-[11px] leading-snug text-muted-foreground">
                {plan.observacao_geral}
              </p>

              {/* tabs de dias */}
              {plan.dias.length > 1 ? (
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Dias do plano">
                  {plan.dias.map((d, i) => (
                    <button
                      key={d.nome + i}
                      role="tab"
                      aria-selected={activeDay === i}
                      onClick={() => setActiveDay(i)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-[10.5px] font-bold transition-colors",
                        activeDay === i
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-white/[0.06] bg-white/[0.03] text-muted-foreground"
                      )}
                    >
                      {d.nome}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* dia ativo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={day.nome}
                    onChange={(e) => updateDay(activeDay, { nome: e.target.value })}
                    aria-label="Nome do dia"
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-[12px] font-bold text-brand hover:border-white/[0.08] focus-visible:border-brand/40 focus-visible:outline-none"
                  />
                  <span className="shrink-0 text-[10px] text-muted-foreground">{day.foco}</span>
                </div>

                {day.aquecimento.length ? (
                  <p className="rounded-xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.06] p-2.5 text-[10.5px] leading-snug text-[#4ADE80]">
                    Aquecimento: {day.aquecimento.join(" · ")}
                  </p>
                ) : null}

                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Arraste para reordenar · troque ou edite direto no card
                </p>

                <Reorder.Group
                  axis="y"
                  values={day.exercicios}
                  onReorder={(next) => updateDay(activeDay, { exercicios: next })}
                  className="space-y-2"
                >
                  {day.exercicios.map((e, i) => (
                    <Reorder.Item
                      key={e.exercicio + i}
                      value={e}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5"
                    >
                      {/* linha 1: nome inteiro, sem corte */}
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                        <p className="min-w-0 flex-1 break-words text-[12.5px] font-semibold leading-snug text-foreground">
                          {i + 1}. {e.exercicio}
                        </p>
                        <button
                          onClick={() => {
                            setSwapTarget({ dayIdx: activeDay, exIdx: i });
                            setSwapQuery("");
                          }}
                          aria-label={`Trocar ${e.exercicio} por outro exercício`}
                          className="tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-brand"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            updateDay(activeDay, {
                              exercicios: day.exercicios.filter((_, xi) => xi !== i),
                            })
                          }
                          aria-label={`Remover ${e.exercicio}`}
                          className="tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-[#F87171]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* linha 2: séries x reps + dica */}
                      <div className="mt-2 flex items-center gap-2 pl-6">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={e.series}
                          onChange={(ev) =>
                            updateDay(activeDay, {
                              exercicios: day.exercicios.map((x, xi) =>
                                xi === i ? { ...x, series: Math.max(1, Math.min(10, Number(ev.target.value) || 1)) } : x
                              ),
                            })
                          }
                          aria-label={`Séries de ${e.exercicio}`}
                          className="h-9 w-12 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[12px] tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                        />
                        <span className="shrink-0 text-[10px] text-muted-foreground">x</span>
                        <input
                          value={e.reps}
                          onChange={(ev) =>
                            updateDay(activeDay, {
                              exercicios: day.exercicios.map((x, xi) =>
                                xi === i ? { ...x, reps: ev.target.value } : x
                              ),
                            })
                          }
                          aria-label={`Repetições de ${e.exercicio}`}
                          className="h-9 w-16 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                        />
                        <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                          RPE {e.rpe}
                        </span>
                      </div>
                      {e.dica ? (
                        <p className="mt-1.5 break-words pl-6 text-[10px] leading-snug text-muted-foreground">{e.dica}</p>
                      ) : null}
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                {day.finalizador ? (
                  <p className="rounded-xl border border-brand/20 bg-brand/[0.06] p-2.5 text-[10.5px] leading-snug text-brand">
                    Finalizador: {day.finalizador}
                  </p>
                ) : null}
                {activeDay < plan.dias.length - 1 ? (
                  <button
                    onClick={() => setActiveDay(activeDay + 1)}
                    className="tactile w-full break-words rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] font-bold leading-snug text-muted-foreground transition-colors hover:text-brand"
                  >
                    Revisar próximo dia: {plan.dias[activeDay + 1].nome}
                  </button>
                ) : null}
              </div>

              {/* observação do personal */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MessageSquareText className="h-3.5 w-3.5" /> Observação do Personal
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex.: Semana 1 mais leve, subir carga na semana 2 se o RPE ficar em 7"
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.05] p-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                />
              </div>

              <Button onClick={approve} size="lg" className="h-12 w-full rounded-2xl text-[13px] font-bold">
                <ClipboardCheck className="mr-2 h-4.5 w-4.5" />
                {editId ? "Salvar Alterações" : "Aprovar e Atribuir"}
              </Button>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* Trocar exercício: picker da biblioteca */}
        <BottomSheet open={!!swapTarget} onClose={() => setSwapTarget(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">Trocar exercício</p>
              <p className="text-[11px] text-muted-foreground">
                {swapTarget && plan ? `Substituindo "${plan.dias[swapTarget.dayIdx]?.exercicios[swapTarget.exIdx]?.exercicio}". Mantém séries, reps e RPE.` : "Escolha um exercício da biblioteca."}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={swapQuery}
                onChange={(e) => setSwapQuery(e.target.value)}
                placeholder="Buscar exercício..."
                aria-label="Buscar exercício para trocar"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
            </div>
            <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto">
              {swapList.length === 0 ? (
                <li className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-[12px] text-muted-foreground">
                  Nenhum exercício encontrado para essa busca.
                </li>
              ) : (
                swapList.map((ex) => {
                  const current = swapTarget && plan ? plan.dias[swapTarget.dayIdx]?.exercicios[swapTarget.exIdx]?.exercicio === ex.name : false;
                  return (
                    <li key={ex.id}>
                      <button
                        onClick={() => swapExercise(ex.name)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors",
                          current ? "border-brand/40 bg-brand/10" : "border-white/[0.06] bg-white/[0.03] hover:border-brand/30"
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                          <Dumbbell className="h-3.5 w-3.5 text-brand" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{ex.name}</p>
                          <p className="text-[10px] capitalize text-muted-foreground">{ex.category}</p>
                        </div>
                        {current ? <Check className="h-4 w-4 shrink-0 text-brand" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </BottomSheet>
      </div>
    );
  }

  // ===== VISÃO GERAL =====
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-bold text-foreground">Montar Treino Automático</h1>
        <p className="text-[11px] text-muted-foreground">
          {assigned.length} plano{assigned.length === 1 ? "" : "s"} atribuído{assigned.length === 1 ? "" : "s"}
        </p>
      </header>

      <button
        onClick={() => setPickerOpen(true)}
        className="gf-card gf-glass flex w-full items-center gap-3 !rounded-2xl !p-4 text-left transition-transform active:scale-[0.985]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
          <Plus className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Novo Plano de Treino</p>
          <p className="text-[11px] text-muted-foreground">
            Selecionar aluno e gerar o plano completo
          </p>
        </div>
        <UserRoundPlus className="h-4.5 w-4.5 text-brand" />
      </button>

      <section aria-labelledby="tpl-title">
        <h2 id="tpl-title" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4 text-brand" />
          Planos-modelo
        </h2>
        <div className="no-scrollbar snap-x snap-mandatory flex gap-3 overflow-x-auto pb-2">
          {modelos === null ? (
            [0, 1].map((i) => (
              <div key={i} className="gf-card gf-glass w-[240px] shrink-0 snap-start space-y-2 !p-4">
                <div className="skeleton-line h-4 w-3/4" />
                <div className="skeleton-line h-3 w-full" />
                <div className="skeleton-line h-9 w-full" />
              </div>
            ))
          ) : (
          templates.map((t) => (
            <article key={t.id} className="gf-card gf-glass w-[240px] shrink-0 snap-start space-y-2 !p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold leading-tight text-foreground">{t.name}</p>
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                  {t.level}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{t.description}</p>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 w-full rounded-xl text-[11px] font-bold"
                onClick={() => {
                  setMassTemplate(t);
                  setMassSelected(new Set());
                }}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Aplicar em Massa
              </Button>
            </article>
          ))
          )}
        </div>
      </section>

      {assigned.length > 0 ? (
        <section aria-labelledby="assigned-title">
          <h2 id="assigned-title" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <History className="h-4 w-4 text-brand" />
            Atribuídos
          </h2>
          <div className="space-y-2">
            {assigned.map((w) => (
              <div key={w.id} className="gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-3.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={students.find((s) => s.id === w.studentId)?.avatar ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
                    {w.studentName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {w.studentName.split(" ")[0]} ·{" "}
                    {`${w.days} dia${w.days === 1 ? "" : "s"} · `}
                    {w.exercises} exercícios · {fmtDate(w.assigned_at)}
                    {w.status !== "active" ? " · concluído" : ""}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/personal/treinos?aluno=${w.studentId}&adjust=${w.id}`)}
                  aria-label={`Ajustar ${w.name} com IA`}
                  title="Ajustar com IA"
                  className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand transition-colors hover:bg-brand/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => router.push(`/personal/treinos?aluno=${w.studentId}&edit=${w.id}`)}
                  aria-label={`Editar ${w.name}`}
                  className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (w.id.startsWith("aw-")) {
                      deleteAssignedWorkout(w.id);
                    } else {
                      await completeStudentWorkout(w.id).catch(() => {});
                    }
                    refresh();
                    toast.success("Treino removido");
                  }}
                  aria-label={`Remover ${w.name}`}
                  className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-[#F87171]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* seleção de aluno */}
      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="space-y-3">
          <div>
            <p className="text-base font-bold text-foreground">Para quem é o plano?</p>
            <p className="text-[11px] text-muted-foreground">Selecione um aluno da sua lista</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Buscar aluno..."
              aria-label="Buscar aluno no seletor"
              className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            />
          </div>
          <ul className="space-y-1.5">
            {students
              .filter((s) => s.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
              .map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setPickerOpen(false);
                      setPickerQuery("");
                      router.push(`/personal/treinos?aluno=${s.id}`);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-brand/30"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={s.avatar ?? undefined} alt="" />
                      <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
                        {s.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.activeWorkout ?? "Sem treino"}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted-foreground" aria-hidden>
                      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </BottomSheet>

      {/* aplicar em massa */}
      <BottomSheet open={!!massTemplate} onClose={() => setMassTemplate(null)}>
        {massTemplate ? (
          <div className="space-y-4">
            <div>
              <p className="text-base font-bold text-foreground">{massTemplate.name}</p>
              <p className="text-[11px] text-muted-foreground">
                Selecione os alunos que vão receber este plano
              </p>
            </div>
            <ul className="space-y-1.5">
              {students.map((s) => {
                const on = massSelected.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() =>
                        setMassSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors",
                        on ? "border-brand/40 bg-brand/10" : "border-white/[0.06] bg-white/[0.03]"
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.avatar ?? undefined} alt="" />
                        <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
                          {s.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                        {s.name}
                      </p>
                      <span
                        className={cn(
                          "flex h-5.5 w-5.5 items-center justify-center rounded-md border",
                          on ? "border-brand bg-brand text-brand-foreground" : "border-border bg-transparent"
                        )}
                      >
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              size="lg"
              className="h-12 w-full rounded-2xl text-[13px] font-bold"
              disabled={massSelected.size === 0}
              onClick={applyMass}
            >
              Aplicar para {massSelected.size} {massSelected.size === 1 ? "aluno" : "alunos"}
            </Button>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
