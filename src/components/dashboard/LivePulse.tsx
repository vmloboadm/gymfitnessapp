"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { MiniEcg } from "./ECGLine";
import { livePulse } from "./mocks";

/** Pulso da academia, termômetro vivo de ocupação (FOMO & social proof).
    O ícone de batimento é um ECG contínuo (trilha em loop), nunca imagem parada. */
export function LivePulse({ online }: { online: number }) {
  // Hora só no cliente: evita hydration mismatch (servidor UTC vs fuso local)
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const { phrase, occupancy } = livePulse(hour ?? 12, online);
  const pct = Math.max(8, Math.round(occupancy * 100));

  return (
    <section className="pm-surface">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#4ADE80]/25 bg-[#4ADE80]/10">
          <MiniEcg className="w-6" height={16} />
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-[#4ADE80] shadow-[0_0_6px_rgba(74,222,128,0.9)]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-70" />
          </span>
        </span>
        <p className="flex-1 text-[12px] leading-snug text-[#BFC7D8]">{phrase}</p>
        <Activity className="h-4 w-4 shrink-0 text-[#4ADE80]/70" />
      </div>
      {/* arco de ocupação, traço fino, gradiente suave */}
      <div className="flex items-center gap-4 px-5 pb-5 pt-1">
        <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
          <motion.circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="url(#occ-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            initial={{ strokeDashoffset: 1 }}
            animate={{ strokeDashoffset: 1 - pct / 100 }}
            transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
            transform="rotate(-90 22 22)"
          />
          <defs>
            <linearGradient id="occ-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <text x="22" y="25" textAnchor="middle" fontSize="10" fontWeight="800" fill="#E6F9EE">
            {pct}%
          </text>
        </svg>
        <p className="text-[12px] leading-snug text-[#BFC7D8]">
          Ocupação da academia agora, planeje horários menos cheios.
        </p>
      </div>
    </section>
  );
}