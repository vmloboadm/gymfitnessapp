"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { MiniEcg } from "./ECGLine";
import { livePulse } from "./mocks";
import { useReducedMotion } from "~/hooks/useReducedMotion";

/** Pulso da academia — termômetro vivo de ocupação (FOMO & social proof).
    O ícone de batimento é um ECG contínuo (trilha em loop), nunca imagem parada. */
export function LivePulse({ online }: { online: number }) {
  const hour = new Date().getHours();
  const reduced = useReducedMotion();
  const { phrase, occupancy } = livePulse(hour, online);
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
        <p className="flex-1 text-[12px] leading-snug text-[#BFC7D8]">
          {phrase}
          <span className="pm-mono ml-2 !text-[9px] text-[#7E8AA0]">ocupação {pct}%</span>
        </p>
        <Activity className="h-4 w-4 shrink-0 text-[#4ADE80]/70" />
      </div>
      <div className="relative h-[3px] w-full bg-white/[0.04]">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#22c55e]/60 to-[#4ADE80]"
          initial={{ width: "8%" }}
          animate={
            reduced
              ? { width: `${pct}%` }
              : { width: `${pct}%`, boxShadow: ["0 0 4px rgba(74,222,128,0.4)", "0 0 9px rgba(74,222,128,0.8)", "0 0 4px rgba(74,222,128,0.4)"] }
          }
          transition={
            reduced
              ? { duration: 0.5, ease: "easeOut" }
              : { width: { duration: 1, ease: "easeOut" }, boxShadow: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }
          }
        />
      </div>
    </section>
  );
}