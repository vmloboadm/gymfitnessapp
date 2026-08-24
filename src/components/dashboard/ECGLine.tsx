"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { useReducedMotion } from "~/hooks/useReducedMotion";

type DayVolume = { key: string; level: number; today: boolean };

const PEAKS = [
  // formas QRS (oito padrões de batimento) — varrem de -x a x alinhadas
  { pos: 0.08, w: 0.16, a: 0.42 },
  { pos: 0.24, w: 0.13, a: 0.3 },
  { pos: 0.41, w: 0.15, a: 0.38 },
  { pos: 0.58, w: 0.12, a: 0.28 },
  { pos: 0.74, w: 0.16, a: 0.4 },
  { pos: 0.9, w: 0.14, a: 0.32 },
];

/** Gera a trilha ECG contínua (viewBox 0 0 100 40). */
export function ecgPath(seed = 0): string {
  const base = 20;
  const points: string[] = [`M 0 ${base}`];
  PEAKS.forEach((p, i) => {
    const cx = p.pos * 100;
    const amp = p.a * seedRe(seed + i) + 6; // 6..14 de amplitude
    // pequena condição de fluxo (Q dip) antes do pico R
    const start = cx - p.w * 28;
    points.push(`L ${start + 2} ${base} Q ${start + 3} ${base + 4} ${start + 6} ${base}`);
    points.push(`L ${start + 9} ${base} L ${cx - 2.5} ${base}`);
    // subida R
    points.push(`Q ${cx - 1.5} ${base} ${cx} ${base - amp}`);
    // descida S
    points.push(`Q ${cx + 1.5} ${base} ${cx + 2.5} ${base}`);
    points.push(`L ${cx + 4} ${base} Q ${cx + 5} ${base + 2.5} ${cx + 6.2} ${base}`);
    // toe
    points.push(`L ${cx + p.w * 16} ${base}`);
  });
  points.push(`L 100 ${base}`);
  return points.join(" ");
}

function seedRe(n: number) {
  const s = Math.sin(n * 999.7) * 10000;
  return s - Math.floor(s); // 0..1 determinístico
}

/**
 * Linha de ECG — trilha desenhada em loop (stroke-dashoffset), estilo monitor.
 * Sem números crus: dias são células de cor de intensidade com bout de hoje.
 */
export function ECGLine({
  days,
  className,
  height = 56,
}: {
  days: DayVolume[];
  className?: string;
  height?: number;
}) {
  const path = useMemo(() => ecgPath(0), []);
  const reduced = useReducedMotion();

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
        <defs>
          <linearGradient id="ecg-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4ADE80" stopOpacity="0.25" />
            <stop offset="0.3" stopColor="#4ADE80" />
            <stop offset="0.85" stopColor="#4ADE80" stopOpacity="0.9" />
            <stop offset="1" stopColor="#4ADE80" stopOpacity="0.15" />
          </linearGradient>
          <filter id="ecg-blur" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* linha base */}
        <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(74,222,128,0.12)" strokeWidth="0.6" strokeDasharray="3 4" />

        {/* glow */}
        <path
          d={path}
          fill="none"
          stroke="url(#ecg-fade)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ecg-blur)"
          opacity="0.55"
        />

        {/* trilha principal animada (loop contínuo; estático em motion reduzido) */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#ecg-fade)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={reduced ? "none" : "200 200"}
          initial={{ strokeDashoffset: 0 }}
          animate={reduced ? undefined : { strokeDashoffset: -400 }}
          transition={{ duration: 6, repeat: reduced ? 0 : Infinity, ease: "linear" }}
        />

        {/* varredura vertical */}
        {reduced ? null : (
          <motion.rect
            x="0"
            y="0"
            width="2.4"
            height="40"
            fill="url(#ecg-fade)"
            opacity="0.5"
            animate={{ x: [0, 100] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        )}
      </svg>

      {/* células de intensidade da semana — só cor, sem números */}
      <div className="mt-1.5 grid grid-cols-7 gap-1.5" role="img" aria-label="Intensidade dos treinos da semana">
        {days.map((d) => {
          return (
            <div key={d.key} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  d.today
                    ? "bg-[#FF6F16] shadow-[0_0_8px_rgba(255,111,22,0.6)]"
                    : d.level === 0
                      ? "bg-white/[0.06]"
                      : d.level <= 2
                        ? "bg-[#4ADE80]/45"
                        : "bg-[#4ADE80]"
                )}
              />
              <span className={cn("h-2.5 w-2.5 rounded-full", d.today ? "bg-[#FF6F16]" : d.level === 0 ? "bg-white/[0.08]" : "bg-[#4ADE80]/70")} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mini ECG — pulso contínuo para o card de batimento (LivePulse/hero). */
export function MiniEcg({ className, height = 20 }: { className?: string; height?: number }) {
  const path = useMemo(() => ecgPath(3), []);
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={cn("block w-full", className)} style={{ height }}>
      <motion.path
        d={path}
        fill="none"
        stroke="#F3F6FC"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={reduced ? "none" : "200 200"}
        initial={{ strokeDashoffset: 0 }}
        animate={reduced ? undefined : { strokeDashoffset: -400 }}
        transition={{ duration: 5, repeat: reduced ? 0 : Infinity, ease: "linear" }}
        style={{ filter: "drop-shadow(0 0 3px rgba(255,111,22,0.9))" }}
      />
    </svg>
  );
}