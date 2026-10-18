"use client";

import { useState } from "react";
import { BarChart3, Activity, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { formatVolumeKg, formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoRelatorios } from "~/lib/demo-bridge";

type TopAluno = { id: string; name: string; checkins: number };

type RelatoriosData = {
  byDay: { dia: string; checkins: number }[];
  volume: number;
  sessions: number;
  truncated: boolean;
  loadedCheckins: number;
  totalCheckins: number;
  top: TopAluno[];
};

const RANGE_OPTIONS = [7, 30, 90] as const;

// Corte duro de linhas trazidas ao cliente (o servidor também pode limitar);
// quando o count exato mostra mais que isso, a tela avisa em vez de fingir total.
const FETCH_CAP = 5000;
const LOGS_CAP = 2000;

const tickStyle = { fontSize: 9, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

const dayKey = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

function CheckinsDiaChart({ data }: { data: { dia: string; checkins: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="dia"
          tick={tickStyle}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={14}
        />
        <YAxis allowDecimals={false} tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(244,113,30,0.08)" }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => [`${Number(value)} check-ins`, "Entradas"]}
        />
        <Bar dataKey="checkins" name="Check-ins" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Relatórios do gym: presença (check-ins de entrada) e volume total movido
 * no recorte escolhido, com série diária e ranking de alunos.
 */
export default function RelatoriosPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();
  const [days, setDays] = useState<number>(30);

  const { data, loading, error, refetch } = useAsyncQuery<RelatoriosData>(
    async (): Promise<{ data: RelatoriosData | null; error: { message: string } | null }> => {
      if (demo) {
        const r = demoRelatorios() as any;
        const volume = r.byDay.reduce((a: number, d: any) => a + d.volume, 0);
        const sessions = r.byDay.reduce((a: number, d: any) => a + d.checkins, 0);
        return {
          data: {
            byDay: r.byDay.map((d: any) => ({ dia: d.day, checkins: d.checkins })),
            volume,
            sessions,
            truncated: false,
            loadedCheckins: sessions,
            totalCheckins: sessions,
            top: [],
          },
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      // Janela de datas na própria query: nada de puxar a tabela inteira.
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();

      const [cRes, wRes] = await Promise.all([
        supabase
          .from("checkins")
          .select("checked_at, student_id", { count: "exact" })
          .eq("gym_id", profile.gym_id)
          .eq("type", "entrada")
          .gte("checked_at", sinceIso)
          .order("checked_at", { ascending: true })
          .limit(FETCH_CAP),
        supabase
          .from("workout_logs")
          .select("weight_kg, reps")
          .eq("gym_id", profile.gym_id)
          .gte("date", since.toISOString().slice(0, 10))
          .limit(LOGS_CAP),
      ]);
      if (cRes.error) return { data: null, error: cRes.error };
      if (wRes.error) return { data: null, error: wRes.error };

      const rows = (cRes.data ?? []) as Array<{ checked_at: string; student_id: string }>;
      const logs = (wRes.data ?? []) as Array<{ weight_kg: number | null; reps: number | null }>;
      const totalCheckins = cRes.count ?? rows.length;

      const dayKeys: string[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        dayKeys.push(dayKey(d));
      }
      const buckets = new Map<string, number>(dayKeys.map((k) => [k, 0]));
      const byStudent = new Map<string, number>();
      for (const r of rows) {
        const k = dayKey(new Date(r.checked_at));
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
        byStudent.set(r.student_id, (byStudent.get(r.student_id) ?? 0) + 1);
      }

      const topIds = [...byStudent.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);
      const names = new Map<string, string>();
      if (topIds.length) {
        const pRes = await supabase.from("profiles").select("id, name").in("id", topIds);
        if (!pRes.error) {
          for (const p of (pRes.data ?? []) as Array<{ id: string; name: string }>) {
            names.set(p.id, p.name);
          }
        }
      }

      return {
        data: {
          byDay: dayKeys.map((dia) => ({ dia, checkins: buckets.get(dia) ?? 0 })),
          volume: logs.reduce((acc, l) => acc + (l.weight_kg ?? 0) * (l.reps ?? 0), 0),
          sessions: totalCheckins,
          truncated: totalCheckins > rows.length,
          loadedCheckins: rows.length,
          totalCheckins,
          top: topIds.map((id) => ({
            id,
            name: names.get(id) ?? "Aluno",
            checkins: byStudent.get(id) ?? 0,
          })),
        },
        error: null,
      };
    },
    [profile?.id, demo, days]
  );

  const activeDays = (data?.byDay ?? []).filter((d) => d.checkins > 0).length;

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Relatórios</h1>
            <p className="text-xs text-muted-foreground">Últimos {days} dias</p>
          </div>
          <div className="flex gap-1.5">
            {RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`tactile h-8 rounded-full px-3 text-[11px] font-bold transition-colors ${
                  days === d
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data?.byDay ?? []).length === 0 || (data?.sessions ?? 0) === 0 ? (
          <EmptyState
            title={`Sem atividade nos últimos ${days} dias`}
            description="Check-ins e logs de treino alimentam estes relatórios."
            icon={BarChart3}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatCard label="Check-ins" value={formatNumber(data?.sessions ?? 0)} icon={Activity} context={`Entradas (${days}d)`} />
              <StatCard label="Volume" value={formatVolumeKg(data?.volume ?? 0)} icon={BarChart3} context="Carga total" />
              <StatCard label="Dias ativos" value={formatNumber(activeDays)} icon={Users} context="Dias c/ atividade" />
            </div>

            <div className="rounded-2xl border border-border bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5 text-brand" /> Check-ins por dia
                </p>
                <p className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {formatNumber(data?.sessions ?? 0)} no período
                </p>
              </div>
              <div className="h-40">
                <CheckinsDiaChart data={data?.byDay ?? []} />
              </div>
              {data?.truncated ? (
                <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                  Recorte parcial do servidor: o gráfico e o ranking usam {formatNumber(data.loadedCheckins)} check-ins
                  carregados de {formatNumber(data.totalCheckins)} no período.
                </p>
              ) : null}
            </div>

            {(data?.top.length ?? 0) > 0 ? (
              <div className="rounded-2xl border border-border bg-card/50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-brand" /> Top alunos do período
                </p>
                <ol className="mt-3 space-y-1.5">
                  {data?.top.map((t, i) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-xl bg-card/70 px-3 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-black text-brand">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{t.name}</p>
                      <p className="shrink-0 text-[11px] font-bold text-brand">{formatNumber(t.checkins)} check-ins</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
