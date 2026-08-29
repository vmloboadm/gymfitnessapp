"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUpRight, FlipHorizontal2, Dumbbell } from "lucide-react";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { demoLib } from "~/lib/demo-bridge";

/**
 * Explorador muscular — base anatômica e overlays de músculo do projeto
 * wger (https://wger.de), licença CC-BY-SA 3.0. Overlay vermelho desenha
 * o músculo selecionado por cima da base, como um "recorte" anatômico.
 *
 * Toque num ponto → destaca o músculo + abre os exercícios do grupo.
 */

type MuscleDef = {
  id: number; // id do overlay public/body/muscles/main-{id}.svg
  name: string;
  view: "front" | "back";
  grupo: "peito" | "costas" | "ombro" | "braco" | "abdomen" | "perna";
  x: number; // % horizontal no canvas 200×369
  y: number; // % vertical
};

const MUSCLES: MuscleDef[] = [
  // Frente
  { id: 4, name: "Peitoral", view: "front", grupo: "peito", x: 50, y: 24 },
  { id: 2, name: "Deltoide", view: "front", grupo: "ombro", x: 26.5, y: 23.5 },
  { id: 1, name: "Bíceps", view: "front", grupo: "braco", x: 25, y: 32 },
  { id: 13, name: "Braquial", view: "front", grupo: "braco", x: 75, y: 33 },
  { id: 3, name: "Serrátil", view: "front", grupo: "abdomen", x: 63, y: 31 },
  { id: 6, name: "Abdômen", view: "front", grupo: "abdomen", x: 50, y: 36 },
  { id: 14, name: "Oblíquos", view: "front", grupo: "abdomen", x: 37, y: 39 },
  { id: 10, name: "Quadríceps", view: "front", grupo: "perna", x: 43, y: 59 },
  // Costas
  { id: 9, name: "Trapézio", view: "back", grupo: "costas", x: 50, y: 22.5 },
  { id: 12, name: "Dorsal", view: "back", grupo: "costas", x: 37, y: 29.5 },
  { id: 5, name: "Tríceps", view: "back", grupo: "braco", x: 75, y: 33 },
  { id: 16, name: "Lombar", view: "back", grupo: "costas", x: 50, y: 42 },
  { id: 8, name: "Glúteos", view: "back", grupo: "perna", x: 50, y: 52 },
  { id: 11, name: "Posterior de coxa", view: "back", grupo: "perna", x: 43, y: 62 },
  { id: 7, name: "Panturrilha", view: "back", grupo: "perna", x: 43, y: 77 },
  { id: 15, name: "Sóleo", view: "back", grupo: "perna", x: 57, y: 80 },
];

const GRUPO_LABEL: Record<string, string> = {
  peito: "Peito",
  costas: "Costas",
  ombro: "Ombro",
  braco: "Braço",
  abdomen: "Abdômen",
  perna: "Pernas",
};

const GRUPO_CATS: Record<string, string[]> = {
  peito: ["peito"],
  costas: ["costas"],
  ombro: ["ombro"],
  braco: ["biceps", "triceps", "antebraco"],
  abdomen: ["abdomen"],
  perna: ["inferiores"],
};

function groupExercises(grupo: string, limit = 6) {
  const ids = GRUPO_CATS[grupo] ?? [];
  return demoLib
    .filter((c) => ids.includes(c.id))
    .flatMap((c) => c.subs.flatMap((s) => s.exercises))
    .slice(0, limit);
}

export function BodyExplorer() {
  const router = useRouter();
  const [view, setView] = useState<"front" | "back">("front");
  const [active, setActive] = useState<MuscleDef | null>(null);

  const visible = MUSCLES.filter((m) => m.view === view);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Biblioteca por músculo</h2>
          <p className="text-[11px] text-muted-foreground">Toque num músculo pra ver os exercícios</p>
        </div>
        {/* Alternar frente/costas */}
        <button
          onClick={() => {
            setActive(null);
            setView((v) => (v === "front" ? "back" : "front"));
          }}
          className="gf-touch tactile flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
          aria-label={`Virar para vista de ${view === "front" ? "costas" : "frente"}`}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          {view === "front" ? "Costas" : "Frente"}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card/70 to-card/30">
        {/* canvas anatômico */}
        <div className="relative mx-auto w-full max-w-[260px]" style={{ aspectRatio: "200 / 369" }}>
          <Image
            src={view === "front" ? "/body/front.svg" : "/body/back.svg"}
            alt={view === "front" ? "Músculos, vista frontal" : "Músculos, vista posterior"}
            fill
            sizes="260px"
            className="object-contain p-2"
            priority={false}
          />
          {/* overlay do músculo ativo (recorte anatômico) */}
          {active && (
            <Image
              key={active.id}
              src={`/body/muscles/main-${active.id}.svg`}
              alt=""
              fill
              sizes="260px"
              className="animate-fade-in object-contain p-2"
            />
          )}

          {/* hotspots */}
          {visible.map((m) => {
            const isActive = active?.id === m.id;
            return (
              <button
                key={`${m.view}-${m.id}`}
                onClick={() => setActive((prev) => (prev?.id === m.id ? null : m))}
                aria-label={`Ver exercícios de ${m.name}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
              >
                <span className="relative flex h-11 w-11 items-center justify-center">
                  <span
                    className={cn(
                      "absolute h-11 w-11 rounded-full transition-colors",
                      isActive ? "bg-brand/25" : "bg-transparent group-active:bg-brand/20"
                    )}
                  />
                  <span
                    className={cn(
                      "relative h-3 w-3 rounded-full ring-2 transition-all",
                      isActive
                        ? "scale-125 bg-brand ring-brand/40"
                        : "bg-brand ring-brand/30 group-hover:bg-brand"
                    )}
                    style={isActive ? undefined : { animation: "pulse-dot 2.4s ease-in-out infinite" }}
                  />
                </span>
              </button>
            );
          })}

          {/* chip do músculo ativo */}
          {active && (
            <div className="animate-fade-in absolute inset-x-2 top-2 flex items-center justify-between gap-2 rounded-xl border border-brand/30 bg-[#0B1426]/90 px-3 py-2 backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-foreground">{active.name}</p>
                <p className="text-[10px] font-semibold text-muted-foreground">{GRUPO_LABEL[active.grupo]} · {groupExercises(active.grupo).length ? "exercícios abaixo" : "catálogo"}</p>
              </div>
              <button
                onClick={() => router.push(`/equipamento?grupo=${active.grupo}`)}
                className="gf-touch shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-black text-brand-foreground"
              >
                Abrir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sheet com exercícios do grupo */}
      <BottomSheet open={!!active} onClose={() => setActive(null)}>
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-foreground">{active.name}</h3>
                <p className="text-xs text-muted-foreground">Grupo {GRUPO_LABEL[active.grupo]}</p>
              </div>
              <button
                onClick={() => router.push(`/equipamento?grupo=${active.grupo}`)}
                className="gf-touch flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-brand"
              >
                Catálogo <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {groupExercises(active.grupo).map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/equipamento?grupo=${active.grupo}`)}
                  className="gf-touch flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{e.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{e.equipment ?? "Exercício livre"}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
