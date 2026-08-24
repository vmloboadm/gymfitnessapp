"use client";

import { useState } from "react";
import Model, { type Muscle } from "react-body-highlighter";
import { cn } from "~/lib/utils";

/**
 * Mapa corporal GymFitness — SVG anatômico REAL (react-body-highlighter).
 * Cada músculo é um path clicável do desenho anatômico; ao tocar num
 * músculo do grupo, ele fica laranja #F4711E com glow e mostra o nome
 * do grupo em label flutuante. Sem esqueleto, sem números soltos.
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

export default function BodyMap({
  counts,
  onSelect,
  activeCat,
  title,
  subtitle,
}: {
  counts: Record<string, number>;
  onSelect: (catId: string) => void;
  activeCat: string;
  title?: string;
  subtitle?: string;
}) {
  const [side, setSide] = useState<Side>("front");
  const isBack = side === "back";
  const groups = isBack ? BACK_GROUPS : FRONT_GROUPS;

  const activeGroup = groups.find((g) => g.catId === activeCat) ?? null;

  // Só o grupo ativo vai destacado (frequency 1 → cor 0 da paleta).
  const data = activeGroup
    ? activeGroup.muscles.map((m) => ({ name: m, muscles: [m], frequency: 1 }))
    : [];

  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-card/50 p-4">
      {/* cabeçalho humano */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">
            {title ?? "Onde quer treinar hoje?"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle ?? "Toque no corpo para ver os aparelhos"}
          </p>
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

      {/* figura anatômica */}
      <div className="relative mx-auto max-w-[260px] px-4 pb-1 pt-2">
        {/* glow atrás da figura quando há grupo ativo */}
        {activeGroup ? (
          <span
            className="pointer-events-none absolute inset-x-10 bottom-8 top-16 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(244,113,30,0.18), transparent)", filter: "blur(14px)" }}
            aria-hidden
          />
        ) : null}

        {/* label flutuante do grupo ativo */}
        {activeGroup ? (
          <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/50 bg-[#0B1A33]/95 px-3 py-1 text-[11px] font-bold text-[#FFB27A] shadow-lg">
            {activeGroup.name}
            {counts[activeGroup.catId] > 0 ? (
              <span className="ml-1 text-brand">· {counts[activeGroup.catId]} aparelhos</span>
            ) : null}
          </span>
        ) : null}

        <Model
          type={isBack ? "posterior" : "anterior"}
          bodyColor="#16305A"
          highlightedColors={["#F4711E"]}
          data={data}
          onClick={(stats) => {
            const muscle = stats.muscle;
            const group = groups.find((g) =>
              g.muscles.includes(muscle as Muscle)
            );
            if (group) {
              navigator.vibrate?.(15);
              onSelect(group.catId);
            }
          }}
          style={{ width: "100%", cursor: "pointer", position: "relative", zIndex: 1 }}
        />
      </div>

      {/* legenda dos grupos da vista atual */}
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
            {counts[g.catId] > 0 ? <span className="ml-1 opacity-80">{counts[g.catId]}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
