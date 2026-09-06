"use client";

import { useState } from "react";
import { AnimatePresence,m } from "framer-motion";
import { RotateCw } from "lucide-react";
import Model, { type Muscle } from "react-body-highlighter";
import { cn } from "~/lib/utils";
import { recoveryState, type RecoveryState } from "~/lib/today-workout";

/**
 * Mapa corporal GymFitness, SVG anatômico REAL (react-body-highlighter).
 *
 * Escala de recuperação SEMPRE visível (cor com função), 4 estados:
 *   verde   = descansado (liberado)
 *   amarelo = recuperando
 *   laranja = ainda cansado
 *   vermelho = exausto
 * Grupo selecionado (toque) acende em laranja-claro + glow, com balão.
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

  // cor-com-função: frequency → HIGHLIGHTS[frequency-1]
  // 1 exausto · 2 cansado · 3 recuperando · 4 descansado · 5 selecionado
  const HIGHLIGHTS = ["#EF4444", "#F4711E", "#FACC15", "#4ADE80", "#FFB27A"];
  const data: Array<{ name: string; muscles: Muscle[]; frequency: number }> = [];
  for (const g of groups) {
    const isActive = activeCat === g.catId;
    const st: RecoveryState | "ativo" = isActive ? "ativo" : recoveryState(g.catId, lastTrained?.[g.catId]);
    const freq = st === "ativo" ? 5 : st === "descansado" ? 4 : st === "recuperando" ? 3 : st === "cansado" ? 2 : 1;
    for (const m of g.muscles) data.push({ name: m, muscles: [m], frequency: freq });
  }

  const activeGroup = groups.find((g) => g.catId === activeCat) ?? null;

  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-card/50 p-4">
      {/* cabeçalho humano */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{title ?? "Onde quer treinar hoje?"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle ?? "Toque num grupo pra ver os exercícios"}</p>
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
      <div className="relative mx-auto max-w-[300px] px-6 pb-2 pt-2">
        {/* palco: vinheta de profundidade */}
        <span
          className="pointer-events-none absolute inset-x-4 bottom-4 top-8 rounded-[28px]"
          style={{ background: "radial-gradient(80% 60% at 50% 30%, rgba(59,91,140,0.20), transparent 70%)" }}
          aria-hidden
        />
        {/* sombra de contato no chão (dá peso real à figura) */}
        <span
          className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-36 -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)", filter: "blur(3px)" }}
          aria-hidden
        />
        {/* halo pulsante quando há grupo selecionado */}
        {activeGroup ? (
          <m.span
            className="pointer-events-none absolute inset-x-14 bottom-12 top-14 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(244,113,30,0.20), transparent)", filter: "blur(16px)" }}
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        ) : null}
        {/* balão de confirmação (só no toque): nome + contagem */}
        {activeGroup ? (
          <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/50 bg-[#0B1A33]/95 px-3 py-1 text-[11px] font-bold text-[#FFB27A] shadow-lg">
            {activeGroup.name}
            {counts[activeGroup.catId] > 0 ? (
              <span className="ml-1 text-brand">· {counts[activeGroup.catId]} exercícios</span>
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

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={side}
            initial={{ opacity: 0, rotateY: isBack ? -15 : 15, scale: 0.98 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: isBack ? 15 : -15, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-[1]"
            style={{ perspective: 800 }}
          >
            <Model
              type={isBack ? "posterior" : "anterior"}
              bodyColor="#1B3A66"
              highlightedColors={HIGHLIGHTS}
              data={data}
              onClick={(stats) => {
                const group = groups.find((g) => g.muscles.includes(stats.muscle as Muscle));
                if (group) {
                  navigator.vibrate?.(15);
                  onSelect(group.catId);
                }
              }}
              svgStyle={{ filter: activeGroup ? "drop-shadow(0 6px 18px rgba(244,113,30,0.25)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))" : "drop-shadow(0 4px 14px rgba(0,0,0,0.45))" }}
              style={{ width: "100%", cursor: "pointer" }}
            />
          </m.div>
        </AnimatePresence>

        {/* botão girar sobre a ilustração — pedido confirmado */}
        <button
          onClick={() => {
            navigator.vibrate?.(15);
            setSide((s) => (s === "front" ? "back" : "front"));
          }}
          aria-label={`Ver ${isBack ? "frente" : "costas"}`}
          className="tactile absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#0B1A33]/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Girar
        </button>
      </div>

      {/* legenda fixa — sempre visível, 4 estados de recuperação */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {[
          { label: "Descansado", cls: "bg-[#4ADE80]" },
          { label: "Recuperando", cls: "bg-[#FACC15]" },
          { label: "Ainda cansado", cls: "bg-[#F4711E]" },
          { label: "Exausto", cls: "bg-[#EF4444]" },
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

    </div>
  );
}
