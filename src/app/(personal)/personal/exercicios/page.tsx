"use client";

import { useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Search,
  Library,
  MoreVertical,
  BookOpen,
  Wrench,
  Pencil,
  Dumbbell,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Input } from "~/components/ui/input";
import {
  ExerciseInfoSheet,
  type ExerciseDetail,
} from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { ImageLightbox } from "~/components/common/ImageLightbox";
import { isDemoMode, demoLib, demoEquipment } from "~/lib/demo-bridge";
import { readLibraryEdits, saveLibraryEdit } from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] } },
};

type LibExercise = {
  id: string;
  name: string;
  category: string;
  group: string;
  imageUrl: string | null;
  tips: string[] | null;
  muscles: string[] | null;
};

/**
 * Biblioteca de exercícios do Personal, na mesma organização do aluno:
 * chips de grupo com scroll-snap, busca, thumbs idênticas e ações de gestão.
 */
export default function PersonalExerciciosPage() {
  const demo = isDemoMode();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const [sheet, setSheet] = useState<LibExercise | null>(null);
  const [ficha, setFicha] = useState<ExerciseDetail | null>(null);
  const [renaming, setRenaming] = useState("");
  const [linking, setLinking] = useState("");
  const [version, setVersion] = useState(0); // re-render após editar (localStorage)

  const all = useMemo<LibExercise[]>(() => {
    void version;
    const edits = demo ? readLibraryEdits() : {};
    return demoLib
      .flatMap((c) =>
        c.subs.flatMap((sub) =>
          sub.exercises.map((e) => ({
            id: e.id,
            name: edits[e.id]?.name ?? e.name,
            category: c.id,
            group: c.name,
            imageUrl: (e as { imageUrl?: string | null }).imageUrl ?? null,
            tips: e.info ? [e.info] : null,
            muscles: e.tags ?? null,
          }))
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [demo, version]);

  const cats = useMemo(
    () => [...demoLib].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const filtered = all.filter((e) => {
    const matchQ = !q || e.name.toLowerCase().includes(q.trim().toLowerCase());
    const matchCat = cat === "all" || e.category === cat;
    return matchQ && matchCat;
  });

  const openActions = (e: LibExercise) => {
    setSheet(e);
    setRenaming(e.name);
    setLinking("");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Library className="h-5 w-5 text-brand" />
          Exercícios
        </h1>
        <p className="text-[11px] text-muted-foreground">
          {all.length} exercícios · mesma biblioteca do aluno
        </p>
      </header>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar exercício por nome..."
          aria-label="Buscar exercício"
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </div>

      {/* Chips de grupo (scroll-snap) */}
      <div
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1"
        role="tablist"
        aria-label="Filtrar por grupo muscular"
      >
        {[{ id: "all", name: "Todos" }, ...cats].map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              "shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              cat === c.id
                ? "border-brand bg-brand text-brand-foreground"
                : "border-white/[0.06] bg-white/[0.03] text-muted-foreground hover:text-foreground"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center">
          <Library className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum exercício encontrado. Ajuste a busca ou o filtro.
          </p>
        </div>
      ) : (
        <motion.ul variants={container} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((e) => (
            <motion.li key={e.id} variants={row}>
              <div className="gf-card gf-glass flex items-center gap-3 !rounded-2xl !p-3">
                {e.imageUrl ? (
                  <button
                    onClick={() => setZoom({ src: e.imageUrl as string, name: e.name })}
                    aria-label={`Ampliar ilustração de ${e.name}`}
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <FitnessIcon glyph={fitnessForName(e.name)} size={26} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">
                      {e.name}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {e.group}
                    </Badge>
                  </div>
                  {e.tips?.length ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{e.tips[0]}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => openActions(e)}
                  aria-label={`Ações para ${e.name}`}
                  className="tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {/* Ações do exercício */}
      <BottomSheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/25 bg-brand/10">
                <Dumbbell className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">{sheet.name}</p>
                <p className="text-[11px] text-muted-foreground">{sheet.group}</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setFicha({ name: sheet.name, info: null, tips: sheet.tips, imageUrl: sheet.imageUrl });
                  setSheet(null);
                }}
                className="tactile flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 text-left transition-transform active:scale-[0.985]"
              >
                <BookOpen className="h-4.5 w-4.5 text-brand" />
                <p className="flex-1 text-[13px] font-semibold text-foreground">Ver ficha completa</p>
              </button>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Pencil className="h-3.5 w-3.5" /> Renomear
                </p>
                <div className="flex gap-2">
                  <Input
                    value={renaming}
                    onChange={(e) => setRenaming(e.target.value)}
                    className="h-10 text-[13px]"
                    aria-label="Novo nome do exercício"
                  />
                  <button
                    onClick={() => {
                      if (renaming.trim() && renaming.trim() !== sheet.name) {
                        saveLibraryEdit(sheet.id, { name: renaming.trim() });
                        setVersion((v) => v + 1);
                        toast.success("Exercício renomeado");
                      }
                      setSheet(null);
                    }}
                    className="tactile h-10 shrink-0 rounded-xl bg-brand px-4 text-[11px] font-bold text-brand-foreground transition-transform active:scale-[0.96]"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" /> Vincular aparelho
                </p>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {demoEquipment.slice(0, 6).map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => setLinking(eq.name)}
                      aria-pressed={linking === eq.name}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                        linking === eq.name
                          ? "border-brand bg-brand/15 text-brand"
                          : "border-border bg-card/50 text-muted-foreground"
                      )}
                    >
                      {eq.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (linking) {
                      saveLibraryEdit(sheet.id, { equipment: linking });
                      setVersion((v) => v + 1);
                      toast.success(`Vinculado a ${linking}`);
                    }
                    setSheet(null);
                  }}
                  className="tactile mt-2 h-10 w-full rounded-xl bg-secondary text-[12px] font-bold text-secondary-foreground transition-transform active:scale-[0.98]"
                >
                  {linking ? `Vincular a ${linking}` : "Selecione um aparelho"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <ExerciseInfoSheet ex={ficha} onClose={() => setFicha(null)} />
      <ImageLightbox src={zoom?.src ?? null} alt={zoom?.name} open={!!zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
