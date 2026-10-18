"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Library,
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
  ListChecks,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { NewExerciseForm } from "~/components/training/NewExerciseForm";
import { TreinoGuide } from "~/components/personal/TreinoGuide";
import { waStudentLink, buildPlanWhatsMessage } from "~/lib/whatsapp";

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
import { buildSkeleton, defaultPrescription } from "~/lib/ai/skeleton";
import {
  type PersonalStudent,
  type WorkoutTemplate,
} from "~/lib/personal-data";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";
import {
  approvePlan,
  assignExistingPlan,
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

/** Busca sem acento nem maiúscula ("biceps" acha "Bíceps", "marilia" acha "Marília"). */
const normBusca = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();

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

/** Divisão por slots (rotação A, B, C... sem dia fixo): o personal escolhe. */
const SPLIT_OPTS = [
  { id: "AB", label: "AB", sub: "2 treinos em rotação" },
  { id: "ABC", label: "ABC", sub: "3 treinos em rotação" },
  { id: "ABCD", label: "ABCD", sub: "4 treinos em rotação" },
  { id: "ABCDE", label: "ABCDE", sub: "5 treinos em rotação" },
  { id: "ABCDEF", label: "ABCDEF", sub: "6 treinos em rotação" },
] as const;

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
        setModelos(real.length > 0 ? real : []);
      } catch { if (alive) setModelos([]); }
    })();
    return () => { alive = false; };
  }, [gymId]);
  const templates = modelos ?? [];

  const targetId = params.get("aluno") ?? "";
  const editId = params.get("edit") ?? "";
  const target = students.find((s) => s.id === targetId) ?? null;

  // Conta as gerações em andamento: se o aluno trocar no meio, a resposta
  // antiga é descartada e nunca vira plano do aluno novo.
  const genSeq = useRef(0);

  // Troca de aluno: zera TUDO que pertence ao aluno/plano anterior (plano,
  // prompt, observações, dias, modo ajuste e respostas do assistente) para
  // não misturar fichas de um aluno com o treino de outro.
  useEffect(() => {
    genSeq.current += 1;
    setEntry(null);
    setPlan(null);
    setActiveDay(0);
    setExpandAll(false);
    setPrompt("");
    setNotes("");
    setDaysSelected(new Set());
    setAdjustSwId(null);
    setSavedOk(false);
    setApproving(false);
    setLoading(false);
    setUsedFallback(false);
    setDiscardAsk(false);
    setSwapTarget(null);
    setSwapQuery("");
    setPickSheet(null);
    setPickSel(new Set());
    setPickQuery("");
    setPickCatOpen(null);
    setCatOpen(null);
    setCopyQuery("");
    setCreatingEx(false);
    setGenCreatingEx(false);
    setRepeatSheet(null);
    setRepeatSelected(new Set());
    setRepeatQuery("");
    setAnsNivel(null);
    setAnsSexo(null);
    setAnsObjetivo([]);
    setObjetivoDone(false);
    setAnsFoco([]);
    setFocoDone(false);
    setAnsSplit(null);
    setAnsRestricoes([]);
    setRestDone(false);
  }, [targetId]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [expandAll, setExpandAll] = useState(false);
  const [notes, setNotes] = useState("");
  const [daysSelected, setDaysSelected] = useState<Set<string>>(new Set());
  const [assigned, setAssigned] = useState<GymAssignedPlan[]>([]);
  const [assignedTotal, setAssignedTotal] = useState(0);
  const [assignedLoadingMore, setAssignedLoadingMore] = useState(false);
  const [adjustSwId, setAdjustSwId] = useState<string | null>(null);
  // trava dos botões que disparam escrita no banco (nada de duplo toque)
  const [approving, setApproving] = useState(false);
  const [massSaving, setMassSaving] = useState(false);
  // plano já salvo: libera o aviso no WhatsApp e troca o botão por "Concluir"
  const [savedOk, setSavedOk] = useState(false);
  const [massTemplate, setMassTemplate] = useState<WorkoutTemplate | null>(null);
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  // ===== Assistente guiado (a IA faz perguntas antes de gerar) =====
  const [ansNivel, setAnsNivel] = useState<string | null>(null);
  const [ansSexo, setAnsSexo] = useState<string | null>(null); // "F" ou "M" — define o cérebro da IA
  const [ansObjetivo, setAnsObjetivo] = useState<string[]>([]); // pode marcar vários (ex.: hipertrofia + condicionamento)
  const [objetivoDone, setObjetivoDone] = useState(false);
  const [ansFoco, setAnsFoco] = useState<string[]>([]); // ids do FOCO_OPTS — pode marcar vários (ex.: braços + ombros)
  const [focoDone, setFocoDone] = useState(false);
  const [ansSplit, setAnsSplit] = useState<string | null>(null); // id do SPLIT_OPTS (AB..ABCDEF)
  const [usedFallback, setUsedFallback] = useState(false); // IA falhou: plano local
  const [genElapsed, setGenElapsed] = useState(0);
  const [ansRestricoes, setAnsRestricoes] = useState<string[]>([]); // valores "Cuidado com ..."
  const [restDone, setRestDone] = useState(false);

  // cronômetro da geração (a IA pode levar ~30-50s; mostra honestamente)
  useEffect(() => {
    if (!loading) {
      setGenElapsed(0);
      return;
    }
    const t0 = Date.now();
    const t = setInterval(() => setGenElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [loading]);

  // pré-preenche nível/objetivo do perfil do aluno
  useEffect(() => {
    if (!targetId || students.length === 0) return;
    const st = students.find((s) => s.id === targetId);
    if (!st) return;
    const n = normNivel(st.experience_level);
    const o = normObjetivo(st.goal ?? st.activeWorkout);
    if (n) setAnsNivel((prev) => prev ?? n);
    if (st.sex) setAnsSexo((prev) => prev ?? (st.sex === "F" ? "F" : st.sex === "M" ? "M" : null));
    // pré-preenchido conta como confirmado (1 toque continua valendo)
    if (o) {
      setAnsObjetivo((prev) => (prev.length > 0 ? prev : [o]));
      setObjetivoDone(true);
    }
  }, [targetId, students]);

  // passo atual do assistente: 0 nível, 1 objetivo, 2 foco, 3 restrições, 4 resumo
  const askStep = !ansNivel
    ? 0
    : !objetivoDone
      ? 1
      : !focoDone
        ? 2
        : !restDone
          ? 3
          : 4;

  const objetivoLabel = ansObjetivo.length > 0 ? ansObjetivo.join(", ") : "Condicionamento";
  const toggleObjetivo = (o: string) =>
    setAnsObjetivo((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const focoSels = FOCO_OPTS.filter((f) => ansFoco.includes(f.id));
  const focoLabel = focoSels.length
    ? focoSels.map((f) => f.label).join(", ")
    : "Corpo inteiro";
  const toggleFoco = (id: string) =>
    setAnsFoco((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const guidedReady = !!ansNivel && !!ansSexo && objetivoDone && ansObjetivo.length > 0 && focoDone && ansFoco.length > 0 && restDone;
  // Divisão sugerida pela quantidade de dias marcados; o personal pode trocar.
  const splitSug =
    daysSelected.size <= 2 ? "AB"
    : daysSelected.size === 3 ? "ABC"
    : daysSelected.size === 4 ? "ABCD"
    : daysSelected.size === 5 ? "ABCDE"
    : "ABCDEF";
  const split = ansSplit ?? (daysSelected.size > 0 ? splitSug : "ABC");
  const splitLen = split.length; // "ABCDE".length = 5 treinos (slots A..E)

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
  const [libError, setLibError] = useState(false);
  const [libTick, setLibTick] = useState(0);

  const refresh = () => {
    if (!gymId) {
      const rows = listAssignedWorkouts().map((w) => ({
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
      }));
      setAssigned(rows);
      setAssignedTotal(rows.length);
      return;
    }
    fetchGymAssignedPlans(gymId)
      .then((rows) => {
        setAssigned(rows);
        setAssignedTotal(rows.total);
      })
      .catch(() => {
        setAssigned([]);
        setAssignedTotal(0);
      });
  };
  useEffect(refresh, [gymId]);

  const loadMorePlans = () => {
    if (!gymId || assignedLoadingMore) return;
    setAssignedLoadingMore(true);
    fetchGymAssignedPlans(gymId, { offset: assigned.length, limit: 40 })
      .then((rows) => {
        setAssigned((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...rows.filter((r) => !seen.has(r.id))];
        });
        setAssignedTotal(rows.total);
      })
      .catch(() => toast.error("Não deu carregar mais planos agora."))
      .finally(() => setAssignedLoadingMore(false));
  };
  useEffect(() => {
    if (!gymId) return;
    getGymStudents(gymId).then(setStudents).catch(() => setStudents([]));
  }, [gymId]);

  // Busca exercícios e equipamentos reais do banco (com retry visível se falhar)
  useEffect(() => {
    if (!gymId) return;
    const sb = supabaseBrowser();
    Promise.all([
      sb.from("exercises").select("id, name, category, muscles, equipment_id, photo_url, tips, aliases").or(`gym_id.is.null,gym_id.eq.${gymId}`),
      sb.from("equipment").select("id, name, category").eq("gym_id", gymId).neq("status", "pending"),
    ]).then(([exRes, eqRes]) => {
      if (exRes.data) setDbExercises(exRes.data as DBExercise[]);
      if (eqRes.data) setDbEquipment(eqRes.data as DBEquipment[]);
      setLibError(!exRes.data || exRes.data.length === 0);
      setLibReady(true);
    }).catch(() => { setLibError(true); setLibReady(true); });
  }, [gymId, libTick]);

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
          // pré-preenche o assistente a partir do plano carregado (com fallback seguro).
          // Formato atual é multi-seleção: nível/objetivo/foco entram confirmados
          // para a edição/ajuste não travar o botão de gerar.
          setAnsNivel((p) => p ?? normNivel(w.plan!.nivel) ?? "Intermediário");
          const loadedObj = normObjetivo(w.plan!.objetivo);
          setAnsObjetivo((prev) => (prev.length > 0 ? prev : loadedObj ? [loadedObj] : []));
          if (loadedObj) setObjetivoDone(true);
          setAnsFoco([]);
          setFocoDone(true);
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
  // Entrada guiada (passo 1): com IA, manual ou copiar plano de outro aluno
  const [entry, setEntry] = useState<"choose" | "ia" | "manual" | "copy" | null>(null);
  const [copyQuery, setCopyQuery] = useState("");
  const [copySaving, setCopySaving] = useState(false);
  const [discardAsk, setDiscardAsk] = useState(false);
  // Picker de MÚLTIPLA escolha por categoria (modo esqueleto guiado)
  const [pickSheet, setPickSheet] = useState<{ dayIdx: number } | null>(null);
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());
  const [pickQuery, setPickQuery] = useState("");
  const [pickCatOpen, setPickCatOpen] = useState<string | null>(null);
  // Criar exercício do zero dentro do picker ou da geração
  const [creatingEx, setCreatingEx] = useState(false);
  const [genCreatingEx, setGenCreatingEx] = useState(false);
  const [catOpen, setCatOpen] = useState<string | null>(null);
  // Repetir plano para outros alunos (mesmo programa, sem gerar de novo)
  const [repeatSheet, setRepeatSheet] = useState<{ programId: string; planName: string; excludeId?: string } | null>(null);
  const [repeatSelected, setRepeatSelected] = useState<Set<string>>(new Set());
  const [repeatQuery, setRepeatQuery] = useState("");
  const [repeatSaving, setRepeatSaving] = useState(false);

  const swapList = useMemo(() => {
    const q = normBusca(swapQuery);
    const matches = (e: DBExercise) =>
      !q ||
      normBusca(e.name).includes(q) ||
      normBusca(e.category).includes(q) ||
      (e.muscles ?? []).some((m) => normBusca(m).includes(q)) ||
      (e.aliases ?? []).some((a) => normBusca(a).includes(q));
    return dbExercises
      .filter((e) => e.name.toLowerCase() !== "registro livre")
      .filter(matches)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dbExercises, swapQuery]);

  /** Troca o exercício mantendo séries/reps/RPE/dica do original.
   *  Com exIdx -1, ADICIONA um exercício avulso no dia (3x10-12 padrão). */
  const swapExercise = (newName: string) => {
    if (!plan || !swapTarget) return;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, di) =>
        di === swapTarget.dayIdx
          ? {
              ...d,
              exercicios:
                swapTarget.exIdx === -1
                  ? [
                      ...d.exercicios,
                      { exercicio: newName, series: 3, reps: "10-12", descanso: "60s", rpe: 7, dica: "" },
                    ]
                  : d.exercicios.map((x, xi) =>
                      xi === swapTarget.exIdx ? { ...x, exercicio: newName } : x
                    ),
            }
          : d
      ),
    });
    setSwapTarget(null);
    setSwapQuery("");
  };

  const CAT_ORDER = ["peito", "costas", "ombro", "biceps", "triceps", "perna", "gluteo", "core", "panturrilha", "cardio"];
  const catLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

  /** Novo exercício salvo no picker: fecha, atualiza biblioteca e seleciona. */
  const onPickerExerciseSaved = (name: string) => {
    setCreatingEx(false);
    setLibTick((t) => t + 1);
    swapExercise(name);
  };

  /** Linha de exercício do picker (reuso na busca, nos equivalentes e nas categorias). */
  const exRow = (ex: { id: string; name: string; category: string }) => {
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
  };

  /** Linha do picker de MÚLTIPLA escolha (checkbox por exercício). */
  const pickRow = (ex: { id: string; name: string; category: string }) => {
    const on = pickSel.has(ex.id);
    return (
      <li key={ex.id}>
        <button
          type="button"
          onClick={() => togglePick(ex.id)}
          aria-pressed={on}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
            on ? "border-brand bg-brand/10" : "border-white/[0.06] bg-white/[0.02] hover:border-brand/30"
          )}
        >
          <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-brand-foreground" : "border-white/20")}>
            {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{ex.name}</span>
          <span className="shrink-0 text-[9.5px] capitalize text-muted-foreground">{ex.category}</span>
        </button>
      </li>
    );
  };

  /** Exercícios equivalentes (mesma categoria) ao que está sendo trocado. */
  const swapEquivalents = (() => {
    if (!swapTarget || swapTarget.exIdx === -1 || !plan) return [];
    const current = plan.dias[swapTarget.dayIdx]?.exercicios[swapTarget.exIdx]?.exercicio;
    if (!current) return [];
    const norm = (s: string) => s.toLowerCase().trim();
    const cat = dbExercises.find((e) => norm(e.name) === norm(current))?.category;
    if (!cat) return [];
    return dbExercises
      .filter((e) => e.category === cat && norm(e.name) !== norm(current) && e.name.toLowerCase() !== "registro livre")
      .slice(0, 6);
  })();

  /** Monta a frase estruturada a partir das respostas do assistente + observações livres. */
  const buildGuidedRequest = (obs: string): string => {
    const slots = split.split("").join(", ");
    const parts = [
      `Plano ${ansNivel} para ${target?.name ?? "o aluno"}.`,
      `Objetivo: ${objetivoLabel}.`,
      `Foco: ${focoLabel}.`,
      `Divisão ${split} em rotação (sem dia fixo): gere exatamente ${splitLen} ${splitLen === 1 ? "treino" : "treinos"} (slots ${slots}). Nomeie cada dia começando pela letra do slot, ex.: "A · Peito e Tríceps".`,
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
    // modo ajuste (v2) não depende das perguntas: o pedido + plano atual bastam
    const isAdjustMode = !!adjustSwId && !!plan;
    if (!guidedReady && !isAdjustMode) {
      toast.info("Responda as perguntas do assistente para gerar o plano.");
      return;
    }
    const obs = prompt.trim();
    const guidedRequest = buildGuidedRequest(obs);
    // modo ajuste: contexto "edit" usa o prompt dedicado que muda SÓ o pedido
    const isAdjust = adjustSwId && !!plan;
    const effectiveRequest = isAdjust
      ? `Pedido do personal: ${obs || "otimizar o plano"}.\nPlano atual em JSON (devolva COMPLETO, mudando somente o pedido):\n${JSON.stringify(plan)}`
      : guidedRequest;
    setLoading(true);
    setUsedFallback(false);
    setSavedOk(false);
    const seq = genSeq.current;
    const daysArr = [...daysSelected];
    const daysMeta = {
      nivel: ansNivel,
      objetivo: objetivoLabel,
      focus: focoSels.length ? [...new Set(focoSels.flatMap((f) => f.focus))] : ["Corpo inteiro"],
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
    // Timeout: a IA pode demorar, mas o stepper não pode girar para sempre.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch(apiPath("/api/assistente"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: buildWorkoutPrompt({
            studentName: target.name,
            goal: objetivoLabel,
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
          context: isAdjust ? "edit" : "personal",
          sex: ansSexo,
          extras: {
            ...(validExerciseNames.length > 0
              ? {
                  "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)":
                    validExerciseNames.join(" | "),
                }
              : {}),
            ...(isAdjust && plan
              ? { "Quantidade exata de dias do plano": String(plan.dias.length) }
              : {
                  // a divisão manda: ABCDE gera 5 dias (slots A..E)
                  "Quantidade exata de dias do plano": String(splitLen),
                }),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string; repaired?: boolean };
      // aluno trocou no meio da geração: descarta a resposta antiga
      if (seq !== genSeq.current) return;
      setLoading(false);
      if (data.ok && data.text) {
        let parsed = parsePlanFromLLM(data.text, fallback);
        // Valida e corrige nomes de exercícios contra o banco
        if (dbExercises.length > 0) {
          parsed = validateAndFixExercises(parsed, dbExercises);
        }
        if (data.repaired) {
          toast.info("Ajustei nomes para a biblioteca da academia.", {
            description: "Confira na revisão e troque o que precisar.",
          });
        }
        setPlan(parsed);
      } else {
        toast.error(data.error ?? "O Assistente está offline no momento. Tente novamente.");
        toast.info("Montei com o gerador local do app. Revise antes de enviar.");
        setUsedFallback(true);
        setPlan(fallback);
      }
      setActiveDay(0);
    } catch (e) {
      if (seq !== genSeq.current) return;
      setLoading(false);
      if (e instanceof Error && e.name === "AbortError") {
        toast.error("A IA demorou mais que o esperado.", {
          description: "Tente de novo, ou aproveite o plano que montei local.",
        });
      } else {
        toast.error("O Assistente está offline no momento. Tente novamente.");
      }
      setUsedFallback(true);
      setPlan(fallback);
      setActiveDay(0);
    } finally {
      clearTimeout(timer);
    }
  };

  // Repetir o mesmo programa para outros alunos (sem gerar de novo)
  const confirmRepeat = async () => {
    if (!repeatSheet || repeatSelected.size === 0 || !profile || repeatSaving) return;
    setRepeatSaving(true);
    try {
      const targets = [...repeatSelected]
        .map((sid) => students.find((s) => s.id === sid))
        .filter((s): s is PersonalStudent => !!s)
        .map((s) => ({ id: s.id, name: s.name }));
      const res = await assignExistingPlan({
        gymId: profile.gym_id,
        programId: repeatSheet.programId,
        targets,
      });
      if (res.failed.length > 0) {
        toast.error(res.ok > 0
          ? `Enviado para ${res.ok} aluno${res.ok === 1 ? "" : "s"}, mas falhou em ${res.failed.join(", ")}.`
          : `Falha ao enviar para ${res.failed.join(", ")}. Tente de novo.`);
      } else if (res.ok > 0) {
        toast.success("Plano repetido!", {
          description: `"${repeatSheet.planName}" enviado para ${res.ok} aluno${res.ok === 1 ? "" : "s"}.`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu repetir agora. Tente de novo.");
    } finally {
      setRepeatSaving(false);
      setRepeatSheet(null);
      setRepeatSelected(new Set());
      refresh();
    }
  };

  // Montar manualmente (sem IA): dias vazios da divisão para encher no picker.
  // Mesmo caminho de revisão e aprovação do plano gerado.
  const startManualPlan = (splitId: string) => {
    if (!target) return;
    const letters = splitId.split("");
    setPlan({
      nome: `Treino ${target.name.split(" ")[0]}`,
      frequencia: `${letters.length}x semana`,
      nivel: ansNivel ?? target.experience_level ?? "Intermediário",
      objetivo: objetivoLabel,
      observacao_geral: "",
      daysSelected: [...daysSelected],
      splitType: splitId,
      dias: letters.map((L) => ({
        nome: `${L} · Novo treino`,
        foco: "",
        aquecimento: [],
        exercicios: [],
        finalizador: "",
        slot: L,
      })),
      cardio: "",
    });
    setActiveDay(0);
    setEntry(null);
    setUsedFallback(false);
    toast.success("Monte os dias abaixo", {
      description: "Toque em Adicionar em cada dia e busque na biblioteca.",
    });
  };

  const updateDay = (dayIdx: number, patch: Partial<WorkoutPlan["dias"][number]>) => {
    if (!plan) return;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)),
    });
  };

  // Esqueleto guiado: a estrutura (grupos + quantos exercícios) vem das
  // respostas do assistente; o personal escolhe os exercícios por categoria.
  const startSkeletonPlan = () => {
    if (!target) return;
    const skeleton = buildSkeleton({
      split,
      level: ansNivel ?? target.experience_level ?? "Intermediário",
      objetivo: objetivoLabel,
      focoIds: ansFoco,
      studentName: target.name,
      sex: target.sex,
    });
    setPlan({
      nome: `Treino ${target.name.split(" ")[0]}`,
      frequencia: `${skeleton.length}x semana`,
      nivel: ansNivel ?? target.experience_level ?? "Intermediário",
      objetivo: objetivoLabel,
      observacao_geral: "Estrutura montada pelo esqueleto guiado. Exercícios escolhidos pelo personal.",
      daysSelected: [...daysSelected],
      splitType: split,
      modo: "esqueleto",
      dias: skeleton.map((d) => ({
        nome: d.nome,
        foco: d.foco,
        aquecimento: d.aquecimento,
        exercicios: [],
        finalizador: d.finalizador,
        slot: d.slot,
        alvo: d.alvo,
      })),
      cardio: /emagrec|condic/i.test(objetivoLabel) ? "Cardio 2-3x na semana" : "",
    });
    setActiveDay(0);
    setEntry(null);
    setUsedFallback(false);
    toast.success("Estrutura pronta", {
      description: "Toque em “Escolher exercícios” em cada dia e marque os que quiser.",
    });
  };

  // Copiar um plano já pronto da academia para o aluno atual (1 toque).
  const copyPlanToTarget = async (programId: string, planName: string, fromStudent: string) => {
    if (!target || !profile || copySaving) return;
    setCopySaving(true);
    try {
      const res = await assignExistingPlan({
        gymId: profile.gym_id,
        programId,
        targets: [{ id: target.id, name: target.name }],
      });
      if (res.ok === 0) throw new Error("Não deu copiar o plano.");
      toast.success("Plano copiado!", {
        description: `“${planName}” (de ${fromStudent}) foi para ${target.name.split(" ")[0]}.`,
      });
      setEntry(null);
      refresh();
      router.replace("/personal/treinos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu copiar agora. Tente de novo.");
    } finally {
      setCopySaving(false);
    }
  };

  const openPick = (dayIdx: number) => {
    setPickSheet({ dayIdx });
    setPickSel(new Set());
    setPickQuery("");
    setPickCatOpen(plan?.dias[dayIdx]?.alvo?.[0]?.categoria ?? null);
  };

  const togglePick = (name: string) =>
    setPickSel((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const addPickedToDay = () => {
    if (!plan || !pickSheet || pickSel.size === 0) return;
    const rx = defaultPrescription(plan.nivel, plan.objetivo);
    const novos = dbExercises
      .filter((e) => pickSel.has(e.id))
      .map((e) => ({
        exercicio: e.name,
        series: rx.series,
        reps: rx.reps,
        descanso: rx.descanso,
        rpe: rx.rpe,
        dica: "",
      }));
    if (novos.length === 0) return;
    const di = pickSheet.dayIdx;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, i) => (i === di ? { ...d, exercicios: [...d.exercicios, ...novos] } : d)),
    });
    toast.success(`${novos.length} exercício${novos.length === 1 ? "" : "s"} adicionado${novos.length === 1 ? "" : "s"}`, {
      description: plan.dias[di]?.nome,
    });
    setPickSheet(null);
    setPickSel(new Set());
  };

  // ===== PASSO 5: aprovar e atribuir (ou salvar edição / ajuste v2) =====
  const approve = async () => {
    if (approving) return;
    if (!plan || !target || !profile || !user) return;
    const emptyDays = plan.dias
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.exercicios.length === 0)
      .map(({ d, i }) => d.nome || `Dia ${i + 1}`);
    if (emptyDays.length > 0) {
      toast.error("Faltam exercícios", {
        description: `Complete antes de enviar: ${emptyDays.join(", ")}.`,
      });
      return;
    }
    const flat = plan.dias.flatMap((d) =>
      d.exercicios.map((e) => ({ name: e.exercicio, sets: e.series, reps: e.reps, rest: e.descanso }))
    );
    setApproving(true);
    try {
      if (editId && editId.startsWith("aw-") && !adjustSwId) {
        await updateAssignedWorkout(editId, {
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
        const newProgramId = await approvePlan({
          gymId: profile.gym_id,
          trainerId: user.id,
          student: target,
          plan: {
            ...plan,
            daysSelected: [...daysSelected],
            splitType: split,
            dias: plan.dias.map((d, i) => ({ ...d, slot: split[i] ?? String(i + 1) })),
          },
          notes: notes.trim() || null,
        });
        toast.success(adjustSwId ? "Plano ajustado com sucesso!" : editId ? "Plano atualizado com sucesso!" : "Plano enviado com sucesso!", {
          description: `${target.name} recebeu "${plan.nome}" com ${plan.dias.length} ${plan.dias.length === 1 ? "dia" : "dias"} de treino.`,
        });
        if (newProgramId) {
          setRepeatSheet({ programId: newProgramId, planName: plan.nome, excludeId: target.id });
          setRepeatSelected(new Set());
          setRepeatQuery("");
        }
        // edição/ajuste em produção: conclui o plano anterior (vira histórico)
        const prevId = adjustSwId ?? (editId && !editId.startsWith("aw-") ? editId : null);
        if (prevId) {
          try {
            await completeStudentWorkout(prevId);
          } catch {
            toast.error("O plano anterior não foi arquivado.", {
              description: "O novo plano já está salvo. Confira a lista de Atribuídos.",
            });
          }
        }
      }
      // salvo de verdade: entra no modo "já salvo" (WhatsApp só aqui em diante)
      setSavedOk(true);
      setEntry(null);
      setAdjustSwId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu salvar o plano. Tente novamente.");
    } finally {
      setApproving(false);
    }
  };

  // Depois de salvar: o personal avisa o aluno (se der) e só então volta.
  const finishSave = () => {
    setPlan(null);
    setPrompt("");
    setNotes("");
    setAdjustSwId(null);
    setEntry(null);
    setSavedOk(false);
    refresh();
    router.replace("/personal/treinos");
  };

  const applyMass = async () => {
    if (massSaving) return;
    if (!massTemplate || massSelected.size === 0 || !profile || !user) return;
    const targets = [...massSelected]
      .map((sid) => students.find((s) => s.id === sid))
      .filter((s): s is PersonalStudent => !!s);
    setMassSaving(true);
    try {
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
        setMassTemplate(null);
        setMassSelected(new Set());
        refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu aplicar agora. Tente de novo.");
    } finally {
      setMassSaving(false);
    }
  };

  // ===== MODO ATRIBUIÇÃO =====
  if (target) {
    const day = plan?.dias[Math.min(activeDay, (plan?.dias.length ?? 1) - 1)];
    // Link do WhatsApp só com número válido; sem link, vira aviso (nunca "#" clicável)
    const waHref =
      plan && target.whatsapp_consent
        ? waStudentLink(target.phone, buildPlanWhatsMessage({ studentName: target.name, plan }))
        : null;
    const waBlocked = !target.phone
      ? "Aluno sem telefone cadastrado."
      : !target.whatsapp_consent
        ? "Aluno sem consentimento de WhatsApp. Combine na recepção."
        : "Telefone do aluno não é um número válido de WhatsApp.";
    return (
      <div className="space-y-5">
        <TreinoGuide />
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
          {/* contexto do aluno na hora de gerar: sequência, último treino, RPE, meta */}
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1 font-bold text-[#FF9A5C]">
              <Flame className="h-3 w-3" aria-hidden /> {target.streak}d sequência
            </span>
            <span>{target.lastTrainingDaysAgo == null ? "sem treino registrado" : `último treino há ${target.lastTrainingDaysAgo}d`}</span>
            {target.lastRpe != null ? <span>último RPE {target.lastRpe}</span> : null}
            <span>meta {target.freq ?? splitLen}x/sem</span>
          </div>
          {/* biblioteca falhou: erro explícito com retry, nunca tela morta */}
          {libError && dbExercises.length === 0 && libReady ? (
            <div className="mb-3 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.07] p-3">
              <p className="text-[11.5px] font-bold text-[#F87171]">Biblioteca não carregou</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Sem ela não dá gerar nem trocar exercícios. Tente de novo.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLibReady(false);
                  setLibError(false);
                  setLibTick((t) => t + 1);
                }}
                className="tactile mt-2 w-full rounded-xl border border-brand/40 bg-brand/10 py-2 text-[11.5px] font-black text-brand"
              >
                Carregar biblioteca de novo
              </button>
            </div>
          ) : null}
          {/* Passo 1 (guiado): por onde começar. Cada botão abre UMA etapa. */}
          {!plan && !loading && !adjustSwId ? (
            <>
              {entry === null ? (
                <div className="mb-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setEntry("ia")}
                    className="tactile flex w-full items-center gap-3 rounded-2xl bg-brand p-3.5 text-left text-brand-foreground shadow-lg shadow-brand/25"
                  >
                    <Sparkles className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black">Montar treino com IA</span>
                      <span className="block text-[10.5px] opacity-90">a IA monta o plano completo a partir da ficha</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntry("manual")}
                    className="tactile flex w-full items-center gap-3 rounded-2xl border border-brand/40 bg-brand/[0.06] p-3.5 text-left text-brand"
                  >
                    <ListChecks className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black">Montar manualmente</span>
                      <span className="block text-[10.5px] opacity-80">você escolhe a divisão e marca os exercícios por categoria</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntry("copy")}
                    className="tactile flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-left text-foreground"
                  >
                    <History className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black">Usar treino de outro aluno</span>
                      <span className="block text-[10.5px] text-muted-foreground">copia um plano já pronto da academia</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEntry(null)}
                  className="tactile mb-2 flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                </button>
              )}

              {/* MODO IA */}
              {entry === "ia" && guidedReady ? (
                <>
                  <button
                    type="button"
                    onClick={run}
                    disabled={!libReady}
                    className="tactile mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[13.5px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {!libReady ? "Carregando biblioteca..." : "Gerar treino com dados da ficha"}
                  </button>
                  <p className="mb-3 text-center text-[10.5px] text-muted-foreground">
                    {ansNivel} · {objetivoLabel} · {focoLabel} · {split}, ou ajuste nas perguntas abaixo
                  </p>
                </>
              ) : null}

              {/* MODO MANUAL: divisão + estrutura sugerida (esqueleto) ou dias vazios */}
              {entry === "manual" ? (
                <div className="mb-3 space-y-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escolha a divisão</p>
                  <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Divisão do plano">
                    {SPLIT_OPTS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setAnsSplit(s.id)}
                        aria-pressed={split === s.id}
                        className={cn(
                          "tactile rounded-xl border py-2.5 text-[12px] font-black",
                          split === s.id ? "border-brand bg-brand text-brand-foreground" : "border-white/[0.08] bg-white/[0.03] text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9.5px] leading-snug text-muted-foreground">
                    Rotação {split.split("").join(" · ")}: o aluno faz na ordem, em qualquer dia.
                  </p>
                  <button
                    type="button"
                    onClick={startSkeletonPlan}
                    disabled={!libReady}
                    className="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-50"
                  >
                    <ListChecks className="h-4 w-4" />
                    Criar estrutura e escolher exercícios
                  </button>
                  <button
                    type="button"
                    onClick={() => startManualPlan(split)}
                    disabled={!libReady}
                    className="tactile w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[11.5px] font-bold text-muted-foreground transition-colors hover:text-brand"
                  >
                    Começar do zero (dias vazios)
                  </button>
                </div>
              ) : null}

              {/* MODO COPIAR: plano já pronto de outro aluno */}
              {entry === "copy" ? (
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={copyQuery}
                      onChange={(e) => setCopyQuery(e.target.value)}
                      placeholder="Buscar plano ou aluno..."
                      aria-label="Buscar plano para copiar"
                      className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    />
                  </div>
                  <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                    {assigned
                      .filter((a) => a.programId)
                      .filter((a) => !copyQuery.trim() || normBusca(a.name + " " + a.studentName).includes(normBusca(copyQuery)))
                      .map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => copyPlanToTarget(a.programId, a.name, a.studentName)}
                            disabled={copySaving}
                            className="tactile flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-brand/30 disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                              <History className="h-3.5 w-3.5 text-brand" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-bold text-foreground">{a.name}</span>
                              <span className="block text-[10px] text-muted-foreground">
                                de {a.studentName} · {a.days}d · {a.exercises} ex
                              </span>
                            </span>
                            {(() => {
                              const src = students.find((s) => s.id === a.studentId);
                              return (
                                <Avatar className="h-8 w-8 shrink-0 border border-white/[0.08]">
                                  <AvatarImage src={src?.avatar ?? undefined} alt="" />
                                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
                                    {((src?.name ?? a.studentName)[0] ?? "?").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })()}
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    {assigned.filter((a) => a.programId).length === 0 ? (
                      <li className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
                        Nenhum plano na academia ainda. Monte um com IA ou manualmente.
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
          {!plan && !loading ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setGenCreatingEx((v) => !v)}
                aria-expanded={genCreatingEx}
                className="tactile flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] py-2.5 text-[12px] font-black text-brand"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Novo exercício da academia
              </button>
              {genCreatingEx ? (
                <div className="mt-2">
                  <NewExerciseForm
                    onSaved={() => {
                      setGenCreatingEx(false);
                      setLibTick((t) => t + 1);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {adjustSwId && plan ? (
            <div className="mb-3 rounded-2xl border border-[#FFC24D]/25 bg-[#FFC24D]/[0.07] p-3">
              <p className="text-[11.5px] leading-snug text-foreground">
                Ajustando <strong>“{plan.nome}”</strong>. Descreva a mudança nas observações abaixo
                (ex.: trocar supino por crucifixo, subir volume de pernas) e gere. O aluno recebe a v2 e a anterior vira histórico.
              </p>
            </div>
          ) : null}

          {/* Perguntas guiadas (só no modo IA ou ajuste) */}
          {entry === "ia" || adjustSwId ? (
            <>
          {/* Sexo: define o cérebro da IA (ênfase feminina x masculina) */}
          <div className="mb-2.5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sexo (define a estratégia do treino)
            </p>
            <div className="flex gap-1.5" role="group" aria-label="Sexo do aluno">
              {[{ v: "F", l: "Mulher" }, { v: "M", l: "Homem" }].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setAnsSexo(o.v)}
                  aria-pressed={ansSexo === o.v}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[11.5px] font-bold transition-colors",
                    ansSexo === o.v
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-brand/40 hover:text-foreground"
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
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
              {askStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setAnsNivel(null)}
                  className="tactile mb-2 flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar ao nível
                </button>
              ) : null}
              <div className="mb-2.5 mt-1 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                Quais os objetivos? Toque em quantos quiser.
              </div>
              {askStep > 1 && ansObjetivo.length > 0 ? (
                <div className="mb-2.5 flex justify-end">
                  <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                    {objetivoLabel}
                  </span>
                </div>
              ) : null}
              {!objetivoDone ? (
                <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Objetivo do plano">
                  {OBJETIVO_OPTS.map((o) => {
                    const on = ansObjetivo.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggleObjetivo(o)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-[11.5px] font-bold transition-colors",
                          on
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-brand/40 hover:text-foreground"
                        )}
                      >
                        {o}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setObjetivoDone(true)}
                    disabled={ansObjetivo.length === 0}
                    className="tactile w-full rounded-xl border border-brand/40 bg-brand/10 py-2.5 text-[12px] font-bold text-brand transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-muted-foreground/60"
                  >
                    {ansObjetivo.length === 0
                      ? "Escolha ao menos um objetivo"
                      : `Confirmar objetivo (${ansObjetivo.length})`}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Pergunta 3: foco (pode marcar mais de um) */}
          {askStep >= 2 ? (
            <>
              {askStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setObjetivoDone(false)}
                  className="tactile mb-2 flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar aos objetivos
                </button>
              ) : null}
              <div className="mb-2.5 mt-1 max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                Qual o foco do plano? Toque em quantos quiser.
              </div>
              {askStep > 2 && focoSels.length ? (
                <div className="mb-2.5 flex justify-end">
                  <span className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[12px] font-bold text-brand-foreground">
                    {focoLabel}
                  </span>
                </div>
              ) : null}
              {!focoDone ? (
                <div className="mb-3 grid grid-cols-2 gap-1.5" role="group" aria-label="Foco do plano">
                  {FOCO_OPTS.map((f) => {
                    const on = ansFoco.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFoco(f.id)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-colors",
                          on
                            ? "border-brand bg-brand/10"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-brand/40"
                        )}
                      >
                        <p className={cn("text-[11.5px] font-bold", on ? "text-brand" : "text-foreground")}>
                          {f.label}
                        </p>
                        <p className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{f.sub}</p>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFocoDone(true)}
                    disabled={ansFoco.length === 0}
                    className="tactile col-span-2 rounded-xl border border-brand/40 bg-brand/10 py-2.5 text-[12px] font-bold text-brand transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-muted-foreground/60"
                  >
                    {ansFoco.length === 0
                      ? "Escolha ao menos um foco"
                      : `Confirmar foco (${ansFoco.length})`}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Pergunta 4: restrições */}
          {askStep >= 3 ? (
            <>
              {askStep === 3 ? (
                <button
                  type="button"
                  onClick={() => setFocoDone(false)}
                  className="tactile mb-2 flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar ao foco
                </button>
              ) : null}
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
              <button
                type="button"
                onClick={() => setRestDone(false)}
                className="tactile mb-2 flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground hover:text-brand"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar às restrições
              </button>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Resumo para gerar
              </p>
              <p className="text-[11.5px] leading-relaxed text-foreground">
                <strong>{ansNivel}</strong> · <strong>{objetivoLabel}</strong> · <strong>{focoLabel}</strong>
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
                  setAnsObjetivo([]);
                  setObjetivoDone(false);
                  setAnsFoco([]);
                  setFocoDone(false);
                  setAnsSplit(null);
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

          {/* divisão por slots (rotação sem dia fixo) */}
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Divisão do treino
            </p>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Divisão do treino">
              {SPLIT_OPTS.map((s) => {
                const on = split === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAnsSplit(s.id)}
                    aria-pressed={on}
                    title={s.sub}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-1.5 text-left transition-colors",
                      on ? "border-brand bg-brand/10" : "border-white/[0.08] bg-white/[0.04] hover:border-brand/40"
                    )}
                  >
                    <span className={cn("block text-[11px] font-black tracking-wide", on ? "text-brand" : "text-foreground")}>
                      {s.label}
                    </span>
                    <span className="block text-[8.5px] leading-tight text-muted-foreground">{s.sub}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[9.5px] leading-snug text-muted-foreground">
              Rotação {split.split("").join(" · ")}: o aluno faz na ordem, em qualquer dia.
            </p>
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
            <Button onClick={run} disabled={loading || (!guidedReady && !(adjustSwId && plan)) || !libReady} size="sm" className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {loading ? `Gerando... ${genElapsed}s` : !libReady ? "Carregando biblioteca..." : adjustSwId ? "Gerar ajuste (v2)" : "Gerar plano completo"}
            </Button>
          </div>
            </>
          ) : null}
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
              {savedOk ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#4ADE80]/30 bg-[#4ADE80]/[0.08] p-3">
                    <p className="flex items-center gap-2 text-[12.5px] font-black text-[#4ADE80]">
                      <ClipboardCheck className="h-4 w-4" /> Plano salvo com sucesso
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {target.name} recebeu “{plan.nome}” com {plan.dias.length} {plan.dias.length === 1 ? "dia" : "dias"} de treino.
                    </p>
                  </div>
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="tactile flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 text-[12.5px] font-black text-[#4ADE80]"
                    >
                      <MessageCircle className="h-4 w-4" /> Avisar aluno no WhatsApp
                    </a>
                  ) : (
                    <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center text-[10.5px] text-muted-foreground">
                      {waBlocked}
                    </p>
                  )}
                  <Button onClick={finishSave} size="lg" className="h-12 w-full rounded-2xl text-[13px] font-bold">
                    Concluir
                  </Button>
                </div>
              ) : (
                <>
              {discardAsk ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.07] p-3">
                  <p className="min-w-0 flex-1 text-[11.5px] font-semibold text-foreground">Descartar este treino e voltar?</p>
                  <button
                    type="button"
                    onClick={() => setDiscardAsk(false)}
                    className="tactile rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11.5px] font-bold text-muted-foreground"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlan(null);
                      setEntry(null);
                      setDiscardAsk(false);
                      router.replace("/personal/treinos");
                    }}
                    className="tactile rounded-xl bg-[#F87171] px-3 py-2 text-[11.5px] font-black text-white"
                  >
                    Descartar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDiscardAsk(true)}
                  className="tactile flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                </button>
              )}
              {usedFallback ? (
                <div className="rounded-2xl border border-[#FFC24D]/30 bg-[#FFC24D]/[0.07] p-3">
                  <p className="text-[11.5px] font-bold text-[#FFC24D]">IA indisponível, plano montado local</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Usei a biblioteca da academia para montar. Revise, ajuste e envie. Ou tente a IA de novo.
                  </p>
                  <button
                    type="button"
                    onClick={run}
                    disabled={loading}
                    className="tactile mt-2 w-full rounded-xl border border-brand/40 bg-brand/10 py-2 text-[11.5px] font-black text-brand disabled:opacity-50"
                  >
                    {loading ? `Tentando IA... ${genElapsed}s` : "Tentar IA de novo"}
                  </button>
                </div>
              ) : null}
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

              {/* tabs de dias + expandir tudo */}
              {plan.dias.length > 1 ? (
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Dias do plano">
                  {plan.dias.map((d, i) => (
                    <button
                      key={d.nome + i}
                      role="tab"
                      aria-selected={activeDay === i}
                      onClick={() => setActiveDay(i)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-2 text-[10.5px] font-bold transition-colors",
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

              {/* ver tudo de uma vez (revisão rápida sem trocar de aba) */}
              {plan.dias.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setExpandAll((v) => !v)}
                  aria-expanded={expandAll}
                  className="tactile w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-brand"
                >
                  {expandAll ? "Recolher dias" : `Expandir todos os dias (${plan.dias.length})`}
                </button>
              ) : null}
              {expandAll ? (
                <div className="space-y-2">
                  {plan.dias.map((dd, di) => (
                    <div key={`exp-${di}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDay(di);
                          setExpandAll(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="truncate text-[12px] font-black text-brand">{dd.nome}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {dd.exercicios.length} ex · editar
                        </span>
                      </button>
                      <ul className="mt-1.5 space-y-1">
                        {dd.exercicios.map((e, i) => (
                          <li key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">
                              {e.exercicio}
                              <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
                                {e.series}x{e.reps}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSwapTarget({ dayIdx: di, exIdx: i })}
                              aria-label={`Trocar ${e.exercicio}`}
                              className="tactile relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md before:absolute before:-inset-2 before:content-[''] text-muted-foreground hover:text-brand"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDay(di, { exercicios: dd.exercicios.filter((_, xi) => xi !== i) })
                              }
                              aria-label={`Remover ${e.exercicio}`}
                              className="tactile relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md before:absolute before:-inset-2 before:content-[''] text-muted-foreground hover:text-[#F87171]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          setSwapTarget({ dayIdx: di, exIdx: -1 });
                          setSwapQuery("");
                        }}
                        className="tactile mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand/40 py-1.5 text-[10.5px] font-bold text-brand"
                      >
                        <Plus className="h-3 w-3" /> Adicionar aqui
                      </button>
                    </div>
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

                {/* esqueleto guiado: alvos por categoria + progresso (editável) */}
                {plan.modo === "esqueleto" ? (() => {
                  const catOf = new Map(dbExercises.map((e) => [normBusca(e.name), e.category]));
                  const counts: Record<string, number> = {};
                  for (const e of day.exercicios) {
                    const c = catOf.get(normBusca(e.exercicio));
                    if (c) counts[c] = (counts[c] ?? 0) + 1;
                  }
                  const alvo = day.alvo ?? [];
                  const totalAlvo = alvo.reduce((a, x) => a + x.qtd, 0);
                  const totalHave = day.exercicios.length;
                  const missing = CAT_ORDER.filter((c) => c !== "cardio" && !alvo.some((a) => a.categoria === c));
                  const setAlvo = (next: { categoria: string; qtd: number }[]) => updateDay(activeDay, { alvo: next });
                  return (
                    <div className="rounded-2xl border border-brand/25 bg-brand/[0.05] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand">Estrutura do dia (editável)</p>
                        <span className={cn("text-[10px] font-bold tabular-nums", totalHave >= totalAlvo ? "text-[#4ADE80]" : "text-muted-foreground")}>
                          {totalHave}/{totalAlvo}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {alvo.map((a, ai) => {
                          const have = counts[a.categoria] ?? 0;
                          const ok = have >= a.qtd;
                          return (
                            <div key={a.categoria} className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate rounded-full border px-2 py-1 text-[10.5px] font-bold",
                                  ok ? "border-[#4ADE80]/40 bg-[#4ADE80]/10 text-[#4ADE80]" : "border-white/[0.08] bg-white/[0.04] text-muted-foreground"
                                )}
                              >
                                {catLabel(a.categoria)} <span className="tabular-nums">{have}/{a.qtd}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setAlvo(alvo.map((x, xi) => (xi === ai ? { ...x, qtd: Math.max(1, x.qtd - 1) } : x)))}
                                aria-label={`Menos ${a.categoria}`}
                                className="tactile flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] font-bold text-foreground"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                onClick={() => setAlvo(alvo.map((x, xi) => (xi === ai ? { ...x, qtd: Math.min(8, x.qtd + 1) } : x)))}
                                aria-label={`Mais ${a.categoria}`}
                                className="tactile flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] font-bold text-foreground"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => setAlvo(alvo.filter((_, xi) => xi !== ai))}
                                aria-label={`Remover ${a.categoria}`}
                                className="tactile flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-[#F87171]"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {missing.length ? (
                        <div className="mt-2">
                          <p className="mb-1 text-[9.5px] font-semibold text-muted-foreground">Adicionar grupo:</p>
                          <div className="flex flex-wrap gap-1">
                            {missing.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setAlvo([...alvo, { categoria: c, qtd: 1 }])}
                                className="tactile rounded-full border border-dashed border-brand/40 px-2 py-0.5 text-[9.5px] font-bold text-brand"
                              >
                                + {catLabel(c)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openPick(activeDay)}
                        className="tactile mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[12px] font-black text-brand-foreground"
                      >
                        <ListChecks className="h-3.5 w-3.5" /> Escolher exercícios por categoria
                      </button>
                    </div>
                  );
                })() : null}

                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Use as setas para reordenar · troque ou edite direto no card
                </p>

                <div className="space-y-2">
                  {day.exercicios.map((e, i) => (
                    <div
                      key={`${activeDay}-${e.exercicio}-${i}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5"
                    >
                      {/* linha 1: setas de ordem + nome inteiro, sem corte */}
                      <div className="flex items-start gap-1.5">
                        <div className="flex shrink-0 flex-col">
                          <button
                            onClick={() => {
                              if (i === 0) return;
                              const next = [...day.exercicios];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              updateDay(activeDay, { exercicios: next });
                            }}
                            disabled={i === 0}
                            aria-label={`Subir ${e.exercicio} na ordem`}
                            className="tactile flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-brand disabled:opacity-25"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (i === day.exercicios.length - 1) return;
                              const next = [...day.exercicios];
                              [next[i + 1], next[i]] = [next[i], next[i + 1]];
                              updateDay(activeDay, { exercicios: next });
                            }}
                            disabled={i === day.exercicios.length - 1}
                            aria-label={`Descer ${e.exercicio} na ordem`}
                            className="tactile flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-brand disabled:opacity-25"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="min-w-0 flex-1 break-words text-[12.5px] font-semibold leading-snug text-foreground">
                          {i + 1}. {e.exercicio}
                        </p>
                        <button
                          onClick={() => {
                            setSwapTarget({ dayIdx: activeDay, exIdx: i });
                            setSwapQuery("");
                          }}
                          aria-label={`Trocar ${e.exercicio} por outro exercício`}
                          className="tactile relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg before:absolute before:-inset-2 before:content-[''] text-muted-foreground transition-colors hover:text-brand"
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
                          className="tactile relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg before:absolute before:-inset-2 before:content-[''] text-muted-foreground transition-colors hover:text-[#F87171]"
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
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSwapTarget({ dayIdx: activeDay, exIdx: -1 });
                    setSwapQuery("");
                  }}
                  className="tactile flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] py-2.5 text-[11.5px] font-bold text-brand transition-colors hover:bg-brand/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar exercício avulso
                </button>

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

              <Button
                onClick={approve}
                disabled={approving}
                size="lg"
                className="h-12 w-full rounded-2xl text-[13px] font-bold"
              >
                {approving ? (
                  <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                ) : (
                  <ClipboardCheck className="mr-2 h-4.5 w-4.5" />
                )}
                {approving ? "Atribuindo..." : editId ? "Salvar Alterações" : "Aprovar e Atribuir"}
              </Button>
                </>
              )}
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* Repetir plano para outros alunos (mesmo programa, sem gerar de novo) */}
        <BottomSheet
          open={!!repeatSheet}
          onClose={() => {
            setRepeatSheet(null);
            setRepeatSelected(new Set());
          }}
        >
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">Repetir plano</p>
              <p className="text-[11px] text-muted-foreground">
                {repeatSheet ? `“${repeatSheet.planName}” vai igualzinho para quem você marcar. Cada um recebe o sino.` : ""}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={repeatQuery}
                onChange={(e) => setRepeatQuery(e.target.value)}
                placeholder="Buscar aluno..."
                aria-label="Buscar aluno para repetir o plano"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
            </div>
            <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
              {students
                .filter((s) => s.id !== repeatSheet?.excludeId)
                .filter((s) => !repeatQuery.trim() || normBusca(s.name).includes(normBusca(repeatQuery)))
                .map((s) => {
                  const on = repeatSelected.has(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setRepeatSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          })
                        }
                        aria-pressed={on}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors",
                          on ? "border-brand bg-brand/10" : "border-white/[0.06] bg-white/[0.03]"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={s.avatar ?? undefined} alt="" />
                          <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground">
                            {(s.name[0] ?? "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", on ? "text-brand" : "text-foreground")}>
                          {s.name}
                        </span>
                        {on ? <Check className="h-4 w-4 shrink-0 text-brand" /> : null}
                      </button>
                    </li>
                  );
                })}
              {students.filter((s) => s.id !== repeatSheet?.excludeId).length === 0 ? (
                <li className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
                  Sem outros alunos para repetir.
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={confirmRepeat}
              disabled={repeatSelected.size === 0 || repeatSaving}
              className="tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground disabled:opacity-40"
            >
              {repeatSaving ? (
                "Enviando..."
              ) : (
                <>Repetir para {repeatSelected.size} aluno{repeatSelected.size === 1 ? "" : "s"}</>
              )}
            </button>
          </div>
        </BottomSheet>
        {/* Trocar ou adicionar exercício: picker da biblioteca */}
        <BottomSheet open={!!swapTarget} onClose={() => setSwapTarget(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">
                {swapTarget?.exIdx === -1 ? "Adicionar exercício" : "Trocar exercício"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {swapTarget?.exIdx === -1
                  ? "Exercício avulso no dia, com 3x10-12 padrão. Ajuste séries e reps depois."
                  : swapTarget && plan
                    ? `Substituindo "${plan.dias[swapTarget.dayIdx]?.exercicios[swapTarget.exIdx]?.exercicio}". Mantém séries, reps e RPE.`
                    : "Escolha um exercício da biblioteca."}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={swapQuery}
                onChange={(e) => setSwapQuery(e.target.value)}
                placeholder="Buscar exercício..."
                aria-label="Buscar exercício na biblioteca"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreatingEx((v) => !v)}
              aria-expanded={creatingEx}
              className="tactile flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] py-2.5 text-[12px] font-black text-brand"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Criar exercício do zero
            </button>
            {creatingEx ? (
              <NewExerciseForm onSaved={onPickerExerciseSaved} />
            ) : null}
            {swapEquivalents.length > 0 && !swapQuery.trim() ? (
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Equivalentes (mesmo grupo muscular)
                </p>
                <ul className="space-y-1.5">
                  {swapEquivalents.map((ex) => exRow(ex))}
                </ul>
              </div>
            ) : null}
            {swapQuery.trim() ? (
              <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto">
                {swapList.length === 0 ? (
                  <li className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-[12px] text-muted-foreground">
                    Nenhum exercício encontrado para essa busca.
                  </li>
                ) : (
                  swapList.slice(0, 80).map((ex) => exRow(ex))
                )}
              </ul>
            ) : (
              <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
                {CAT_ORDER.map((cat) => {
                  const items = swapList.filter((e) => e.category === cat);
                  if (items.length === 0) return null;
                  const open = catOpen === cat;
                  return (
                    <div key={cat} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setCatOpen(open ? null : cat)}
                        aria-expanded={open}
                        className="tactile flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                      >
                        <span className="text-[12px] font-black text-foreground">{catLabel(cat)}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                          {items.length}
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                        </span>
                      </button>
                      {open ? (
                        <ul className="space-y-1.5 px-2 pb-2">
                          {items.map((ex) => exRow(ex))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </BottomSheet>

        {/* Picker de múltipla escolha por categoria (modo esqueleto guiado) */}
        <BottomSheet
          open={!!pickSheet}
          onClose={() => {
            setPickSheet(null);
            setPickSel(new Set());
          }}
        >
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">Escolher exercícios</p>
              <p className="text-[11px] text-muted-foreground">
                {pickSheet ? `${plan?.dias[pickSheet.dayIdx]?.nome ?? ""} · marque quantos quiser por categoria.` : ""}
              </p>
            </div>
            {pickSheet && (plan?.dias[pickSheet.dayIdx]?.alvo?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {plan?.dias[pickSheet.dayIdx]?.alvo?.map((a) => (
                  <span key={a.categoria} className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[9.5px] font-bold text-brand">
                    {catLabel(a.categoria)} · alvo {a.qtd}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Buscar exercício..."
                aria-label="Buscar exercício na biblioteca"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
            </div>
            {(() => {
              const targetCats = pickSheet ? plan?.dias[pickSheet.dayIdx]?.alvo?.map((a) => a.categoria) ?? [] : [];
              const catsOrdered = [...targetCats, ...CAT_ORDER.filter((c) => !targetCats.includes(c))];
              const q = normBusca(pickQuery);
              const list = dbExercises
                .filter((e) => e.name.toLowerCase() !== "registro livre")
                .filter(
                  (e) =>
                    !q ||
                    normBusca(e.name).includes(q) ||
                    normBusca(e.category).includes(q) ||
                    (e.muscles ?? []).some((m) => normBusca(m).includes(q)) ||
                    (e.aliases ?? []).some((a) => normBusca(a).includes(q))
                )
                .sort((a, b) => a.name.localeCompare(b.name));
              const searching = !!pickQuery.trim();
              return (
                <div className="max-h-[52vh] space-y-1.5 overflow-y-auto">
                  {searching ? (
                    <ul className="space-y-1.5">
                      {list.length === 0 ? (
                        <li className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-[12px] text-muted-foreground">
                          Nenhum exercício encontrado para essa busca.
                        </li>
                      ) : (
                        list.slice(0, 100).map((ex) => pickRow(ex))
                      )}
                    </ul>
                  ) : (
                    catsOrdered.map((cat) => {
                      const items = list.filter((e) => e.category === cat);
                      if (items.length === 0) return null;
                      const open = pickCatOpen === cat;
                      const isTarget = targetCats.includes(cat);
                      const qtdSel = items.filter((e) => pickSel.has(e.id)).length;
                      return (
                        <div
                          key={cat}
                          className={cn(
                            "overflow-hidden rounded-2xl border",
                            isTarget ? "border-brand/25 bg-brand/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPickCatOpen(open ? null : cat)}
                            aria-expanded={open}
                            className="tactile flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                          >
                            <span className="text-[12px] font-black text-foreground">
                              {catLabel(cat)}
                              {isTarget ? <span className="ml-1.5 text-[9px] font-bold uppercase text-brand">alvo</span> : null}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                              {qtdSel > 0 ? <span className="text-brand">{qtdSel}/</span> : null}
                              {items.length}
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                            </span>
                          </button>
                          {open ? <ul className="space-y-1 px-2 pb-2">{items.map((ex) => pickRow(ex))}</ul> : null}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
            <button
              type="button"
              onClick={addPickedToDay}
              disabled={pickSel.size === 0}
              className="tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground disabled:opacity-40"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              {pickSel.size > 0 ? `Adicionar ${pickSel.size} ao treino` : "Marque os exercícios"}
            </button>
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
          {assignedTotal > assigned.length
            ? `${assigned.length} de ${assignedTotal} planos atribuídos`
            : `${assigned.length} plano${assigned.length === 1 ? "" : "s"} atribuído${assigned.length === 1 ? "" : "s"}`}
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

      <button
        onClick={() => router.push("/personal/exercicios")}
        className="gf-card gf-glass flex w-full items-center gap-3 !rounded-2xl !p-4 text-left transition-transform active:scale-[0.985]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
          <Library className="h-5 w-5 text-brand" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Biblioteca de Exercícios</p>
          <p className="text-[11px] text-muted-foreground">
            Ver todos por categoria e criar novos
          </p>
        </div>
        <ChevronRight className="h-4.5 w-4.5 text-brand" />
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
          ) : templates.length === 0 ? (
            <div className="w-full shrink-0 rounded-2xl border border-dashed border-white/[0.1] p-4 text-center">
              <p className="text-[12px] font-semibold text-foreground">Sem modelos ainda</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Gere o primeiro plano acima e ele vira modelo para aplicar em massa.
              </p>
            </div>
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
                {w.programId ? (
                  <button
                    onClick={() => {
                      setRepeatSheet({ programId: w.programId, planName: w.name, excludeId: w.studentId });
                      setRepeatSelected(new Set());
                      setRepeatQuery("");
                    }}
                    aria-label={`Repetir ${w.name} para outros alunos`}
                    title="Repetir para outros alunos"
                    className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  onClick={async () => {
                    if (!window.confirm(`Remover "${w.name}" de ${w.studentName}? O aluno perde o acesso ao treino.`)) return;
                    // Otimista: some da lista na hora
                    setAssigned((prev) => prev.filter((a) => a.id !== w.id));
                    try {
                      if (w.id.startsWith("aw-")) {
                        await deleteAssignedWorkout(w.id);
                      } else {
                        await completeStudentWorkout(w.id);
                      }
                      toast.success("Treino removido");
                    } catch {
                      toast.error("Não deu remover agora. Tente de novo.");
                    }
                    refresh();
                  }}
                  aria-label={`Remover ${w.name}`}
                  className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-[#F87171]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {assignedTotal > assigned.length ? (
              <button
                type="button"
                onClick={loadMorePlans}
                disabled={assignedLoadingMore}
                className="tactile h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] text-[12px] font-bold text-foreground transition-colors hover:text-brand disabled:opacity-50"
              >
                {assignedLoadingMore ? "Carregando..." : `Carregar mais (restam ${assignedTotal - assigned.length})`}
              </button>
            ) : null}
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
              .filter((s) => normBusca(s.name).includes(normBusca(pickerQuery)))
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
          {students.filter((s) => normBusca(s.name).includes(normBusca(pickerQuery))).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
              {students.length === 0
                ? "Nenhum aluno na academia ainda."
                : "Nenhum aluno com esse nome. Ajuste a busca."}
            </p>
          ) : null}
        </div>
      </BottomSheet>

      {/* aplicar em massa */}
      <BottomSheet open={!!massTemplate} onClose={() => { if (!massSaving) setMassTemplate(null); }}>
        {massTemplate ? (
          <div className="space-y-4">
            <div>
              <p className="text-base font-bold text-foreground">{massTemplate.name}</p>
              <p className="text-[11px] text-muted-foreground">
                Selecione os alunos que vão receber este plano
              </p>
            </div>
            <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
              {students.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
                  Nenhum aluno na academia ainda.
                </li>
              ) : null}
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
              disabled={massSelected.size === 0 || massSaving}
              onClick={applyMass}
            >
              {massSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                `Aplicar para ${massSelected.size} ${massSelected.size === 1 ? "aluno" : "alunos"}`
              )}
            </Button>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
