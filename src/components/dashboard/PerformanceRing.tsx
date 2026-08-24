"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReduced()) {
      setVal(target);
      return;
    }
    let start: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const STROKE = 9;

/** Anel da meta semanal, traço fino estilo Apple Fitness.
    Inicia no topo (12h) e preenche no sentido ANTI-HORÁRIO (sweep-flag=0).
    Gradiente sutil ao longo do arco + glow suave (cópia desfocada sob o traço). */
export function PerformanceRing({ done, goal }: { done: number; goal: number }) {
  const pct = Math.min(1, done / goal);
  const r = 100;
  const c = 115;
  const val = useCountUp(done);
  const doneGoal = done >= goal;

  // Ponto de início no topo, arco cresce anti-horário.
  const theta = pct * 2 * Math.PI;
  const startX = c;
  const startY = c - r;
  const endX = c - r * Math.sin(theta);
  const endY = c - r * Math.cos(theta);
  const largeArc = pct > 0.5 ? 1 : 0;
  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}`;

  const gradientId = doneGoal ? "pm-ringdone" : "pm-ringprog";

  return (
    <div className="relative h-full w-full sm:h-[184px] sm:w-[184px] md:h-[208px] md:w-[208px] lg:h-[224px] lg:w-[224px]">
      <svg viewBox="0 0 230 230" className="h-full w-full">
        <defs>
          <linearGradient id="pm-ringbase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.09)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
          {/* variação de tom do início ao fim do arco (não chapado) */}
          <linearGradient id="pm-ringprog" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFAD73" />
            <stop offset="55%" stopColor="#FF8A3C" />
            <stop offset="100%" stopColor="#F4711E" />
          </linearGradient>
          <linearGradient id="pm-ringdone" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7BF3B2" />
            <stop offset="100%" stopColor="#2FBF6E" />
          </linearGradient>
          <filter id="pm-ringblur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        </defs>

        {/* trilho */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="url(#pm-ringbase)" strokeWidth={STROKE} />

        {pct > 0 ? (
          <>
            {/* glow suave sob o arco preenchido */}
            <motion.path
              d={arcPath}
              fill="none"
              stroke={doneGoal ? "url(#pm-ringdone)" : "url(#pm-ringprog)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 1 - pct }}
              transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
              filter="url(#pm-ringblur)"
              opacity={0.45}
            />
            {/* traço principal */}
            <motion.path
              d={arcPath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 1 - pct }}
              transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </>
        ) : null}
      </svg>

      <span className="pointer-events-none absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-white/25" aria-hidden />

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="pm-num text-[40px] leading-none text-[#F4F6FB]">
          {val}
          <span className="text-[20px] text-[#7E8AA0]">/{goal}</span>
        </span>
        <span className="mt-1.5 text-[11px] font-medium text-[#7E8AA0]">treinos · meta da semana</span>
      </div>
    </div>
  );
}
