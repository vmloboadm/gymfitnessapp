"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Gráficos do Progresso — chunk separado via next/dynamic (recharts só carrega aqui). */
export default function ProgressoCharts({
  freqCompare,
  volumeChart,
  sessionsThisWeek,
}: {
  freqCompare: Array<{ day: string; atual: number; media: number }>;
  volumeChart: Array<{ day: string; volume: number }>;
  sessionsThisWeek: number;
}) {
  return (
    <>
      <div className="gf-rise rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="hero-live-dot" />
            Frequência da semana
          </p>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={freqCompare} margin={{ top: 4, right: 6, bottom: 0, left: -26 }}>
              <Line type="monotone" dataKey="media" name="Média 4 sem" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationBegin={250} animationDuration={600} />
              <Line type="monotone" dataKey="atual" name="Esta semana" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={150} animationDuration={700} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="gf-rise rounded-xl border border-border bg-card/40 p-4">
        <p className="mb-3 gf-section">Volume diário (kg)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={volumeChart}>
            <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(244,113,30,0.08)" }}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value: any) => [`${Number(value).toLocaleString("pt-BR")} kg`, "Volume"]}
            />
            <Bar dataKey="volume" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={22} animationBegin={200} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {sessionsThisWeek} {sessionsThisWeek === 1 ? "sessão" : "sessões"} na semana · Volume = carga × repetições somadas do dia.
        </p>
      </div>
    </>
  );
}
