"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function MetricasWeightChart({ data }: { data: Array<{ label: string; peso: number }> }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand)" }} animationBegin={150} animationDuration={700} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v} kg`, "Peso"]} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
