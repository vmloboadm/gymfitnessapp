"use client";

import Image from "next/image";
import Link from "next/link";
import { m, type Variants } from "framer-motion";
import { Play, Clock, AlertTriangle } from "lucide-react";
import { CountUp } from "~/components/common/CountUp";

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
  /** Destino do toque (padrão: treino de hoje). */
  href?: string;
  /** Quando ainda não há plano: substitui o bloco de números por um recado honesto. */
  emptyHint?: string;
}

/** Stagger interno do hero: cada bloco entra em cascata (label → título → números → CTA). */
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

/** Hero do treino de hoje, imagem de fundo + overlay de leitura forte + CTA glow.
    Visual premium e respirado: glow ambiente atrás do card, foto com zoom lento
    no hover, números com count-up e entrada em cascata. */
export function HeroWorkout({
  image,
  title,
  exerciseCount,
  estMin,
  sessionsWeek,
  sessionLabel,
  ready,
  notice,
  href,
  emptyHint,
}: HeroWorkoutProps) {
  return (
    <m.div variants={item} whileTap={{ scale: 0.985 }} className="relative">
      {/* glow ambiente laranja atrás do card — dá profundidade sem custo de render */}
      <span
        className="pointer-events-none absolute -inset-2 rounded-[28px] blur-2xl"
        style={{
          background: "radial-gradient(70% 70% at 50% 92%, rgba(244,113,30,0.42), transparent 75%)",
          opacity: 0.75,
        }}
        aria-hidden
      />
      <Link
        href={href ?? "/treino?ir=hoje"}
        aria-label={`Treino de hoje: ${title}`}
        className="group pm-surface tactile block"
      >
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-center transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
        />
        {/* overlay bottom-up (legibilidade total) */}
        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" aria-hidden />
        <span
          className="absolute inset-0 mix-blend-overlay"
          style={{ background: "linear-gradient(115deg, rgba(255,111,22,0.35) 0%, rgba(255,111,22,0) 50%)" }}
          aria-hidden
        />

        <div className="relative p-7 pb-8">
          <m.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-0">
            <m.div variants={rise} className="flex items-center justify-between">
              <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-[#FF9A5C]">{sessionLabel}</p>
              {ready ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#4ADE80]/40 bg-[#4ADE80]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4ADE80]">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Pronto
                </span>
              ) : null}
            </m.div>

            <m.h2 variants={rise} className="mt-5 font-display text-[28px] font-extrabold leading-[1.05] tracking-tight text-white">
              {title}
            </m.h2>

            {notice ? (
              <m.p
                variants={rise}
                className="mt-4 flex items-start gap-2 rounded-[14px] border border-[#FF9A5C]/30 bg-[#FF9A5C]/10 px-3.5 py-2.5 text-[12px] leading-snug text-[#FFD9B0]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {notice}
              </m.p>
            ) : null}

            {emptyHint ? (
              <m.p variants={rise} className="mt-6 max-w-[26ch] text-[13px] leading-snug text-[#C9D2E3]">{emptyHint}</m.p>
            ) : (
              <m.div variants={rise} className="mt-7 flex items-end justify-between">
                <div>
                  <p className="pm-num text-[64px] leading-none text-white tabular-nums">
                    <CountUp value={exerciseCount} />
                  </p>
                  <p className="mt-2 text-[12px] font-medium text-[#9AA5B8]">exercícios hoje</p>
                </div>
                <div className="flex gap-8 text-right">
                  <div>
                    <p className="flex items-center justify-end gap-1.5">
                      <Clock className="h-4 w-4 text-[#9AA5B8]" />
                      <span className="pm-num text-[26px] text-[#E6EAF3] tabular-nums">{estMin}</span>
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-[#9AA5B8]">minutos</p>
                  </div>
                  <div>
                    <p className="pm-num text-[26px] text-[#E6EAF3] tabular-nums">{sessionsWeek}</p>
                    <p className="mt-1 text-[12px] font-medium text-[#9AA5B8]">na semana</p>
                  </div>
                </div>
              </m.div>
            )}

            <m.div variants={rise} className="mt-7">
              <m.span
                className="relative flex items-center justify-center gap-3 overflow-hidden rounded-[18px] bg-gradient-to-r from-[#FF8A3C] to-[#E85D0E] py-4 shadow-[0_22px_54px_-16px_rgba(244,113,30,0.85)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Shimmer sweep */}
                <m.span
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.18) 55%, transparent 70%)",
                  }}
                  animate={{ x: ["-120%", "220%"] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                />
                <span className="relative font-display text-[17px] font-extrabold tracking-wide text-white">Começar agora</span>
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
                  <Play className="h-5 w-5 fill-white text-white" />
                </span>
              </m.span>
            </m.div>
          </m.div>
        </div>
      </Link>
    </m.div>
  );
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};
