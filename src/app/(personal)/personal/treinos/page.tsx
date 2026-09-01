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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/hooks/useAuth";
import { generate, isAiConfigured } from "~/lib/ai/omniroute";
import { demoLib } from "~/lib/demo-bridge";
import {
  demoPersonalStudents,
  demoTemplates,
  type PersonalStudent,
  type WorkoutTemplate,
} from "~/lib/personal-data";
import {
  deleteAssignedWorkout,
  listAssignedWorkouts,
  saveAssignedWorkout,
  updateAssignedWorkout,
  type AssignedExercise,
} from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const FLAT_LIB = () =>
  demoLib.flatMap((c) =>
    c.subs.flatMap((sub) => sub.exercises.map((e) => ({ ...e, group: c.name })))
  );

type Draft = {
  name: string;
  frequency: string;
  level: string;
  exercises: AssignedExercise[];
  source: "ia" | "template" | "manual";
};

/** Gerador local determinístico (demo, sem chave de IA): interpreta o pedido. */
function localDraft(prompt: string): Draft {
  const p = prompt.toLowerCase();
  const all = FLAT_LIB();
  const score = (e: { name: string; group: string }) => {
    let s = 0;
    if (/gl[úu]teo/.test(p) && /gl[úu]teo|quadril|pélvica|abdutor|stiff|coice/i.test(e.name + e.group)) s += 3;
    if (/perna|inferior/.test(p) && /perna/i.test(e.group)) s += 2;
    if (/peito/.test(p) && /peito/i.test(e.group)) s += 2;
    if (/costa|dorsal/.test(p) && /costa/i.test(e.group)) s += 2;
    if (/ombro/.test(p) && /ombro/i.test(e.group)) s += 2;
    if (/bra[çc]o|bíceps|tr[íi]ceps/.test(p) && /bra[çc]o|b[íi]ceps|tr[íi]ceps|antebra/i.test(e.group + e.name)) s += 2;
    if (/abd|core/.test(p) && /abd/i.test(e.group + e.name)) s += 2;
    if (/sem impacto|baixo impacto|articula/.test(p) && /polia|m[áa]quina|p[ée]lvica|abdutor/i.test(e.name)) s += 1;
    return s;
  };
  const picked = [...all]
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.e);

  const beginner = /iniciante|leve|come[çc]ando/.test(p);
  const freq = p.match(/(\d)\s?x/) ?? null;
  const fallback = [
    { name: "Elevação Pélvica", sets: 4, reps: "10-12", rest: "90s" },
    { name: "Puxada Alta", sets: 3, reps: "12", rest: "60s" },
    { name: "Supino Reto", sets: 3, reps: "10", rest: "60s" },
    { name: "Leg Press 45°", sets: 4, reps: "12", rest: "75s" },
    { name: "Prancha", sets: 3, reps: "30s", rest: "30s" },
  ];
  const exercises: AssignedExercise[] =
    picked.length >= 4
      ? picked.map((e, i) => ({
          name: e.name,
          sets: beginner ? 3 : 4,
          reps: beginner ? "12" : i % 2 === 0 ? "8-10" : "12",
          rest: beginner ? "60s" : "90s",
        }))
      : fallback;

  return {
    name: /gl[úu]teo/.test(p)
      ? "Glúteos Foco"
      : /perna/.test(p)
        ? "Pernas Completo"
        : /peito/.test(p)
          ? "Peito & Tríceps"
          : /costa/.test(p)
            ? "Costas & Bíceps"
            : "Treino Personalizado",
    frequency: freq ? `${freq[1]}x semana` : "3x semana",
    level: beginner ? "Iniciante" : "Intermediário",
    exercises,
    source: "ia",
  };
}

function parseAiDraft(text: string, fallback: Draft): Draft {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const raw = JSON.parse(match[0]) as {
      nome?: string;
      frequencia?: string;
      nivel?: string;
      exercicios?: Array<{ exercicio?: string; nome?: string; series?: number; reps?: string; repeticoes?: string; descanso?: string }>;
    };
    const exercises = (raw.exercicios ?? [])
      .map((e) => ({
        name: e.exercicio ?? e.nome ?? "",
        sets: Number(e.series ?? 3),
        reps: e.reps ?? e.repeticoes ?? "12",
        rest: e.descanso ?? "60s",
      }))
      .filter((e) => e.name);
    if (exercises.length < 3) return fallback;
    return {
      name: raw.nome ?? fallback.name,
      frequency: raw.frequencia ?? fallback.frequency,
      level: raw.nivel ?? fallback.level,
      exercises,
      source: "ia",
    };
  } catch {
    return fallback;
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/**
 * Motor de treino do Personal (operador): fluxo completo
 * selecionar aluno → prompt IA → rascunho editável com drag → aprovar e atribuir.
 */
export default function PersonalTreinosPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useAuth();
  const students = useMemo(() => demoPersonalStudents(), []);
  const templates = useMemo(() => demoTemplates(), []);
  const aiReady = isAiConfigured();

  // aluno-alvo: via query (?aluno=) ou modal de seleção
  const targetId = params.get("aluno") ?? "";
  const editId = params.get("edit") ?? "";
  const target = students.find((s) => s.id === targetId) ?? null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notes, setNotes] = useState("");
  const [assigned, setAssigned] = useState<Awaited<ReturnType<typeof listAssignedWorkouts>>>([]);
  const [massTemplate, setMassTemplate] = useState<WorkoutTemplate | null>(null);
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  const refresh = () => setAssigned(listAssignedWorkouts());
  useEffect(refresh, []);

  // modo edição: carrega o treino no rascunho
  useEffect(() => {
    if (!editId) return;
    const w = listAssignedWorkouts().find((x) => x.id === editId);
    if (w) {
      setDraft({ name: w.name, frequency: w.frequency, level: w.level, exercises: w.exercises, source: w.source });
      setNotes(w.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const run = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    const fallback = localDraft(prompt.trim());
    if (!aiReady) {
      await new Promise((r) => setTimeout(r, 750));
      setDraft(fallback);
      setNotes("");
      setLoading(false);
      return;
    }
    const out = await generate({
      purpose: "generate_workout",
      system:
        'Você é um personal trainer brasileiro. Responda APENAS JSON no formato {"nome": string, "frequencia": string, "nivel": string, "exercicios": [{"exercicio": string, "series": number, "reps": string, "descanso": string}]}.',
      prompt: prompt.trim(),
    });
    setLoading(false);
    setDraft(out.ok ? parseAiDraft(out.text, fallback) : fallback);
    setNotes("");
    if (!out.ok) toast.info("IA indisponível, usei o gerador local do app");
  };

  // ===== PASSO 5: aprovar e atribuir (ou salvar edição) =====
  const approve = async () => {
    if (!draft || !target) return;
    if (editId) {
      updateAssignedWorkout(editId, {
        name: draft.name,
        notes: notes.trim() || null,
        frequency: draft.frequency,
        level: draft.level,
        exercises: draft.exercises,
      });
      toast.success("Treino atualizado com sucesso!", {
        description: `${target.name} recebeu a nova versão na aba Treino.`,
      });
    } else {
      saveAssignedWorkout({
        studentId: target.id,
        studentName: target.name,
        name: draft.name,
        notes: notes.trim() || null,
        frequency: draft.frequency,
        level: draft.level,
        exercises: draft.exercises,
        source: draft.source,
      });
      toast.success("Treino enviado com sucesso!", {
        description: `${target.name} recebeu "${draft.name}" na aba Treino.`,
      });
    }
    setDraft(null);
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
      saveAssignedWorkout({
        studentId: student.id,
        studentName: student.name,
        name: massTemplate.name,
        notes: null,
        frequency: `${massTemplate.days}x semana`,
        level: massTemplate.level,
        exercises: massTemplate.exercises,
        source: "template",
      });
    }
    toast.success("Treino enviado com sucesso!", {
      description: `Template aplicado para ${massSelected.size} alunos.`,
    });
    setMassTemplate(null);
    setMassSelected(new Set());
    refresh();
  };

  // ===== MODO ATRIBUIÇÃO: aluno fixo no topo =====
  if (target) {
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
              {editId ? "Editando treino de" : "Montando treino para:"}
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

        {/* Passo 3: prompt para a IA */}
        <section className="gf-card gf-glass !p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
            </span>
            <p className="text-[13px] font-semibold text-foreground">
              O que esse aluno precisa hoje?
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
            placeholder={`Ex.: Treino de glúteos para ${target.name.split(" ")[0]}, 3x semana, sem impacto`}
            aria-label="Pedido de treino para a IA"
            className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
          <div className="mt-2.5 flex justify-end">
            <Button onClick={run} disabled={!prompt.trim() || loading} size="sm" className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Gerar rascunho
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
                Montando o rascunho para {target.name.split(" ")[0]}...
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

        {/* Passo 4: rascunho editável com drag */}
        <AnimatePresence mode="wait">
          {draft ? (
            <motion.section
              key={draft.name + draft.exercises.length}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="gf-card gf-glass space-y-3 !p-4"
              aria-label="Rascunho de treino editável"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                  <Sparkles className="h-4 w-4 text-brand" />
                </span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  aria-label="Nome do treino"
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-sm font-bold text-foreground hover:border-white/[0.08] focus-visible:border-brand/40 focus-visible:outline-none"
                />
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                  {draft.frequency}
                </span>
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Arraste para reordenar · toque para editar séries e reps
              </p>

              {/* Reorder com drag real (framer-motion) */}
              <Reorder.Group
                axis="y"
                values={draft.exercises}
                onReorder={(next) => setDraft({ ...draft, exercises: next as AssignedExercise[] })}
                className="space-y-2"
              >
                {draft.exercises.map((e, i) => (
                  <Reorder.Item
                    key={e.name + i}
                    value={e}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                    <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                      {i + 1}. {e.name}
                    </p>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={e.sets}
                      onChange={(ev) => {
                        const sets = Math.max(1, Math.min(10, Number(ev.target.value) || 1));
                        setDraft({
                          ...draft,
                          exercises: draft.exercises.map((x, xi) => (xi === i ? { ...x, sets } : x)),
                        });
                      }}
                      aria-label={`Séries de ${e.name}`}
                      className="h-8 w-11 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[11px] tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                    />
                    <span className="text-[10px] text-muted-foreground">x</span>
                    <input
                      value={e.reps}
                      onChange={(ev) => {
                        const reps = ev.target.value;
                        setDraft({
                          ...draft,
                          exercises: draft.exercises.map((x, xi) => (xi === i ? { ...x, reps } : x)),
                        });
                      }}
                      aria-label={`Repetições de ${e.name}`}
                      className="h-8 w-14 rounded-lg border border-white/[0.08] bg-white/[0.05] text-center text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-brand/50"
                    />
                    <button
                      onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, xi) => xi !== i) })}
                      aria-label={`Remover ${e.name}`}
                      className="tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-[#F87171]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              {/* Observação do personal */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MessageSquareText className="h-3.5 w-3.5" /> Observação do Personal
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex.: Foco em execução lenta, carga RPE 7, sem travar joelhos"
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

  // ===== VISÃO GERAL: novo treino, templates e atribuídos =====
  const pending = assigned.length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-bold text-foreground">Treinos</h1>
        <p className="text-[11px] text-muted-foreground">
          {aiReady ? "Co-Pilot IA" : "Gerador local"} · {pending} atribuídos
        </p>
      </header>

      {/* Passo 1: novo treino → seleção de aluno */}
      <button
        onClick={() => setPickerOpen(true)}
        className="gf-card gf-glass flex w-full items-center gap-3 !rounded-2xl !p-4 text-left transition-transform active:scale-[0.985]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
          <Plus className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Novo Treino</p>
          <p className="text-[11px] text-muted-foreground">
            Selecionar aluno e montar com IA
          </p>
        </div>
        <UserRoundPlus className="h-4.5 w-4.5 text-brand" />
      </button>

      {/* Templates em massa */}
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

      {/* Treinos atribuídos */}
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
                    {w.studentName.split(" ")[0]} · {w.exercises.length} exercícios · {fmtDate(w.created_at)}
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

      {/* Modal: seleção de aluno com busca dinâmica */}
      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="space-y-3">
          <div>
            <p className="text-base font-bold text-foreground">Para quem é o treino?</p>
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
                    <ChevronRightSmall />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </BottomSheet>

      {/* Aplicar em massa */}
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

function ChevronRightSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted-foreground" aria-hidden>
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
