"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, PlayCircle, Timer, X, Link2 } from "lucide-react";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { assetPath } from "~/lib/asset-path";
import { readSessionProgress, saveSessionProgress } from "~/lib/workout-session";
import { ImageLightbox } from "~/components/common/ImageLightbox";
import { groupByTecnica, tecnicaLabel } from "~/lib/workout-groups";

export type WExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  tecnica?: "normal" | "biset" | "triset" | "dropset" | null;
  info?: string | null;
  tips?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  videoUrlMale?: string | null;
  videoUrlFemale?: string | null;
  /** id real do exercício (exercises.id) para gravar o log */
  exerciseId?: string | null;
  /** o que o aluno fez da última vez neste exercício */
  last?: { weight: number | null; reps: number | null; date: string } | null;
};

type SetRecord = { reps: string; weight: string; done: boolean };
type ExerciseProgress = { sets: SetRecord[] };

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Sessão de treino ativa · padrão Strong/Hevy.
 *
 * Header fixo enxuto, foto real do exercício, linhas de série compactas
 * com reps editáveis, descanso automático e CTA único de progressão.
 * A BottomNav global fica oculta (body.session-active) durante a sessão.
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
  onMinimize,
  onProgressChange,
  onExerciseDone,
}: {
  exercises: WExercise[];
  onFinish: (completedIds: string[], progress: Record<string, ExerciseProgress>) => void;
  /** chamado quando o aluno fecha (ou deixa com séries feitas) um exercício */
  onExerciseDone?: (exercise: WExercise, sets: SetRecord[]) => void;
  onMinimize?: () => void;
  onProgressChange?: (completedIds: string[]) => void;
}) {
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const restInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIdxRef = useRef(-1);
  // snapshot ao vivo do progresso p/ o handler de finalizar (sem stale closure)
  const progressRef = useRef<Record<string, ExerciseProgress>>({});
  progressRef.current = progress;

  // imersão: topo da página + esconde BottomNav global
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add("session-active");
    return () => {
      document.body.classList.remove("session-active");
      if (restInterval.current) clearInterval(restInterval.current);
    };
  }, []);

  useEffect(() => {
    const saved = readSessionProgress();
    const savedIds = saved ? (saved.exercises as Array<{ id?: string }>).map((e) => e?.id ?? "").join("|") : "";
    const currentIds = exercises.map((e) => e.id).join("|");
    if (saved && savedIds && savedIds === currentIds) {
      // retoma exatamente de onde parou (aluno circulou pelo app)
      const resumeIdx = Math.min(saved.currentIdx, exercises.length - 1);
      setProgress(saved.progress as Record<string, ExerciseProgress>);
      setCurrentIdx(resumeIdx);
      // retoma o descanso que estava rodando quando saiu da tela.
      // Comparar com `currentIdx` aqui era o bug: no mount ele ainda é 0,
      // então o descanso só voltava se o aluno tivesse parado no 1º exercício.
      if (saved.restIdx === resumeIdx && typeof saved.restEndsAt === "number") {
        const left = Math.ceil((saved.restEndsAt - Date.now()) / 1000);
        if (left > 0 && left <= 600) {
          restIdxRef.current = resumeIdx;
          startRest(left);
        }
      }
      return;
    }
    setProgress(() => {
      const next: Record<string, ExerciseProgress> = {};
      for (const ex of exercises) {
        next[ex.id] = {
          // carga da última vez já vem preenchida: o aluno só confirma ou ajusta
          sets: Array.from({ length: ex.sets }, () => ({
            reps: String(ex.reps).match(/\d+/)?.[0] ?? String(ex.reps),
            weight: ex.last?.weight ? String(ex.last.weight).replace(".", ",") : "",
            done: false,
          })),
        };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  // persiste a cada mudança · navegar pelo app não perde séries.
  // Debounce do texto (reps/peso): salvar a cada tecla engasga o teclado.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!exercises.length || !Object.keys(progress).length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSessionProgress({
        exercises,
        progress,
        currentIdx,
        restIdx: restIdxRef.current,
        restEndsAt: restLeft !== null ? Date.now() + restLeft * 1000 : null,
      });
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [exercises, progress, currentIdx, restLeft]);

  // reporta ids concluídos para cima (barra "Finalizar Treino" usa o ref)
  const completedIds = useMemo(
    () => exercises.filter((e) => progress[e.id]?.sets.every((s) => s.done)).map((e) => e.id),
    [progress, exercises]
  );
  useEffect(() => {
    onProgressChange?.(completedIds);
  }, [completedIds, onProgressChange]);

  // Salva cada exercício assim que todas as séries dele são marcadas.
  const reportedRef = useRef<Set<string>>(new Set());
  const reportDone = useCallback(
    (ex: WExercise | undefined) => {
      if (!ex || !onExerciseDone) return;
      const sets = progressRef.current[ex.id]?.sets ?? [];
      if (!sets.some((st) => st.done)) return;
      onExerciseDone(ex, sets);
    },
    [onExerciseDone]
  );
  useEffect(() => {
    for (const id of completedIds) {
      if (reportedRef.current.has(id)) continue;
      reportedRef.current.add(id);
      reportDone(exercises.find((e) => e.id === id));
    }
  }, [completedIds, exercises, reportDone]);

  const startRest = useCallback((seconds: number) => {
    if (!seconds || seconds <= 0) return;
    if (restInterval.current) clearInterval(restInterval.current);
    setRestLeft(seconds);
    restInterval.current = setInterval(() => {
      setRestLeft((v) => {
        if (v === null || v <= 1) {
          if (restInterval.current) clearInterval(restInterval.current);
          restIdxRef.current = -1;
          if (v !== null) {
            // fim do descanso: avisa mesmo com o celular no bolso
            navigator.vibrate?.([200, 100, 200]);
            toast("Descanso acabou. Bora pra próxima série!", { duration: 2500 });
          }
          return null;
        }
        return v - 1;
      });
    }, 1000);
  }, []);

  const doneSets = useMemo(
    () => exercises.reduce((acc, e) => acc + (progress[e.id]?.sets.filter((s) => s.done).length ?? 0), 0),
    [progress, exercises]
  );
  const totalSets = useMemo(() => exercises.reduce((acc, e) => acc + e.sets, 0), [exercises]);

  const current = exercises[currentIdx];
  const currentProgress = current ? progress[current.id] : null;
  // Bi-set/tri-set: o bloco inteiro aparece numa tela só, em rodadas
  // (A1 → A2 → descanso). Antes cada exercício era uma tela e o descanso
  // disparava entre eles, o contrário do que o personal prescreveu.
  const groups = useMemo(() => groupByTecnica(exercises), [exercises]);
  const currentGroup = useMemo(
    () => groups.find((g) => g.items.some((x) => x.index === currentIdx)) ?? null,
    [groups, currentIdx]
  );
  const isBlock = !!currentGroup && currentGroup.items.length > 1;
  const blockItems: WExercise[] = isBlock ? currentGroup!.items.map((x) => x.item) : current ? [current] : [];
  const groupStartIdx = currentGroup?.items[0]?.index ?? currentIdx;
  const groupEndIdx = currentGroup?.items[currentGroup.items.length - 1]?.index ?? currentIdx;
  const groupLabel = isBlock ? tecnicaLabel(currentGroup!.tecnica) : null;
  const exDone = (ex: WExercise) => {
    const p = progress[ex.id];
    return !!p?.sets.length && p.sets.every((st) => st.done);
  };
  const currentAllDone = blockItems.length > 0 && blockItems.every(exDone);
  const nextEx = exercises[groupEndIdx + 1];
  const isLast = groupEndIdx >= exercises.length - 1;

  // retomada no meio de um bloco: sempre abre no começo dele
  useEffect(() => {
    if (isBlock && currentIdx !== groupStartIdx) setCurrentIdx(groupStartIdx);
  }, [isBlock, currentIdx, groupStartIdx]);

  const cancelRest = useCallback(() => {
    if (restInterval.current) clearInterval(restInterval.current);
    restIdxRef.current = -1;
    setRestLeft(null);
  }, []);

  const toggleSetFor = (ex: WExercise, idx: number) => {
    const p = progress[ex.id];
    if (!p) return;
    const willBeDone = !p.sets[idx]?.done;
    navigator.vibrate?.(willBeDone ? 15 : 8);
    setProgress((prev) => {
      const cur = prev[ex.id];
      if (!cur) return prev;
      const sets = cur.sets.map((st, i) => (i === idx ? { ...st, done: !st.done } : st));
      return { ...prev, [ex.id]: { sets } };
    });
    if (!willBeDone) {
      // desmarcou por engano: para o descanso que não faz mais sentido
      cancelRest();
      return;
    }
    if (isBlock) {
      // descanso só quando a rodada inteira do bloco fecha
      const roundClosed = blockItems.every((it) =>
        it.id === ex.id ? true : idx >= (progress[it.id]?.sets.length ?? 0) || !!progress[it.id]?.sets[idx]?.done
      );
      if (roundClosed) {
        restIdxRef.current = groupStartIdx;
        startRest(Math.max(...blockItems.map((it) => it.rest || 0)));
      } else {
        cancelRest();
      }
      return;
    }
    restIdxRef.current = currentIdx;
    startRest(ex.rest);
  };

  const setFieldFor = (ex: WExercise, idx: number, field: "reps" | "weight", value: string) => {
    setProgress((prev) => {
      const p = prev[ex.id];
      if (!p) return prev;
      // carga digitada na série vale para as próximas ainda não feitas
      const sets = p.sets.map((st, i) =>
        i === idx || (field === "weight" && i > idx && !st.done && (st.weight === p.sets[idx]?.weight || !st.weight))
          ? { ...st, [field]: value }
          : st
      );
      return { ...prev, [ex.id]: { sets } };
    });
  };

  const markAll = () => {
    if (!current) return;
    navigator.vibrate?.(25);
    const allDone = currentAllDone;
    setProgress((prev) => {
      const next = { ...prev };
      for (const ex of blockItems) {
        const p = prev[ex.id];
        if (p) next[ex.id] = { sets: p.sets.map((st) => ({ ...st, done: !allDone })) };
      }
      return next;
    });
    if (!allDone) {
      restIdxRef.current = groupStartIdx;
      startRest(Math.max(...blockItems.map((it) => it.rest || 0)));
    } else {
      cancelRest();
    }
  };

  const goNext = () => {
    if (!isLast) {
      navigator.vibrate?.(20);
      setCurrentIdx(groupEndIdx + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goPrev = () => {
    if (groupStartIdx > 0) {
      const prevGroup = groups.find((g) => g.items.some((x) => x.index === groupStartIdx - 1));
      setCurrentIdx(prevGroup?.items[0]?.index ?? groupStartIdx - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const advanceOrFinish = () => {
    if (isLast) {
      setShowFinish(true);
      return;
    }
    const partial = blockItems.filter((ex) => !exDone(ex) && progress[ex.id]?.sets.some((st) => st.done));
    partial.forEach((ex) => reportDone(ex));
    if (!currentAllDone && partial.length > 0) {
      toast("Exercício pulado · o que marcou continua valendo");
    } else if (!currentAllDone) {
      toast("Exercício pulado");
    }
    goNext();
  };

  // Próxima série pendente do exercício/bloco atual, na ordem da rodada
  // (bi-set: A1 série 1 → A2 série 1 → A1 série 2...). É o que o botão
  // principal marca: o aluno treina só com o polegar, sem caçar a linha.
  const nextPending = useMemo(() => {
    const rounds = Math.max(0, ...blockItems.map((it) => progress[it.id]?.sets.length ?? 0));
    for (let r = 0; r < rounds; r++) {
      for (const it of blockItems) {
        const st = progress[it.id]?.sets[r];
        if (st && !st.done) return { ex: it, idx: r };
      }
    }
    return null;
  }, [blockItems, progress]);

  const primaryLabel = nextPending
    ? isBlock
      ? `${String.fromCharCode(65 + (groups.indexOf(currentGroup!) % 26))}${blockItems.indexOf(nextPending.ex) + 1} · rodada ${nextPending.idx + 1} feita ✓`
      : `Série ${nextPending.idx + 1} de ${progress[nextPending.ex.id]?.sets.length ?? nextPending.ex.sets} feita ✓`
    : isLast
      ? "Finalizar treino"
      : "Próximo exercício →";

  const onPrimary = () => {
    if (nextPending) {
      toggleSetFor(nextPending.ex, nextPending.idx);
      return;
    }
    advanceOrFinish();
  };

  const handleFinish = () => {
    if (finishing) return;
    setFinishing(true);
    navigator.vibrate?.([50, 30, 50]);
    if (restInterval.current) clearInterval(restInterval.current);
    // NÃO limpa o progresso aqui: o conclude() da página lê este snapshot
    // (reps/peso reais) e só então limpa. Limpar antes matava o fallback.
    onFinish(completedIds, progressRef.current);
  };

  const photo = current?.thumbUrl ?? current?.imageUrl ?? null;

  if (!exercises || exercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm font-bold text-foreground">Nenhum exercício nesta sessão</p>
        <button onClick={() => onFinish([], {})} className="rounded-xl border border-border px-6 py-3 text-sm font-bold">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Header fixo */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2.5">
          <button
            onClick={goPrev}
            disabled={groupStartIdx === 0}
            aria-label="Exercício anterior"
            className="flex h-9 w-9 gf-touch shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {isBlock
                ? `Exercícios ${groupStartIdx + 1}–${groupEndIdx + 1} de ${exercises.length}`
                : `Exercício ${currentIdx + 1} de ${exercises.length}`}
            </p>
            <div className="mx-auto mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${((groupEndIdx + 1) / exercises.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setShowSummary(true)}
            aria-label="Abrir resumo do treino"
            aria-expanded={showSummary}
            title="Resumo do treino"
            className="gf-touch flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowFinish(true)}
            className="shrink-0 rounded-full bg-success px-3.5 py-1.5 text-[11px] font-black text-black"
          >
            Finalizar
          </button>
        </div>
      </header>

      {/* Timer de descanso */}
      <AnimatePresence>
        {restLeft !== null && (
          <m.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-[57px] z-20 border-b border-brand/20 bg-brand/[0.08] backdrop-blur"
          >
            <div className="mx-auto flex max-w-md items-center justify-center gap-3 px-4 py-2">
              <Timer className="h-4 w-4 text-brand" />
              <span className="text-sm font-black tabular-nums text-brand">{fmt(restLeft)}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">descanso</span>
              <button
                onClick={cancelRest}
                className="gf-touch ml-2 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground"
              >
                Pular
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Conteúdo */}
      <main className="flex-1 px-4 pb-40 pt-4">
        <AnimatePresence mode="wait">
          {current && (
            <m.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-md"
            >
              {isBlock ? (
                <div>
                  <div className="mb-4 rounded-2xl border border-brand/40 bg-brand/[0.06] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-brand">
                      <Link2 className="h-3.5 w-3.5" /> {groupLabel} · {blockItems.length} exercícios
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                      Faça um e vá direto para o outro. Descanse só quando fechar a rodada.
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {blockItems.map((ex, k) => {
                        const img = ex.thumbUrl ?? ex.imageUrl ?? null;
                        const vid = ex.videoUrlMale ?? ex.videoUrl ?? ex.videoUrlFemale ?? null;
                        return (
                          <li key={ex.id} className="flex items-center gap-2.5">
                            <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-[10px] font-black text-brand-foreground">
                              {String.fromCharCode(65 + groups.indexOf(currentGroup!) % 26)}{k + 1}
                            </span>
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={assetPath(img)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-white/[0.08] bg-white object-cover" />
                            ) : (
                              <FitnessIcon glyph={fitnessForName(ex.name)} size={40} />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-black text-foreground">{ex.name}</span>
                              <span className="block text-[11px] font-semibold text-muted-foreground">
                                {ex.sets}× {ex.reps}
                                {ex.last?.weight ? (
                                  <span className="text-brand"> · última: {String(ex.last.weight).replace(".", ",")} kg</span>
                                ) : null}
                              </span>
                            </span>
                            {vid ? (
                              <button
                                type="button"
                                onClick={() => setVideoEx({ name: ex.name, poster: img, url: vid })}
                                aria-label={`Vídeo de ${ex.name}`}
                                className="gf-touch flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    {Array.from({ length: Math.max(...blockItems.map((ex) => progress[ex.id]?.sets.length ?? 0), 0) }, (_, r) => {
                      const roundItems = blockItems.filter((ex) => (progress[ex.id]?.sets.length ?? 0) > r);
                      const roundDone = roundItems.every((ex) => progress[ex.id]?.sets[r]?.done);
                      return (
                        <div key={r} className={cn("rounded-2xl border p-2", roundDone ? "border-success/40 bg-success/[0.05]" : "border-border bg-card/30")}>
                          <p className={cn("px-1.5 pb-1.5 pt-0.5 text-[10px] font-black uppercase tracking-widest", roundDone ? "text-success" : "text-muted-foreground")}>
                            Rodada {r + 1}{roundDone ? " · feita, descanse" : ""}
                          </p>
                          <div className="space-y-1.5">
                            {roundItems.map((ex) => {
                              const st = progress[ex.id]!.sets[r];
                              return (
                                <div
                                  key={ex.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleSetFor(ex, r)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      toggleSetFor(ex, r);
                                    }
                                  }}
                                  aria-pressed={st.done}
                                  aria-label={`Série ${r + 1} de ${ex.name}: toque para ${st.done ? "desmarcar" : "marcar como feita"}`}
                                  className={cn(
                                    "flex min-h-[60px] cursor-pointer select-none items-center gap-2.5 rounded-xl border px-2.5 transition-all active:scale-[0.99]",
                                    st.done ? "border-success/45 bg-success/[0.09]" : "border-border bg-background/60"
                                  )}
                                >
                                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black", st.done ? "bg-success text-black" : "bg-muted text-muted-foreground")}>
                                    {st.done ? <Check className="h-4 w-4 stroke-[3]" /> : `${String.fromCharCode(65 + groups.indexOf(currentGroup!) % 26)}${blockItems.indexOf(ex) + 1}`}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-foreground">{ex.name}</span>
                                  <label className="flex shrink-0 flex-col items-center gap-0.5">
                                    <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">reps</span>
                                    <input type="tel" inputMode="numeric" value={st.reps}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setFieldFor(ex, r, "reps", e.target.value)}
                                      aria-label={`Reps da série ${r + 1} de ${ex.name}`}
                                      className="h-8 w-11 rounded-lg border border-border bg-background text-center text-[15px] font-black tabular-nums text-foreground outline-none focus:border-brand" />
                                  </label>
                                  <label className="flex shrink-0 flex-col items-center gap-0.5">
                                    <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">kg</span>
                                    <input type="tel" inputMode="decimal" value={st.weight} placeholder="—"
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setFieldFor(ex, r, "weight", e.target.value)}
                                      aria-label={`Carga em kg da série ${r + 1} de ${ex.name}`}
                                      className="h-8 w-12 rounded-lg border border-border bg-background text-center text-[15px] font-black tabular-nums text-foreground outline-none focus:border-brand placeholder:text-muted-foreground/40" />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={markAll}
                    className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-card"
                  >
                    {currentAllDone ? "Desmarcar todas" : "Marcar todas como feitas"}
                  </button>
                </div>
              ) : (
              <>
              {/* Hero do exercício */}
              <div className="mb-5 flex items-center gap-4">
                {photo ? (
                  <button
                    onClick={() => setZoomOpen(true)}
                    aria-label="Ampliar ilustração do exercício"
                    className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetPath(photo ?? "")} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ) : (
                  <FitnessIcon glyph={fitnessForName(current.name)} size={72} className="rounded-2xl" />
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-black leading-tight text-foreground">{current.name}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                    {current.sets} séries × {current.reps} reps
                  </p>
                  {current.last && (current.last.weight || current.last.reps) ? (
                    <p className="mt-1 text-[12px] font-semibold text-brand">
                      Última vez: {current.last.weight ? `${String(current.last.weight).replace(".", ",")} kg` : "sem carga"}
                      {current.last.reps ? ` × ${current.last.reps}` : ""}
                      <span className="font-medium text-muted-foreground">
                        {" "}· {new Date(current.last.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() =>
                        setDetailEx({
                          name: current.name,
                          info: current.info ?? null,
                          tips: current.tips ?? null,
                          imageUrl: current.imageUrl ?? null,
                          videoUrl: current.videoUrl ?? null,
                        })
                      }
                      className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                    >
                      <Info className="h-3 w-3" /> Ficha
                    </button>
                    {(current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale) && (
                      <button
                        onClick={() => {
                          const url = current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale;
                          if (url) setVideoEx({ name: current.name, poster: current.thumbUrl ?? current.imageUrl ?? null, url });
                        }}
                        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                      >
                        <PlayCircle className="h-3 w-3" /> Vídeo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Séries · linha inteira tapável, sem tabela técnica */}
              <div className="space-y-2">
                {currentProgress?.sets.map((s, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSetFor(current, i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSetFor(current, i);
                      }
                    }}
                    aria-pressed={s.done}
                    aria-label={`Série ${i + 1}: toque para ${s.done ? "desmarcar" : "marcar como feita"}`}
                    className={cn(
                      "flex min-h-[76px] cursor-pointer select-none items-center gap-2.5 rounded-2xl border px-3 transition-all active:scale-[0.99]",
                      s.done ? "border-success/45 bg-success/[0.09]" : "border-border bg-card/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black",
                        s.done ? "bg-success text-black" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.done ? <Check className="h-5 w-5 stroke-[3]" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[14px] font-black", s.done ? "text-success" : "text-foreground")}>
                        Série {i + 1}
                      </span>
                      <span className="block text-[10px] font-semibold text-muted-foreground">
                        {s.done ? "Feita! Descansa" : `${current.reps} reps · descanso ${current.rest}s`}
                      </span>
                    </span>
                    <label className="flex shrink-0 flex-col items-center gap-0.5">
                      <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">reps</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={s.reps}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setFieldFor(current, i, "reps", e.target.value)}
                        aria-label={`Reps da série ${i + 1}`}
                        className="h-9 w-12 rounded-lg border border-border bg-background text-center text-base font-black tabular-nums text-foreground outline-none focus:border-brand"
                      />
                    </label>
                    <label className="flex shrink-0 flex-col items-center gap-0.5">
                      <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">kg</span>
                      <input
                        type="tel"
                        inputMode="decimal"
                        value={s.weight}
                        placeholder="—"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setFieldFor(current, i, "weight", e.target.value)}
                        aria-label={`Carga em kg da série ${i + 1}`}
                        className="h-9 w-14 rounded-lg border border-border bg-background text-center text-base font-black tabular-nums text-foreground outline-none focus:border-brand placeholder:text-muted-foreground/40"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <button
                onClick={markAll}
                className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-card"
              >
                {currentAllDone ? "Desmarcar todas" : "Marcar todas como feitas"}
              </button>

              </>
              )}

              {/* Próximo exercício */}
              {nextEx && (
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">A seguir</p>
                  <button
                    onClick={goNext}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 p-3 text-left"
                  >
                    <FitnessIcon glyph={fitnessForName(nextEx.name)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{nextEx.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {nextEx.sets} séries × {nextEx.reps} reps
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA fixo */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="w-[72px] shrink-0">
            <p className="text-sm font-black tabular-nums text-foreground">{doneSets}/{totalSets}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">séries</p>
          </div>
          <button
            onClick={onPrimary}
            className="min-w-0 flex-1 truncate rounded-xl bg-brand px-3 py-3.5 text-sm font-black text-brand-foreground shadow-lg shadow-brand/25 transition-transform active:scale-[0.98]"
          >
            {primaryLabel}
          </button>
          {nextPending && !isLast ? (
            <button
              onClick={advanceOrFinish}
              className="shrink-0 rounded-xl border border-border px-3 py-3.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              Pular
            </button>
          ) : null}
        </div>
      </footer>

      {/* Confirmação de finalização */}
      <AnimatePresence>
        {showFinish && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center"
            onClick={() => setShowFinish(false)}
          >
            <m.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-black text-foreground">Finalizar treino?</h3>
                <button
                  onClick={() => setShowFinish(false)}
                  aria-label="Fechar"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Você fez <span className="font-bold text-foreground">{doneSets}</span> séries em{" "}
                <span className="font-bold text-foreground">{completedIds.length}</span> de {exercises.length} exercícios.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => setShowFinish(false)} className="rounded-xl border border-border py-3 text-sm font-bold text-foreground">
                  Continuar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={finishing}
                  className="rounded-xl bg-success py-3 text-sm font-black text-black shadow-lg shadow-success/25 disabled:opacity-60"
                >
                  {finishing ? "Salvando…" : "Finalizar"}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <ExerciseVideoModal
        open={!!videoEx}
        onClose={() => setVideoEx(null)}
        name={videoEx?.name ?? ""}
        poster={videoEx?.poster ?? null}
        videoUrl={videoEx?.url ?? null}
      />
      <BottomSheet open={showSummary} onClose={() => setShowSummary(false)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-black text-foreground">Resumo do treino</p>
              <p className="text-[11px] text-muted-foreground">{doneSets} de {totalSets} séries feitas</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              aria-label="Fechar resumo"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[48vh] space-y-1.5 overflow-y-auto pr-1">
            {exercises.map((ex, i) => {
              const p = progress[ex.id];
              const done = p?.sets.filter((s) => s.done).length ?? 0;
              const total = p?.sets.length ?? ex.sets;
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentIdx(i);
                      setShowSummary(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left",
                      i === currentIdx ? "border-brand/40 bg-brand/[0.08]" : "border-border bg-card/40"
                    )}
                  >
                    <span className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                      done === total && total > 0 ? "bg-success text-black" : "bg-muted text-muted-foreground"
                    )}>
                      {done === total && total > 0 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-foreground">{ex.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{done}/{total} séries</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
          {onMinimize ? (
            <button
              type="button"
              onClick={() => {
                setShowSummary(false);
                onMinimize();
              }}
              className="tactile w-full rounded-xl border border-white/[0.08] py-3 text-[12px] font-bold text-muted-foreground"
            >
              Minimizar treino
            </button>
          ) : null}
        </div>
      </BottomSheet>
      <BottomSheet open={!!detailEx} onClose={() => setDetailEx(null)}>
        {detailEx ? (
          <div className="space-y-3">
            <h3 className="text-base font-black text-foreground">{detailEx.name}</h3>
            <p className="text-sm text-muted-foreground">{detailEx.info ?? "Execução padrão, cadência controlada."}</p>
            {detailEx.videoUrl ? (
              <a
                href={detailEx.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-brand"
              >
                Ver vídeo no YouTube
              </a>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
      <ImageLightbox src={photo} alt={current?.name} open={zoomOpen} onClose={() => setZoomOpen(false)} />
    </div>
  );
}
