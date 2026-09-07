"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Dumbbell, Clock3, Route, Weight, Plus, History, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { AiCoach } from "~/components/ai/AiCoachLazy";
import { cn } from "~/lib/utils";
import { isDemoMode } from "~/lib/demo-bridge";
import type { Equipment } from "~/lib/types/models";

type MachineExercise = { id: string; name: string; category: string };
type MachineHistory = {
  id: string;
  started_at: string;
  ended_at: string | null;
  meta: { duration_min?: number; distance_km?: number; load_kg?: number; note?: string } | null;
};

const CARDIO_CATS = ["cardio"];

/**
 * Biblioteca de máquinas: detalhe do aparelho.
 * Mostra exercícios que usam o aparelho, histórico do aluno
 * (tempo, distância, carga) e permite adicionar o histórico de hoje.
 * Cada chip de exercício/aparelho navega entre si.
 */
export default function MaquinaPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const { user, profile } = useAuth();
  const demo = isDemoMode();
  const [logOpen, setLogOpen] = useState(false);

  const { data, loading, error, refetch } = useAsyncQuery<{
    machine: Equipment;
    exercises: MachineExercise[];
    history: MachineHistory[];
  }>(async () => {
    if (demo) return { data: { machine: null as never, exercises: [], history: [] }, error: null };
    const sb = supabaseBrowser();
    if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };
    const [{ data: mach, error: mErr }, { data: exs }, { data: hist }] = await Promise.all([
      sb.from("equipment").select("*").eq("id", id).eq("gym_id", profile.gym_id).maybeSingle(),
      sb.from("exercises").select("id, name, category").eq("equipment_id", id).order("name").limit(30),
      sb
        .from("equipment_sessions")
        .select("id, started_at, ended_at, meta")
        .eq("student_id", user.id)
        .eq("equipment_id", id)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    if (mErr || !mach) return { data: null, error: { message: "Aparelho não encontrado" } };
    return {
      data: {
        machine: mach as Equipment,
        exercises: (exs ?? []) as MachineExercise[],
        history: (hist ?? []) as MachineHistory[],
      },
      error: null,
    };
  }, [id, user?.id, profile?.gym_id, demo]);

  const isCardio = useMemo(
    () => (data?.machine ? CARDIO_CATS.includes(data.machine.category) : false),
    [data?.machine]
  );

  if (loading) {
    return (
      <>
        <TopBar title="Aparelho" subtitle="Carregando..." />
        <div className="space-y-3 p-4"><SkeletonList rows={4} /></div>
        <AiCoach />
      </>
    );
  }

  if (error || !data?.machine) {
    return (
      <>
        <TopBar title="Aparelho" />
        <div className="p-4"><ErrorState message={error ?? "Aparelho não encontrado"} onRetry={() => router.back()} /></div>
        <AiCoach />
      </>
    );
  }

  const m = data.machine;

  return (
    <>
      <div className="px-4 pt-3">
        <button
          onClick={() => router.back()}
          className="tactile flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>
      <TopBar title={m.name} subtitle={`Aparelho · ${m.category}`} />

      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        {/* cartão do aparelho */}
        <div className="gf-card gf-glass relative overflow-hidden !p-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-[#FFC24D]" aria-hidden />
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/25">
              <Dumbbell className="h-5 w-5 text-brand-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-black text-foreground">{m.name}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{m.category}</p>
            </div>
            <span className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
              m.status === "available" && "bg-[#4ADE80]/15 text-[#4ADE80]",
              m.status === "in_use" && "bg-[#FFC24D]/15 text-[#FFC24D]",
              m.status === "maintenance" && "bg-[#F87171]/15 text-[#F87171]",
              m.status === "pending" && "bg-white/[0.07] text-muted-foreground"
            )}>
              {m.status === "available" ? "Livre" : m.status === "in_use" ? "Em uso" : m.status === "maintenance" ? "Manutenção" : "Em breve"}
            </span>
          </div>
          <button
            onClick={() => setLogOpen(true)}
            className="tactile mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Adicionar meu histórico de hoje
          </button>
        </div>

        {/* exercícios neste aparelho */}
        <section aria-label="Exercícios neste aparelho">
          <h2 className="mb-2 text-sm font-bold text-foreground">Exercícios neste aparelho</h2>
          {data.exercises.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[11.5px] text-muted-foreground">
              Nenhum exercício vinculado ainda. O personal vincula na montagem do treino.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.exercises.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/equipamento?busca=${encodeURIComponent(e.name)}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-brand/30"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                      <Dumbbell className="h-3.5 w-3.5 text-brand" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{e.name}</p>
                      <p className="text-[10px] capitalize text-muted-foreground">{e.category}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* histórico do aluno */}
        <section aria-label="Meu histórico neste aparelho">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <History className="h-4 w-4 text-brand" /> Meu histórico aqui
          </h2>
          {data.history.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[11.5px] text-muted-foreground">
              Nada registrado ainda. Toque em adicionar para salvar o treino de hoje.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.history.map((h) => (
                <li key={h.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[11px] font-bold text-foreground">
                    {new Date(h.started_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] font-semibold text-muted-foreground">
                    {typeof h.meta?.duration_min === "number" ? (
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {h.meta.duration_min} min</span>
                    ) : null}
                    {typeof h.meta?.distance_km === "number" ? (
                      <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" /> {h.meta.distance_km} km</span>
                    ) : null}
                    {typeof h.meta?.load_kg === "number" ? (
                      <span className="inline-flex items-center gap-1"><Weight className="h-3 w-3" /> {h.meta.load_kg} kg</span>
                    ) : null}
                  </div>
                  {h.meta?.note ? <p className="mt-1 text-[11px] italic text-muted-foreground">“{h.meta.note}”</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {logOpen ? (
        <LogHistorySheet
          machine={m}
          isCardio={isCardio}
          gymId={profile?.gym_id ?? ""}
          userId={user?.id ?? ""}
          userName={profile?.name ?? "Você"}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); refetch(); }}
        />
      ) : null}
      <AiCoach />
    </>
  );
}

/** Form rápido: tempo + distância/carga + nota → sessão concluída com meta. */
function LogHistorySheet({ machine, isCardio, gymId, userId, userName, onClose, onSaved }: {
  machine: Equipment;
  isCardio: boolean;
  gymId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [minutes, setMinutes] = useState<string>("30");
  const [distance, setDistance] = useState<string>("");
  const [load, setLoad] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = async () => {
    if (!gymId || !userId || saving) return;
    const mins = Math.max(1, Math.min(600, Number(minutes) || 0));
    if (!mins) { toast.error("Informe o tempo"); return; }
    setSaving(true);
    try {
      const sb = (await import("~/lib/supabase/client")).supabaseBrowser();
      const meta: Record<string, number | string> = { duration_min: mins, logged_by: userName };
      const dist = Number(String(distance).replace(",", "."));
      if (isCardio && dist > 0) meta.distance_km = Math.round(dist * 100) / 100;
      if (!isCardio) {
        const kg = Number(String(load).replace(",", "."));
        if (kg > 0) meta.load_kg = kg;
      }
      if (note.trim()) meta.note = note.trim().slice(0, 220);
      const now = new Date();
      const { error } = await sb.from("equipment_sessions").insert({
        gym_id: gymId,
        equipment_id: machine.id,
        student_id: userId,
        status: "completed",
        type: "regular",
        started_at: new Date(now.getTime() - mins * 60000).toISOString(),
        ended_at: now.toISOString(),
        meta,
      } as never);
      if (error) throw new Error(error.message);
      toast.success("Histórico salvo!", { description: `${machine.name} · ${mins} min` });
      navigator.vibrate?.([40, 30, 60]);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Adicionar histórico">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-border bg-background p-5 pb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{machine.name}</p>
        <h3 className="mt-0.5 text-lg font-black text-foreground">Meu histórico de hoje</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock3 className="h-3 w-3" /> Tempo (min)
            </span>
            <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric"
              aria-label="Tempo em minutos"
              className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
          </label>
          {isCardio ? (
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Route className="h-3 w-3" /> Distância (km)
              </span>
              <input value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 6))} inputMode="decimal"
                aria-label="Distância em quilômetros" placeholder="ex. 3,5"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Weight className="h-3 w-3" /> Carga (kg)
              </span>
              <input value={load} onChange={(e) => setLoad(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 6))} inputMode="decimal"
                aria-label="Carga em quilos" placeholder="ex. 40"
                className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
            </label>
          )}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 220))} rows={2} maxLength={220}
          placeholder="Nota (opcional)"
          aria-label="Nota sobre o uso"
          className="mt-2 w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
        <button onClick={save} disabled={saving}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40">
          <CheckCircle2 className="h-4 w-4" strokeWidth={3} /> {saving ? "Salvando..." : "Salvar histórico"}
        </button>
      </div>
    </div>
  );
}
