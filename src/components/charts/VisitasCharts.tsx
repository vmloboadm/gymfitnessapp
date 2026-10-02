"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Gráfico de visitas por dia — chunk separado via next/dynamic (recharts só carrega aqui). */
export default function VisitasCharts({
  byDay,
}: {
  byDay: Array<{ day: string; views: number; clicks: number; conversions: number }>;
}) {
  return (
    <div className="gf-rise rounded-xl border border-border bg-card/50 p-4">
      <p className="mb-3 gf-section">Visitas por dia (14 dias)</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDay} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(244,113,30,0.08)" }}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="views" name="Visitas" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={22} animationBegin={150} animationDuration={700} />
            <Bar dataKey="clicks" name="Cliques" fill="var(--success, #4ADE80)" radius={[4, 4, 0, 0]} maxBarSize={22} animationBegin={250} animationDuration={700} />
            <Bar dataKey="conversions" name="Cadastros" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={22} animationBegin={350} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--brand)]" /> Visitas</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[#4ADE80]" /> Cliques</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground" /> Cadastros</span>
      </div>
    </div>
  );
}
