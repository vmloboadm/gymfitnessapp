"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function PerfilWeightArea({ data }: { data: Array<{ label: string; peso: number }> }) {
  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="pf-weight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F4711E" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#F4711E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8B95A9" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v} kg`, "Peso"]} />
          <Area type="monotone" dataKey="peso" stroke="#F4711E" strokeWidth={2.5} fill="url(#pf-weight)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
