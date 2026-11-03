"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";
import { cn } from "~/lib/utils";

/**
 * Treino inicial automático: a equipe escolhe quais fichas servem de modelo.
 * Aluno aprovado sem ficha recebe uma cópia do modelo que mais combina
 * (nível, depois nº de dias) e já treina; o personal revisa depois.
 * Regras no banco: migration 073 (assign_starter_plan).
 */

const LEVELS = ["Iniciante", "Intermediário", "Avançado"] as const;

type Program = { id: string; name: string; days: number; exercises: number; inUse: number };
type Template = { id: string; program_id: string; label: string; levels: string[] | null; active: boolean };
type Status = { without_plan: number; medical: number; pending_approval: number };

export default function TreinoInicialPage() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [busyBulk, setBusyBulk] = useState(false);

  const load = useCallback(async () => {
    if (!gymId) return;
    const sb = supabaseBrowser();
    try {
      const [progRes, tplRes, stRes] = await Promise.all([
        sb
          .from("workout_programs")
          .select("id, name, workout_days ( id, workout_exercises ( id ) ), student_workouts ( status )")
          .eq("gym_id", gymId)
          .order("created_at", { ascending: false })
          .limit(200),
        sb.from("starter_templates" as never).select("id, program_id, label, levels, active").eq("gym_id", gymId),
        sb.rpc("starter_plan_status" as never),
      ]);
      if (progRes.error) throw progRes.error;
      type Row = {
        id: string;
        name: string;
        workout_days: Array<{ id: string; workout_exercises: Array<{ id: string }> }>;
        student_workouts: Array<{ status: string }>;
      };
      setPrograms(
        ((progRes.data ?? []) as unknown as Row[])
          .map((p) => ({
            id: p.id,
            name: p.name,
            days: p.workout_days?.length ?? 0,
            exercises: (p.workout_days ?? []).reduce((n, d) => n + (d.workout_exercises?.length ?? 0), 0),
            inUse: (p.student_workouts ?? []).filter((s) => s.status === "active").length,
          }))
          .filter((p) => p.days > 0 && p.exercises > 0)
      );
      setTemplates(((tplRes.data ?? []) as unknown as Template[]) ?? []);
      setStatus((stRes.data as unknown as Status | null) ?? null);
    } catch (err) {
      logger.error("starter_plan.load", err);
      toast.error("Não foi possível carregar os modelos.");
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const templateIds = useMemo(() => new Set(templates.map((t) => t.program_id)), [templates]);
  const candidates = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return programs
      .filter((p) => !templateIds.has(p.id))
      .filter((p) => !f || p.name.toLowerCase().includes(f))
      .sort((a, b) => b.inUse - a.inUse);
  }, [programs, templateIds, filter]);

  const addTemplate = async (p: Program) => {
    if (!gymId) return;
    const { error } = await supabaseBrowser()
      .from("starter_templates" as never)
      .insert({ gym_id: gymId, program_id: p.id, label: p.name, levels: null } as never);
    if (error) {
      logger.error("starter_plan.add", error);
      toast.error("Não foi possível adicionar o modelo.");
      return;
    }
    toast.success(`"${p.name}" agora é modelo inicial.`);
    setAdding(false);
    void load();
  };

  const toggleLevel = async (t: Template, level: string) => {
    const cur = new Set(t.levels ?? []);
    if (cur.has(level)) cur.delete(level);
    else cur.add(level);
    const levels = cur.size ? [...cur] : null;
    setTemplates((ts) => ts.map((x) => (x.id === t.id ? { ...x, levels } : x)));
    const { error } = await supabaseBrowser()
      .from("starter_templates" as never)
      .update({ levels } as never)
      .eq("id", t.id);
    if (error) {
      toast.error("Não foi possível salvar o nível.");
      void load();
    }
  };

  const removeTemplate = async (t: Template) => {
    const { error } = await supabaseBrowser().from("starter_templates" as never).delete().eq("id", t.id);
    if (error) {
      toast.error("Não foi possível remover.");
      return;
    }
    setTemplates((ts) => ts.filter((x) => x.id !== t.id));
  };

  const applyAll = async () => {
    const n = (status?.without_plan ?? 0) - (status?.medical ?? 0);
    if (!window.confirm(`Aplicar o treino inicial para ${n} aluno(s) sem ficha? Cada um recebe aviso no app.`)) return;
    setBusyBulk(true);
    try {
      const { data, error } = await supabaseBrowser().rpc("assign_starter_plans_bulk" as never);
      if (error) throw error;
      const r = data as unknown as { applied: number; skipped: number };
      toast.success(`${r.applied} aluno(s) receberam o treino inicial.`);
      void load();
    } catch (err) {
      logger.error("starter_plan.bulk", err);
      toast.error("Não foi possível aplicar agora.");
    } finally {
      setBusyBulk(false);
    }
  };

  const eligible = Math.max(0, (status?.without_plan ?? 0) - (status?.medical ?? 0));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-brand" />
          Treino inicial automático
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Aluno aprovado sem ficha recebe na hora a cópia do modelo que mais combina com o nível e os dias dele.
          Você recebe um aviso para revisar quando puder. Quem tem risco médico continua só com você.
        </p>
      </header>

      {/* situação */}
      <section className="grid grid-cols-3 gap-2" aria-label="Situação dos alunos">
        <Stat label="Sem ficha" value={status?.without_plan} tone={eligible > 0 ? "warn" : undefined} />
        <Stat label="Avaliação médica" value={status?.medical} />
        <Stat label="Aguardando aprovação" value={status?.pending_approval} />
      </section>

      {eligible > 0 && templates.length > 0 ? (
        <button
          type="button"
          onClick={() => void applyAll()}
          disabled={busyBulk}
          className="tactile flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[13px] font-black text-brand-foreground disabled:opacity-60"
        >
          <Users className="h-4 w-4" />
          {busyBulk ? "Aplicando…" : `Aplicar agora para ${eligible} aluno${eligible === 1 ? "" : "s"} sem ficha`}
        </button>
      ) : null}

      {/* modelos */}
      <section className="rounded-2xl border border-border bg-card/50" aria-label="Modelos iniciais">
        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Modelos iniciais · {templates.length}
          </p>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="tactile flex items-center gap-1 rounded-lg border border-brand/40 px-2.5 py-1 text-[11px] font-bold text-brand"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {loading ? (
          <div className="m-4 h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ) : templates.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted-foreground">
            Nenhum modelo ainda. Toque em <b>Adicionar</b> e escolha 1 a 3 fichas que você já usa
            (ex.: uma de iniciante 3x e uma de 5x). Elas viram o ponto de partida dos alunos novos.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-border/60">
            {templates.map((t) => {
              const p = byId.get(t.program_id);
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p ? `${p.days} dias · ${p.exercises} exercícios` : "ficha removida"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeTemplate(t)}
                      aria-label={`Remover ${t.label} dos modelos`}
                      className="tactile rounded-full p-1.5 text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {LEVELS.map((lv) => {
                      const on = t.levels?.includes(lv) ?? false;
                      return (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => void toggleLevel(t, lv)}
                          className={cn(
                            "tactile flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            on ? "border-brand bg-brand/15 text-foreground" : "border-border text-muted-foreground"
                          )}
                        >
                          {on ? <Check className="h-3 w-3" /> : null}
                          {lv}
                        </button>
                      );
                    })}
                    {!t.levels?.length ? (
                      <span className="self-center text-[10px] text-muted-foreground">serve para qualquer nível</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <div className="border-t border-border/60 px-4 py-3">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar ficha…"
              aria-label="Buscar ficha para virar modelo"
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
            />
            <div className="max-h-72 space-y-1 overflow-auto">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void addTemplate(p)}
                  className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {p.days} dias · {p.exercises} exercícios{p.inUse ? ` · em uso por ${p.inUse}` : ""}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-brand" />
                </button>
              ))}
              {candidates.length === 0 ? (
                <p className="py-2 text-[12px] text-muted-foreground">Nenhuma ficha encontrada.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "warn" }) {
  return (
    <div className={cn("rounded-2xl border bg-card/50 p-3", tone === "warn" ? "border-warning/50" : "border-border")}>
      <p className={cn("text-xl font-black", tone === "warn" ? "text-warning" : "text-foreground")}>{value ?? "–"}</p>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
