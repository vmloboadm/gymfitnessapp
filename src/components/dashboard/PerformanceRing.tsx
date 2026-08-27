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

const STROKE = 7;

/** Anel de meta semanal refinado — estilo fitness tracker.
 *  Traço fino, gradiente suave, sem efeitos exagerados. */
export function PerformanceRing({ done, goal }: { done: number; goal: number }) {
  const pct = Math.min(1, done / goal);
  const r = 100;
  const c = 115;
  const val = useCountUp(done);
  const doneGoal = done >= goal;

  const theta = pct * 2 * Math.PI;
  const startX = c;
  const startY = c - r;
  const endX = c - r * Math.sin(theta);
  const endY = c - r * Math.cos(theta);
  const largeArc = pct > 0.5 ? 1 : 0;
  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}`;

  return (
    <div className="relative mx-auto h-[132px] w-[132px] sm:h-[144px] sm:w-[144px]">
      <svg viewBox="0 0 230 230" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="pm-ringtrack" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="pm-ringfill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFB07A" />
            <stop offset="60%" stopColor="#FF8A3C" />
            <stop offset="100%" stopColor="#F4711E" />
          </linearGradient>
          <linearGradient id="pm-ringdone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
          <filter id="pm-ringglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* trilha */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="url(#pm-ringtrack)" strokeWidth={STROKE} />

        {pct > 0 && (
          <>
            {/* glow suave */}
            <motion.path
              d={arcPath}
              fill="none"
              stroke={doneGoal ? "url(#pm-ringdone)" : "url(#pm-ringfill)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 1 - pct }}
              transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
              filter="url(#pm-ringglow)"
              opacity={0.35}
            />
            {/* traço principal */}
            <motion.path
              d={arcPath}
              fill="none"
              stroke={doneGoal ? "url(#pm-ringdone)" : "url(#pm-ringfill)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 1 - pct }}
              transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[34px] font-extrabold leading-none tracking-tight text-[#F4F6FB]">
          {val}
          <span className="ml-0.5 text-[16px] font-semibold text-[#5E6A80]">/{goal}</span>
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-[#5E6A80]">treinos · semana</span>
      </div>
    </div>
  );
}
