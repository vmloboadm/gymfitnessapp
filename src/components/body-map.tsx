"use client";

import { useState } from "react";
import Model, { type Muscle } from "react-body-highlighter";
import { cn } from "~/lib/utils";
import { recoveryState } from "~/lib/today-workout";

/**
 * Mapa corporal GymFitness — SVG anatômico REAL (react-body-highlighter).
 *
 * Estados visíveis SEM tocar (cor com função):
 *   verde  = grupo recuperado/liberado
 *   âmbar  = treinado nas últimas 24–48h (ainda recuperando)
 *   neutro = sem registro recente
 * Laranja #F4711E + glow = grupo selecionado (toque), com balão de confirmação.
 */

export type Side = "front" | "back";

type MuscleGroup = {
  catId: string;
  name: string;
  muscles: Muscle[];
};

const FRONT_GROUPS: MuscleGroup[] = [
  { catId: "peito", name: "Peito", muscles: ["chest"] },
  { catId: "ombro", name: "Ombros", muscles: ["front-deltoids"] },
  { catId: "braco", name: "Braços", muscles: ["biceps", "forearm"] },
  { catId: "abdomen", name: "Abdômen", muscles: ["abs", "obliques"] },
  { catId: "perna", name: "Pernas", muscles: ["quadriceps", "adductor"] },
];

const BACK_GROUPS: MuscleGroup[] = [
  { catId: "costas", name: "Costas", muscles: ["trapezius", "upper-back", "lower-back"] },
  { catId: "ombro", name: "Ombros", muscles: ["back-deltoids"] },
  { catId: "braco", name: "Braços", muscles: ["triceps", "forearm"] },
  { catId: "perna", name: "Pernas", muscles: ["gluteal", "hamstring", "abductors", "calves"] },
];

/* rótulos permanentes discretos (nome curto, baixo contraste) por vista */
const FRONT_LABELS: Array<{ catId: string; text: string; top: string; side: "l" | "r" }> = [
  { catId: "peito", text: "PEITO", top: "30%", side: "r" },
  { catId: "ombro", text: "OMBROS", top: "26%", side: "l" },
  { catId: "braco", text: "BRAÇOS", top: "42%", side: "l" },
  { catId: "abdomen", text: "ABDÔMEN", top: "48%", side: "r" },
  { catId: "perna", text: "PERNAS", top: "68%", side: "r" },
];
const BACK_LABELS: Array<{ catId: string; text: string; top: string; side: "l" | "r" }> = [
  { catId: "costas", text: "COSTAS", top: "32%", side: "l" },
  { catId: "ombro", text: "OMBROS", top: "27%", side: "r" },
  { catId: "braco", text: "TRÍCEPS", top: "44%", side: "r" },
  { catId: "perna", text: "POSTERIOR", top: "66%", side: "l" },
];

export default function BodyMap({
  counts,
  onSelect,
  activeCat,
  lastTrained,
  title,
  subtitle,
}: {
  counts: Record<string, number>;
  onSelect: (catId: string) => void;
  activeCat: string;
  /** catId → ISO da última sessão do grupo (fonte: logs/NFC). Define a cor de recuperação. */
  lastTrained?: Record<string, string | null>;
  title?: string;
  subtitle?: string;
}) {
  const [side, setSide] = useState<Side>("front");
  const isBack = side === "back";
  const groups = isBack ? BACK_GROUPS : FRONT_GROUPS;
  const labels = isBack ? BACK_LABELS : FRONT_LABELS;

  // cor-com-função: laranja=ativo · verde=recuperado · âmbar=recuperando
  const HIGHLIGHTS = ["#F4711E", "#4ADE80", "#FF9A5C"];
  const data: Array<{ name: string; muscles: Muscle[]; frequency: number }> = [];
  let anyState = false;
  for (const g of groups) {
    const isActive = activeCat === g.catId;
    const st = isActive ? "ativo" : recoveryState(g.catId, lastTrained?.[g.catId]);
    if (st === "nunca") continue;
    anyState = true;
    const freq = st === "ativo" ? 1 : st === "recuperado" ? 2 : 3;
    for (const m of g.muscles) data.push({ name: m, muscles: [m], frequency: freq });
  }

  const activeGroup = groups.find((g) => g.catId === activeCat) ?? null;

  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-card/50 p-4">
      {/* cabeçalho humano */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{title ?? "Onde quer treinar hoje?"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle ?? "Verde liberado · Âmbar recuperando"}</p>
        </div>
        <div className="flex shrink-0 rounded-full border border-border bg-card/70 p-0.5">
          {([["front", "Frente"], ["back", "Costas"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSide(key)}
              aria-pressed={side === key}
              className={cn(
                "gf-touch rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                side === key ? "bg-brand text-brand-foreground shadow-sm shadow-brand/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* figura anatômica + rótulos permanentes */}
      <div className="relative mx-auto max-w-[280px] px-6 pb-1 pt-2">
        {/* balão de confirmação (só no toque): nome + contagem */}
        {activeGroup ? (
          <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/50 bg-[#0B1A33]/95 px-3 py-1 text-[11px] font-bold text-[#FFB27A] shadow-lg">
            {activeGroup.name}
            {counts[activeGroup.catId] > 0 ? (
              <span className="ml-1 text-brand">· {counts[activeGroup.catId]} aparelhos</span>
            ) : null}
          </span>
        ) : null}

        {/* rótulos permanentes de baixo contraste */}
        {labels.map((l) => (
          <span
            key={l.text + l.top}
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-[1] select-none text-[7px] font-bold tracking-[0.12em] text-slate-400/70",
              l.side === "l" ? "left-0" : "right-0"
            )}
            style={{ top: l.top }}
          >
            {l.text}
          </span>
        ))}

        {/* glow ambiente quando há seleção */}
        {activeGroup ? (
          <span
            className="pointer-events-none absolute inset-x-10 bottom-10 top-16 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(244,113,30,0.16), transparent)", filter: "blur(14px)" }}
            aria-hidden
          />
        ) : null}

        <Model
          type={isBack ? "posterior" : "anterior"}
          bodyColor="#16305A"
          highlightedColors={HIGHLIGHTS}
          data={data}
          onClick={(stats) => {
            const group = groups.find((g) => g.muscles.includes(stats.muscle as Muscle));
            if (group) {
              navigator.vibrate?.(15);
              onSelect(group.catId);
            }
          }}
          style={{ width: "100%", cursor: "pointer", position: "relative", zIndex: 1 }}
        />
      </div>

      {/* legenda de estado */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {[
          { label: "Recuperado", cls: "bg-[#4ADE80]" },
          { label: "Recuperando", cls: "bg-[#FF9A5C]" },
          { label: "Sem registro", cls: "bg-slate-500/70" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", l.cls)} />
            <span className="text-[10px] font-medium text-muted-foreground">{l.label}</span>
          </span>
        ))}
      </div>

      {/* navegação rápida por grupo (sem contagem aqui pra não duplicar) */}
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {groups.map((g) => (
          <button
            key={g.catId + g.name}
            onClick={() => {
              navigator.vibrate?.(10);
              onSelect(g.catId);
            }}
            aria-pressed={activeCat === g.catId}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
              activeCat === g.catId
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      {!anyState && !activeGroup ? (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Treine para começar a pintar seu mapa 🎨</p>
      ) : null}
    </div>
  );
}
