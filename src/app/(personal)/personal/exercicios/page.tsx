"use client";

import { useMemo, useState } from "react";
import type { Variants } from "framer-motion";
import {
  Search,
  Library,
  MoreVertical,
  Play,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { isDemoMode, demoLib } from "~/lib/demo-bridge";
import { curatedSearch } from "~/lib/exercises-database";
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
  const [detail, setDetail] = useState<LibExercise | null>(null);
  const [renaming, setRenaming] = useState("");
  const [editingName, setEditingName] = useState(false);
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

  const openDetail = (e: LibExercise) => {
    setDetail(e);
    setRenaming(e.name);
    setEditingName(false);
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => openDetail(e)}
                onKeyDown={(ev) => { if (ev.key === "Enter") openDetail(e); }}
                aria-label={`Detalhes de ${e.name}`}
                className="gf-card gf-glass flex cursor-pointer items-center gap-3 !rounded-2xl !p-3 transition-transform active:scale-[0.985]"
              >
                {e.imageUrl ? (
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  </span>
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
                  onClick={(ev) => { ev.stopPropagation(); openDetail(e); }}
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

      {/* Modal de detalhes: sheet glass deslizando de baixo */}
      <AnimatePresence>
        {detail ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${detail.name}`}
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-white/[0.08] bg-[#050507]/90 pb-9 backdrop-blur-xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="relative">
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
                <button
                  onClick={() => setDetail(null)}
                  aria-label="Fechar"
                  className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 pt-3">
                {/* Ilustração completa (object-contain, sem corte) */}
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white">
                  {detail.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.imageUrl}
                      alt={`Ilustração de ${detail.name}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <FitnessIcon glyph={fitnessForName(detail.name)} size={72} />
                  )}
                </div>

                {/* Nome + grupo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold leading-tight text-foreground">{detail.name}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {detail.group}
                    </Badge>
                  </div>
                </div>

                {detail.tips?.length ? (
                  <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[12px] leading-snug text-muted-foreground">
                    {detail.tips[0]}
                  </p>
                ) : null}

                {/* Ações funcionais */}
                <div className="grid grid-cols-1 gap-2">
                  <a
                    href={curatedSearch(detail.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="tactile flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-[13px] font-bold text-brand-foreground transition-transform active:scale-[0.97]"
                  >
                    <Play className="h-4.5 w-4.5" />
                    Ver Vídeo no YouTube
                  </a>

                  {editingName ? (
                    <div className="flex gap-2">
                      <input
                        value={renaming}
                        onChange={(ev) => setRenaming(ev.target.value)}
                        autoFocus
                        aria-label="Novo nome do exercício"
                        className="h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                      />
                      <button
                        onClick={() => {
                          if (renaming.trim() && renaming.trim() !== detail.name) {
                            saveLibraryEdit(detail.id, { name: renaming.trim() });
                            setVersion((v) => v + 1);
                            toast.success("Exercício renomeado");
                          }
                          setEditingName(false);
                          setDetail(null);
                        }}
                        className="tactile h-12 shrink-0 rounded-2xl bg-secondary px-5 text-[12px] font-bold text-secondary-foreground transition-transform active:scale-[0.96]"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingName(true)}
                      className="tactile flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[13px] font-bold text-foreground transition-transform active:scale-[0.97]"
                    >
                      <Pencil className="h-4 w-4 text-brand" />
                      Editar Exercício
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
