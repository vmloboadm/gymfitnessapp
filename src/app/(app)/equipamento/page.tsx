"use client";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Lightbulb,
  ChevronDown,
  Dumbbell,
  Nfc,
  ScanLine,
  Play,
  Heart,
  Wind,
  Footprints,
  CircleDot,
  BicepsFlexed,
  Zap,
  Activity,
  Waves,
  ArrowLeft,
} from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import { AiCoach } from "~/components/ai/AiCoachLazy";
import { ImageLightbox } from "~/components/common/ImageLightbox";
import { cn } from "~/lib/utils";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { isDemoMode, demoLib, demoEquipment, demoTreinoData } from "~/lib/demo-bridge";
import type { Equipment } from "~/lib/types/models";
import type { LucideIcon } from "lucide-react";
import type { DemoCategory, DemoExercise, DemoSubCategory } from "~/lib/demo-data";

const CANON: Array<{ id: string; name: string; icon: LucideIcon; cats: string[] }> = [
  { id: "peito", name: "Peito", icon: Heart, cats: ["peito"] },
  { id: "costas", name: "Costas", icon: Wind, cats: ["costas"] },
  { id: "perna", name: "Perna", icon: Footprints, cats: ["inferiores"] },
  { id: "ombro", name: "Ombro", icon: CircleDot, cats: ["ombro"] },
  { id: "braco", name: "Braço", icon: BicepsFlexed, cats: ["biceps", "triceps", "antebraco"] },
  { id: "abdomen", name: "Abdômen", icon: Zap, cats: ["abdomen"] },
  { id: "cardio", name: "Cardio", icon: Activity, cats: ["cardio"] },
  { id: "alongamento", name: "Alongamento", icon: Waves, cats: ["alongamento"] },
];

const PESOS = { id: "pesos", name: "Pesos Livres", icon: Dumbbell };
const ALL_IDS = ["todos", ...CANON.map((c) => c.id), PESOS.id];

// Agrupamento dos exercícios livres por tipo de equipamento
const FREEWEIGHT_GROUPS: Array<{ id: string; name: string; keys: string[] }> = [
  { id: "halteres", name: "Halteres", keys: ["halter"] },
  { id: "barras", name: "Barras", keys: ["barra"] },
  { id: "funcional", name: "Kettlebell / Funcional", keys: ["kettlebell", "corda", "cabo"] },
  { id: "peso-corporal", name: "Peso corporal", keys: ["peso corporal"] },
];

function buildPesosLiberos(demoLib: DemoCategory[], ql: string): DemoCategory | null {
  const all = demoLib.flatMap((c) => c.subs.flatMap((s) => s.exercises));
  const free = all.filter((e) => !e.machineId).filter((e) => !ql || e.name.toLowerCase().includes(ql));
  if (free.length === 0) return null;
  const subs: DemoSubCategory[] = FREEWEIGHT_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    exercises: free.filter((e) => e.tags.some((t) => g.keys.includes(t))),
  })).filter((s) => s.exercises.length > 0);
  const leftovers = free.filter(
    (e) => !subs.some((s) => s.exercises.some((x) => x.id === e.id))
  );
  if (leftovers.length > 0) subs.push({ id: "livres", name: "Livre", exercises: leftovers });
  return { id: "pesos", name: "Pesos Livres", icon: "pesos", subs };
}

export default function EquipamentoPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();
  const [q, setQ] = useState("");
  const [info, setInfo] = useState<DemoExercise | null>(null);
  const [activeCat, setActiveCat] = useState("todos");

  // Deep link do explorador muscular (/equipamento?grupo=peito)
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("grupo");
    if (g && ALL_IDS.includes(g)) {
      setActiveCat(g);
      setOpenCats([g]);
    }
  }, []);
  const [openCats, setOpenCats] = useState<string[]>([]);

  const eqStatus = useMemo(() => {
    const map = new Map<string, string>();
    (demo ? (demoEquipment as Equipment[]) : ([] as Equipment[])).forEach((e) => map.set(e.id, e.status));
    return (id: string) => map.get(id);
  }, [demo]);

  const { loading, error } = useAsyncQuery<{ equipment: Equipment[] }>(
    async () => {
      if (demo) return { data: { equipment: [] as Equipment[] }, error: null };
      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };
      const eqRes = await supabase.from("equipment").select("*").eq("gym_id", profile.gym_id).order("name");
      if (eqRes.error) return { data: null, error: eqRes.error };
      return { data: { equipment: (eqRes.data ?? []) as Equipment[] }, error: null };
    },
    [profile?.id, demo]
  );

  const todayNames = useMemo(() => {
    if (!demo) return new Set<string>();
    const t = demoTreinoData();
    return new Set((t.details ?? []).map((d: any) => d.exercise?.name).filter(Boolean) as string[]);
  }, [demo]);

  const totalExercises = demoLib.reduce((a, c) => a + c.subs.reduce((s, sub) => s + sub.exercises.length, 0), 0);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const catPool =
      activeCat === "todos"
        ? demoLib
        : activeCat === PESOS.id
          ? []
          : demoLib.filter((c) => CANON.find((x) => x.id === activeCat)?.cats.includes(c.id));
    const out = catPool
      .map((cat) => ({
        ...cat,
        subs: cat.subs
          .map((sub) => ({ ...sub, exercises: sub.exercises.filter((e) => !ql || e.name.toLowerCase().includes(ql)) }))
          .filter((sub) => sub.exercises.length > 0),
      }))
      .filter((cat) => cat.subs.length > 0);

    if (activeCat === "todos" || activeCat === PESOS.id) {
      const pesos = buildPesosLiberos(demoLib, ql);
      if (pesos) out.push(pesos);
    }
    return out;
  }, [activeCat, q]);

  const inToday = (e: DemoExercise) => todayNames.has(e.name);

  if (loading) {
    return (
      <>
        <TopBar title="Equipamentos & Exercícios" subtitle="Biblioteca do gym" />
        <div className="space-y-3 p-4"><SkeletonList rows={6} /></div>
        <AiCoach />
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Equipamentos" />
        <div className="p-4"><ErrorState message={error} onRetry={() => {}} /></div>
        <AiCoach />
      </>
    );
  }

  return (
    <>
      {/* Voltar ao fluxo do treino */}
      <div className="px-4 pt-3">
        <Link
          href="/treino"
          className="tactile flex w-full items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand/10 py-2.5 text-[13px] font-bold text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o Treino
        </Link>
      </div>

      <TopBar title="Equipamentos" subtitle={`Catálogo · ${CANON.length} grupos · ${totalExercises} exercícios`} />

      {/* Busca por nome */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar exercício ou aparelho..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Tabs de categoria */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
        {ALL_IDS.map((id) => {
          const meta = CANON.find((c) => c.id === id);
          const pesos = id === PESOS.id ? PESOS : null;
          const Icon = meta?.icon ?? pesos?.icon ?? null;
          const active = activeCat === id;
          return (
            <button
              key={id}
              onClick={() => setActiveCat(id)}
              className={cn(
                "gf-touch flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                active ? "bg-brand text-brand-foreground" : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {id === "todos" ? "Todos" : meta?.name ?? pesos?.name ?? ""}
            </button>
          );
        })}
      </div>

      {/* Lista por categorias (accordion) */}
      <div className="space-y-2 p-4 pt-3">
        {demo && filtered.length === 0 ? (
          <EmptyState title="Nada encontrado" description="Tente outro termo de busca." icon={Search} />
        ) : (
          <CategoryAccordion
            cats={filtered}
            onInfo={(e) => setInfo(e)}
            inToday={inToday}
            eqStatus={eqStatus}
            open={openCats}
            onOpenChange={setOpenCats}
          />
        )}
      </div>

      {info && <InfoSheet ex={info} onClose={() => setInfo(null)} />}
      <AiCoach />
    </>
  );
}

function CategoryAccordion({
  cats,
  onInfo,
  inToday,
  eqStatus,
  open,
  onOpenChange,
}: {
  cats: DemoCategory[];
  onInfo: (e: DemoExercise) => void;
  inToday: (e: DemoExercise) => boolean;
  eqStatus: (id: string) => string | undefined;
  open: string[];
  onOpenChange: (v: string[]) => void;
}) {
  return (
    <Accordion.Root type="multiple" value={open} onValueChange={onOpenChange} className="space-y-2">
      {cats.map((cat) => {
        return (
          <Accordion.Item key={cat.id} value={cat.id} className="gf-card gf-glass overflow-hidden !p-0">
            <Accordion.Header>
              <Accordion.Trigger className="gf-touch flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none [&[data-state=open]>svg]:rotate-180">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B1426]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/group-images/${cat.id}.webp`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </span>
                <span className="gf-card-title flex-1">{cat.name}</span>
                <span className="gf-hero-num flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-1.5 text-[11px]">
                  {cat.subs.reduce((s, sub) => s + sub.exercises.length, 0)}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="space-y-3 px-4 pb-4">
                {cat.subs.map((sub) => (
                  <div key={sub.id}>
                    <p className="gf-section mb-1.5">{sub.name}</p>
                    <div className="space-y-1.5">
                      {sub.exercises.map((e) => (
                        <ExerciseRow key={e.id} e={e} onInfo={onInfo} inToday={inToday(e)} eqStatus={eqStatus} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}

function ExerciseRow({
  e,
  onInfo,
  inToday,
  eqStatus,
}: {
  e: DemoExercise;
  onInfo: (e: DemoExercise) => void;
  inToday: boolean;
  eqStatus: (id: string) => string | undefined;
}) {
  const [zoom, setZoom] = useState(false);
  const status = e.machineId ? eqStatus(e.machineId) : undefined;
  const maintenance = status === "maintenance";
  const active = status && status !== "maintenance";

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors", inToday ? "border-brand/45 bg-brand-soft/20" : "border-border bg-card/40")}>
      {e.imageUrl ? (
        <button
          onClick={(ev) => {
            ev.stopPropagation();
            setZoom(true);
          }}
          aria-label={`Ampliar ilustração de ${e.name}`}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.imageUrl ?? ""} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        </button>
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FitnessIcon glyph={fitnessForName(e.name)} size={24} />
        </span>
      )}
      <ImageLightbox src={zoom ? e.imageUrl ?? null : null} alt={e.name} open={zoom} onClose={() => setZoom(false)} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">
          {e.name}
          {inToday ? (
            <Badge variant="success" className="ml-1.5 gap-1 !px-1.5 !py-0 !text-[9px]">
              <Play className="h-2.5 w-2.5" /> no treino de hoje
            </Badge>
          ) : null}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {e.machineId ? (
            <span className="flex items-center gap-1 text-brand">
              <Nfc className="h-3 w-3" /> NFC/QR
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Dumbbell className="h-3 w-3" /> Livre
            </span>
          )}
          {e.equipment ? <span className="flex items-center gap-1">{e.equipment}</span> : null}
        </div>
      </div>
      {e.machineId ? (
        maintenance ? (
          <Badge variant="warning" className="gap-1.5 !px-2 !py-0.5 !text-[9px]">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Manutenção
          </Badge>
        ) : active ? (
          <Badge variant="success" className="gap-1.5 !px-2.5 !py-0.5 !text-[9px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ativo
          </Badge>
        ) : null
      ) : null}
      <button
        onClick={() => onInfo(e)}
        className="gf-touch flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        aria-label={`Como executar ${e.name}`}
      >
        <Lightbulb className="h-4 w-4" />
      </button>
    </div>
  );
}

function InfoSheet({ ex, onClose }: { ex: DemoExercise; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
    <ImageLightbox src={zoom ? ex.imageUrl ?? null : null} alt={ex.name} open={zoom} onClose={() => setZoom(false)} />
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-background p-5 pb-8 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
              <FitnessIcon glyph={fitnessForName(ex.name)} size={28} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-foreground">{ex.name}</h3>
              {ex.equipment ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Dumbbell className="h-3 w-3" /> Aparelho: {ex.equipment}
                </p>
              ) : (
                <p className="text-xs italic text-muted-foreground">Exercício livre</p>
              )}
            </div>
          </div>
          <button className="gf-touch flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground" onClick={onClose} aria-label="Fechar">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* ilustração do exercício, clicável pra ampliar */}
        {ex.imageUrl ? (
          <button
            onClick={() => setZoom(true)}
            aria-label={`Ampliar ilustração de ${ex.name}`}
            className="gf-touch relative mt-4 block h-48 w-full cursor-zoom-in overflow-hidden rounded-2xl border border-white/[0.06] bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ex.imageUrl} alt={`Execução de ${ex.name}`} loading="lazy" decoding="async" className="h-full w-full object-contain" />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white">ampliar 🔍</span>
          </button>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ex.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-brand/20 bg-brand-soft/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
            <Lightbulb className="h-3.5 w-3.5" /> Como executar
          </p>
          <p className="gf-card-text mt-1 text-foreground">{ex.info}</p>
        </div>

        {ex.machineId ? (
          <Link
            href="/checkin"
            onClick={onClose}
            className="gf-touch mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25"
          >
            <ScanLine className="h-4 w-4" /> Escanear & iniciar neste aparelho
          </Link>
        ) : (
          <Link
            href="/treino"
            onClick={onClose}
            className="gf-touch mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand-soft/20 py-3 text-sm font-bold text-brand"
          >
            <Play className="h-4 w-4" /> Adicionar ao treino sem aparelho
          </Link>
        )}
      </div>
    </div>
    </>
  );
}