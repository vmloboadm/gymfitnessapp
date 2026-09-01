"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Play, Clock, AlertTriangle } from "lucide-react";

interface HeroWorkoutProps {
  /** Foto de fundo temática (equipamento de força / atleta). */
  image: string;
  title: string;
  exerciseCount: number;
  estMin: number;
  sessionsWeek: number;
  sessionLabel: string;
  ready: boolean;
  /** Aviso complementar (ex: retomada de treino pendente / fadiga de músculo). */
  notice?: string;
}

/** Hero do treino de hoje, imagem de fundo + overlay de leitura forte + CTA glow.
    Visual premium e respirado: padding interno generoso, título grande e botão imponente. */
export function HeroWorkout({
  image,
  title,
  exerciseCount,
  estMin,
  sessionsWeek,
  sessionLabel,
  ready,
  notice,
}: HeroWorkoutProps) {
  return (
    <motion.div variants={item} whileTap={{ scale: 0.985 }}>
      <Link
        href="/treino?ir=hoje"
        aria-label={`Treino de hoje: ${title}`}
        className="pm-surface tactile block"
      >
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-center"
        />
        {/* overlay bottom-up (legibilidade total) */}
        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" aria-hidden />
        <span
          className="absolute inset-0 mix-blend-overlay"
          style={{ background: "linear-gradient(115deg, rgba(255,111,22,0.35) 0%, rgba(255,111,22,0) 50%)" }}
          aria-hidden
        />

        <div className="relative p-7 pb-8">
          <div className="flex items-center justify-between">
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-[#FF9A5C]">{sessionLabel}</p>
            {ready ? (
              <span className="flex items-center gap-1.5 rounded-full border border-[#4ADE80]/40 bg-[#4ADE80]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4ADE80]">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Pronto
              </span>
            ) : null}
          </div>

          <h2 className="mt-5 font-display text-[28px] font-extrabold leading-[1.05] tracking-tight text-white">
            {title}
          </h2>

          {notice ? (
            <p className="mt-4 flex items-start gap-2 rounded-[14px] border border-[#FF9A5C]/30 bg-[#FF9A5C]/10 px-3.5 py-2.5 text-[12px] leading-snug text-[#FFD9B0]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          ) : null}

          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="pm-num text-[64px] leading-none text-white">{exerciseCount}</p>
              <p className="mt-2 text-[12px] font-medium text-[#9AA5B8]">exercícios hoje</p>
            </div>
            <div className="flex gap-8 text-right">
              <div>
                <p className="flex items-center justify-end gap-1.5">
                  <Clock className="h-4 w-4 text-[#9AA5B8]" />
                  <span className="pm-num text-[26px] text-[#E6EAF3]">{estMin}</span>
                </p>
                <p className="mt-1 text-[12px] font-medium text-[#9AA5B8]">minutos</p>
              </div>
              <div>
                <p className="pm-num text-[26px] text-[#E6EAF3]">{sessionsWeek}</p>
                <p className="mt-1 text-[12px] font-medium text-[#9AA5B8]">na semana</p>
              </div>
            </div>
          </div>

          <span className="mt-7 flex items-center justify-center gap-3 rounded-[18px] bg-gradient-to-r from-[#FF8A3C] to-[#E85D0E] py-4 shadow-[0_22px_54px_-16px_rgba(244,113,30,0.85)]">
            <span className="font-display text-[17px] font-extrabold tracking-wide text-white">Começar agora</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};