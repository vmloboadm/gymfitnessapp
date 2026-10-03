"use client";

import type { AdminData, AdminStudent } from "~/lib/admin-data";
import { formatNumber, formatDate, formatRelative } from "~/lib/utils/format";
import { AutoRefresh } from "./AutoRefresh";

/** Barras de uma série diária (14 dias) — sem recharts, CSS puro. */
function Bars({
  data,
  pick,
  tone,
}: {
  data: AdminData["daily"];
  pick: (d: AdminData["daily"][number]) => number;
  tone: string;
}) {
  const max = Math.max(1, ...data.map(pick));
  return (
    <div className="flex h-16 items-end gap-[3px]" aria-hidden>
      {data.map((d, i) => {
        const v = pick(d);
        return (
          <div
            key={i}
            className={`min-h-[3px] flex-1 rounded-t-[3px] ${tone}`}
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            title={`${d.day}: ${v}`}
          />
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-brand/40 bg-brand/[0.07]" : "border-border bg-card/60"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accent ? "text-brand" : "text-foreground"}`}>{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}h`;
}

function StudentRow({ s }: { s: AdminStudent }) {
  const tag = !s.approved
    ? { label: "pendente", cls: "bg-warning/15 text-warning" }
    : s.active7
      ? { label: "ativo", cls: "bg-success/15 text-success" }
      : { label: "parado", cls: "bg-muted text-muted-foreground" };

  const vencido =
    s.vencimento && new Date(s.vencimento + "T12:00:00").getTime() < Date.now();

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{s.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${tag.cls}`}>
          {tag.label}
        </span>
      </div>

      <p className="truncate text-[10px] text-muted-foreground">
        {s.email}
        {s.phone ? ` · ${s.phone}` : ""}
      </p>

      {/* ficha */}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {s.objetivo ? <span className="text-foreground/80">🎯 {s.objetivo}</span> : null}
        {s.nivel ? <span> nível {s.nivel.toLowerCase()}</span> : null}
        {s.plan_type ? <span> plano {s.plan_type}</span> : null}
        {s.vencimento ? (
          <span className={vencido ? "font-semibold text-danger" : ""}>
            vence {formatDate(s.vencimento)}
          </span>
        ) : null}
        {s.weight ? <span>{s.weight} kg</span> : null}
        <span>chegou {formatRelative(s.created_at)}</span>
        <span className="text-brand/80">veio: {s.origin}</span>
      </div>

      {/* atividade */}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
          {s.checkins30} check-ins (30d)
        </span>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
          {s.workouts30} treinos (30d)
        </span>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
          {s.lastCheckin ? `últ. check-in ${formatRelative(s.lastCheckin)}` : "sem check-in"}
        </span>
        {s.lastWorkout ? (
          <span className="rounded-md bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
            úl. treino {formatDate(s.lastWorkout)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Painel interno do dev: QR dos banners, alunos chegando e uso do app.
 * Atualização automática a cada 30s (AutoRefresh) + botão manual.
 */
export function AdminDashboard({ data }: { data: AdminData }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const t = data.totals;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl bg-background px-4 pb-16 pt-5">
      {/* header */}
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">GymFitness · interno</p>
          <h1 className="text-xl font-black text-foreground">Painel do dev</h1>
          <p className="text-xs text-muted-foreground">Atualizado {fmtDay(data.generatedAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AutoRefresh intervalMs={30_000} />
          <form action={`${base}/admin/logout`} method="post">
            <button
              type="submit"
              className="rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* KPIs principais */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumo da semana">
        <Metric label="Scans QR (7d)" value={formatNumber(t.scans7)} sub={`${t.scansToday} hoje · ${t.scans30} em 30d`} accent />
        <Metric label="Alunos novos (7d)" value={formatNumber(t.students7)} sub={`${t.studentsToday} hoje · ${t.students30} no total`} accent />
        <Metric label="Check-ins (7d)" value={formatNumber(t.checkins7)} sub={`${t.checkinsToday} hoje`} />
        <Metric label="Alunos ativos (7d)" value={formatNumber(t.activeStudents7)} sub={`${t.idleStudents} parados`} />
      </section>

      <section className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicadores extras">
        <Metric label="Aguardando aprovação" value={formatNumber(t.pendingApprovals)} sub="alunos novos" />
        <Metric label="Cliques no CTA (7d)" value={formatNumber(t.clicks7)} sub="banners → cadastro" />
        <Metric label="Treinos feitos (7d)" value={formatNumber(t.workouts7)} sub={`${t.aiPlans7} planos gerados pela IA`} />
        <Metric
          label="Vencem em 7 dias"
          value={formatNumber(t.expiringSoon)}
          sub={`${t.withPhone} com telefone no cadastro`}
        />
      </section>

      {/* série diária */}
      <section className="mt-5 rounded-2xl border border-border bg-card/50 p-4" aria-label="Últimos 14 dias">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Últimos 14 dias</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">Alunos novos</p>
            <Bars data={data.daily} pick={(d) => d.students} tone="bg-[#4ADE80]" />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">Scans dos QR</p>
            <Bars data={data.daily} pick={(d) => d.scans} tone="bg-brand" />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">Check-ins</p>
            <Bars data={data.daily} pick={(d) => d.checkins} tone="bg-[#60A5FA]" />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">Treinos feitos</p>
            <Bars data={data.daily} pick={(d) => d.workouts} tone="bg-[#FBBF24]" />
          </div>
        </div>
        <p className="mt-2 flex justify-between text-[9px] text-muted-foreground">
          <span>{data.daily[0]?.day}</span>
          <span>{data.daily[data.daily.length - 1]?.day} (hoje)</span>
        </p>
      </section>

      {/* banners */}
      <section className="mt-4 rounded-2xl border border-border bg-card/50" aria-label="QR dos banners">
        <p className="px-4 pt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          QR dos banners · 30 dias
        </p>
        <div className="mt-2 divide-y divide-border/60">
          {data.banners.map((b) => (
            <div key={b.path} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{b.label}</p>
                <p className="truncate text-[10px] text-muted-foreground">{b.path}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-sm font-black text-foreground">{formatNumber(b.views)}</p>
                  <p className="text-[9px] uppercase text-muted-foreground">scans</p>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">{formatNumber(b.clicks)}</p>
                  <p className="text-[9px] uppercase text-muted-foreground">cliques</p>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">{formatNumber(b.unique)}</p>
                  <p className="text-[9px] uppercase text-muted-foreground">únicos</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.origins.length > 0 ? (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold text-foreground">De onde vieram os alunos (30d)</p>
            <div className="flex flex-wrap gap-1.5">
              {data.origins.map((o) => (
                <span
                  key={o.label}
                  className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-foreground"
                >
                  {o.label} · {o.students}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ficha dos alunos */}
      <section className="mt-4 rounded-2xl border border-border bg-card/50" aria-label="Todos os alunos">
        <div className="flex items-baseline justify-between px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Alunos · {data.students.length}
          </p>
          {t.avgWeight30 ? (
            <p className="text-[10px] text-muted-foreground">peso médio {t.avgWeight30} kg</p>
          ) : null}
        </div>
        {data.students.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum aluno por aqui ainda.</p>
        ) : (
          <div className="mt-2 divide-y divide-border/60">
            {data.students.map((s) => (
              <StudentRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Rota secreta · visível apenas para você · atualiza sozinho a cada 30s
      </p>
    </main>
  );
}
