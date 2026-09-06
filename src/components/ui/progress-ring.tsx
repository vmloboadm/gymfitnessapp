"use client";

import { m } from "framer-motion";

/**
 * Elemento de assinatura GymFitness (manual de marca v1):
 * anel de progresso circular + núcleo laranja, como um disco de anilha.
 * Preenche conforme progresso real por trás (streak, descanso, meta).
 */
export function ProgressRing({
  value,
  label,
  size = 72,
  strokeWidth = 6,
  tone = "accent",
  showLabel = true,
}: {
  value: number; // 0–100
  label?: string;
  size?: number;
  strokeWidth?: number;
  tone?: "accent" | "success";
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = tone === "success" ? "var(--success)" : "var(--accent)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-label={label ? `${clamped}%` : undefined}>
      {/* núcleo laranja, centro de energia */}
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: size * 0.26,
          height: size * 0.26,
          background: color,
          opacity: 0.9,
          boxShadow: `0 0 12px ${color}66`,
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={strokeWidth}
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </svg>
      {showLabel && (
        <span className="absolute font-mono text-[11px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {label ?? `${Math.round(clamped)}%`}
        </span>
      )}
    </div>
  );
}