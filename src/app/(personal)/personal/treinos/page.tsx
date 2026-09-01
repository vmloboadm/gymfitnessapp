"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Send,
  Sparkles,
  Loader2,
  MessageSquareText,
  ClipboardCheck,
  Users,
  Check,
  Layers,
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
  type WorkoutTemplate,
} from "~/lib/personal-data";
import { saveAssignedWorkout, type AssignedExercise } from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

type Draft = {
  name: string;
  frequency: string;
  level: string;
  exercises: AssignedExercise[];
  source: "ia" | "template";
};

const FLAT_LIB = () =>
  demoLib.flatMap((c) =>
    c.subs.flatMap((sub) => sub.exercises.map((e) => ({ ...e, group: c.name })))
  );

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

/**
 * Co-Pilot de treino do Personal: chat com IA, rascunho com revisão
 * obrigatória, aprovação pro aluno e templates aplicáveis em massa.
 */
export default function PersonalTreinosPage() {
  const { profile } = useAuth();
  const params = useSearchParams();
  const students = useMemo(() => demoPersonalStudents(), []);
  const templates = useMemo(() => demoTemplates(), []);
  const preselect = params.get("aluno");

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<string>(
    students.find((s) => s.id === preselect)?.id ?? students[0]?.id ?? ""
  );
  const [massTemplate, setMassTemplate] = useState<WorkoutTemplate | null>(null);
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  const aiReady = isAiConfigured();

  const run = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    const fallback = localDraft(prompt.trim());
    if (!aiReady) {
      // demo sem chave: gerador local estruturado, com latência real de IA
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

  const approve = async () => {
    if (!draft || !target) return;
    const student = students.find((s) => s.id === target);
    if (!student) return;
    saveAssignedWorkout({
      studentId: student.id,
      studentName: student.name,
      name: draft.name,
      notes: notes.trim() || null,
      frequency: draft.frequency,
      level: draft.level,
      exercises: draft.exercises,
      source: draft.source,
    });
    toast.success("Treino enviado com sucesso!", {
      description: `${student.name} recebeu "${draft.name}" na aba Treino.`,
    });
    setDraft(null);
    setPrompt("");
    setNotes("");
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
    toast.success(`Template aplicado para ${massSelected.size} alunos`);
    setMassTemplate(null);
    setMassSelected(new Set());
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/25 bg-brand/10">
          <Sparkles className="h-4.5 w-4.5 text-brand" />
        </span>
        <div>
          <h1 className="text-lg font-bold leading-tight text-foreground">Co-Pilot de Treino</h1>
          <p className="text-[11px] text-muted-foreground">
            {aiReady ? "IA configurada · revisão obrigatória antes de enviar" : "Gerador local · revisão obrigatória antes de enviar"}
          </p>
        </div>
      </header>

      {/* Input principal estilo chat (glass) */}
      <motion.section variants={item} initial="hidden" animate="show" className="gf-card gf-glass !p-4">
        <div className="mb-2 flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[10px] font-black text-brand-foreground">
              {(profile?.name?.[0] ?? "P").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="text-[13px] font-semibold text-foreground">Peça o treino que quiser</p>
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
          placeholder="Ex.: Montar treino de glúteos para Maria, 3x semana, sem impacto"
          aria-label="Pedido de treino para a IA"
          className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
        <div className="mt-2.5 flex justify-end">
          <Button onClick={run} disabled={!prompt.trim() || loading} size="sm" className="rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Gerar rascunho
          </Button>
        </div>
      </motion.section>

      {/* Estado de geração: a IA está montando o rascunho */}
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
              Montando o rascunho com base no seu pedido...
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

      {/* Rascunho IA + revisão obrigatória */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.section
            key={draft.name + draft.exercises.length}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="gf-card gf-glass space-y-3 !p-4"
            aria-label="Rascunho de treino gerado"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                  <Sparkles className="h-4 w-4 text-brand" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{draft.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {draft.frequency} · {draft.level} · Rascunho IA
                  </p>
                </div>
              </div>
            </div>

            <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-white/[0.02]">
              {draft.exercises.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                    {i + 1}. {e.name}
                  </p>
                  <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {e.sets}x {e.reps} · {e.rest}
                  </p>
                </li>
              ))}
            </ul>

            {/* Seleção do aluno */}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Enviar para
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setTarget(s.id)}
                    aria-pressed={target === s.id}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[11px] font-semibold transition-colors",
                      target === s.id
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-border bg-card/50 text-muted-foreground"
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={s.avatar} alt="" />
                      <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[9px] font-black text-brand-foreground">
                        {s.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    {s.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

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
              Aprovar e Enviar para Aluno
            </Button>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Templates prontos */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="tpl-title">
        <h2 id="tpl-title" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4 text-brand" />
          Templates prontos
        </h2>
        <div className="no-scrollbar snap-x snap-mandatory flex gap-3 overflow-x-auto pb-2">
          {templates.map((t) => (
            <article
              key={t.id}
              className="gf-card gf-glass w-[260px] shrink-0 snap-start space-y-2 !p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold leading-tight text-foreground">{t.name}</p>
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                  {t.level}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{t.description}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">
                {t.exercises.length} exercícios · {t.days}x semana
              </p>
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
      </motion.section>

      {/* Bottom sheet: aplicar em massa */}
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
