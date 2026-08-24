"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL, formatBRLCompact } from "~/lib/utils/format";

const tickStyle = { fontSize: 9, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

type Datum = Record<string, unknown>;

export function OcupacaoBarChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
        <XAxis dataKey="hora" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="alunos" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReceitaLineChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="mes" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis
          tick={tickStyle}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatBRLCompact(v)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [formatBRL(Number(v)), "Receita"]}
        />
        <Line type="monotone" dataKey="receita" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PesoLineChart({ data, left = -22 }: { data: Datum[]; left?: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left }}>
        <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ ...tickStyle, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} kg`, "Peso"]} />
        <Line
          type="monotone"
          dataKey="peso"
          name="Peso (kg)"
          stroke="var(--brand)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--brand)" }}
          animationBegin={150}
          animationDuration={700}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FrequenciaLineChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -26 }}>
        <Line
          type="monotone"
          dataKey="media"
          name="Média 4 sem"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          animationBegin={250}
          animationDuration={600}
        />
        <Line
          type="monotone"
          dataKey="atual"
          name="Esta semana"
          stroke="var(--brand)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          animationBegin={150}
          animationDuration={700}
        />
        <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VolumeBarChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "rgba(244,113,30,0.08)" }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} kg`, "Volume"]}
        />
        <Bar
          dataKey="volume"
          fill="var(--brand)"
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
          animationBegin={200}
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function areaGradient(id: string) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F4711E" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#F4711E" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

export function PesoAreaChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        {areaGradient("peso")}
        <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="peso" stroke="#F4711E" strokeWidth={2} fill="url(#peso)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CargaAreaChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="carga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#33D17A" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#33D17A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis domain={["dataMin - 4", "dataMax + 4"]} tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="kg" stroke="#33D17A" strokeWidth={2} fill="url(#carga)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
