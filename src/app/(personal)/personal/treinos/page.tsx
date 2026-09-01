"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { generate, isAiConfigured } from "~/lib/ai/omniroute";
import { buildWorkoutPrompt, WORKOUT_PLAN_SYSTEM } from "~/lib/ai/prompts";
import {
  generatePlanOffline,
  parsePlanFromLLM,
  type WorkoutPlan,
} from "~/lib/ai/local-gen";
import { demoLib } from "~/lib/demo-bridge";
import {
  demoPersonalStudents,
  demoTemplates,
  type WorkoutTemplate,
} from "~/lib/personal-data";
import {
  deleteAssignedWorkout,
  listAssignedWorkouts,
  saveAssignedWorkout,
  updateAssignedWorkout,
} from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

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
 * Motor de treino do Personal (operador): seleção de aluno, prompt com
 * contexto completo, plano multi-dias da IA (LLM via OmniRoute quando
 * configurado; motor offline de bolso quando não) e revisão editável
 * com drag antes de atribuir.
 */
export default function PersonalTreinosPage() {
  const router = useRouter();
  const params = useSearchParams();
  const students = useMemo(() => demoPersonalStudents(), []);
  const templates = useMemo(() => demoTemplates(), []);
  const aiReady = isAiConfigured();

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
  const [assigned, setAssigned] = useState<Awaited<ReturnType<typeof listAssignedWorkouts>>>([]);
  const [massTemplate, setMassTemplate] = useState<WorkoutTemplate | null>(null);
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  const refresh = () => setAssigned(listAssignedWorkouts());
  useEffect(refresh, []);

  // modo edição: carrega o plano (ou sintetiza 1 dia de treinos antigos)
  useEffect(() => {
    if (!editId) return;
    const w = listAssignedWorkouts().find((x) => x.id === editId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const equipmentSample = useMemo(
    () => demoLib.flatMap((c) => c.name).slice(0, 10),
    []
  );

  const run = async () => {
    if (!prompt.trim() || loading || !target) return;
    setLoading(true);
    const fallback = generatePlanOffline(prompt.trim(), target.name);
    if (!aiReady) {
      await new Promise((r) => setTimeout(r, 800));
      setPlan(fallback);
      setNotes("");
      setActiveDay(0);
      setLoading(false);
      return;
    }
    const out = await generate({
      purpose: "generate_workout",
      system: WORKOUT_PLAN_SYSTEM,
      prompt: buildWorkoutPrompt({
        studentName: target.name,
        goal: target.activeWorkout,
        level: fallback.nivel,
        frequency: fallback.frequencia,
        restrictions: fallback.observacao_geral,
        equipment: equipmentSample,
        request: prompt.trim(),
      }),
    });
    setLoading(false);
    setPlan(out.ok ? parsePlanFromLLM(out.text, fallback) : fallback);
    setActiveDay(0);
    setNotes("");
    if (!out.ok) toast.info("Gateway indisponível, usei o motor local do app");
  };

  const updateDay = (dayIdx: number, patch: Partial<WorkoutPlan["dias"][number]>) => {
    if (!plan) return;
    setPlan({
      ...plan,
      dias: plan.dias.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)),
    });
  };

  // ===== PASSO 5: aprovar e atribuir (ou salvar edição) =====
  const approve = async () => {
    if (!plan || !target) return;
    const flat = plan.dias.flatMap((d) =>
      d.exercicios.map((e) => ({ name: e.exercicio, sets: e.series, reps: e.reps, rest: e.descanso }))
    );
    if (editId) {
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
      saveAssignedWorkout({
        studentId: target.id,
        studentName: target.name,
        name: plan.nome,
        notes: notes.trim() || null,
        frequency: plan.frequencia,
        level: plan.nivel,
        exercises: flat,
        plan,
        source: "ia",
      });
      toast.success("Plano enviado com sucesso!", {
        description: `${target.name} recebeu "${plan.nome}" com ${plan.dias.length} ${plan.dias.length === 1 ? "dia" : "dias"} de treino.`,
      });
    }
    setPlan(null);
    setPrompt("");
    setNotes("");
    refresh();
    router.replace("/personal/treinos");
  };

  const applyMass = () => {
    if (!massTemplate || massSelected.size === 0) return;
    for (const sid of massSelected) {
      const student = students.find((s) => s.id === sid);
      if (!student) continue;
      const p = templateToPlan(massTemplate);
      saveAssignedWorkout({
        studentId: student.id,
        studentName: student.name,
        name: p.nome,
        notes: null,
        frequency: p.frequencia,
        level: p.nivel,
        exercises: p.dias[0].exercicios.map((e) => ({
          name: e.exercicio,
          sets: e.series,
          reps: e.reps,
          rest: e.descanso,
        })),
        plan: p,
        source: "template",
      });
    }
    toast.success("Plano enviado com sucesso!", {
      description: `Template aplicado para ${massSelected.size} alunos.`,
    });
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
            <AvatarImage src={target.avatar} alt="" />
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

        {/* Passo 3: prompt */}
        <section className="gf-card gf-glass !p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
            </span>
            <p className="text-[13px] font-semibold text-foreground">
              {aiReady ? "IA real (OmniRoute)" : "Motor local de bolso"} · plano completo e periodizado
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            rows={3}
            placeholder={`Ex.: Plano de glúteos para ${target.name.split(" ")[0]}, 4x semana, intermediária, sem impacto no joelho`}
            aria-label="Pedido de plano para a IA"
            className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-[9.5px] text-muted-foreground">
              A IA recebe objetivo, nível, frequência, restrições e aparelhos.
            </p>
            <Button onClick={run} disabled={!prompt.trim() || loading} size="sm" className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Gerar plano completo
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
                  Arraste para reordenar · edite séries e reps direto no card
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
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-foreground">
                            {i + 1}. {e.exercicio}
                          </p>
                          <p className="text-[9.5px] text-muted-foreground">RPE {e.rpe} · {e.dica}</p>
                        </div>
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
                          className="h-8 w-11 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[11px] tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                        />
                        <span className="text-[10px] text-muted-foreground">x</span>
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
                          className="h-8 w-14 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                        />
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
                    className="tactile w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-brand"
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
      </div>
    );
  }

  // ===== VISÃO GERAL =====
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-bold text-foreground">Treinos</h1>
        <p className="text-[11px] text-muted-foreground">
          {aiReady ? "IA real (OmniRoute)" : "Motor local de bolso"} · {assigned.length} atribuídos
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
            Selecionar aluno e gerar plano completo com IA
          </p>
        </div>
        <UserRoundPlus className="h-4.5 w-4.5 text-brand" />
      </button>

      <section aria-labelledby="tpl-title">
        <h2 id="tpl-title" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4 text-brand" />
          Templates prontos
        </h2>
        <div className="no-scrollbar snap-x snap-mandatory flex gap-3 overflow-x-auto pb-2">
          {templates.map((t) => (
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
          ))}
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
                  <AvatarImage src={students.find((s) => s.id === w.studentId)?.avatar} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
                    {w.studentName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {w.studentName.split(" ")[0]} ·{" "}
                    {w.plan ? `${w.plan.dias.length} dia${w.plan.dias.length === 1 ? "" : "s"} · ` : ""}
                    {w.exercises.length} exercícios · {fmtDate(w.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/personal/treinos?aluno=${w.studentId}&edit=${w.id}`)}
                  aria-label={`Editar ${w.name}`}
                  className="tactile flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    deleteAssignedWorkout(w.id);
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
                      <AvatarImage src={s.avatar} alt="" />
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
                Selecione os alunos que vão receber este template
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
                        <AvatarImage src={s.avatar} alt="" />
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
