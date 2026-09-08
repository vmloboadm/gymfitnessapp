import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScanLine, Dumbbell, TrendingUp, Trophy, ArrowRight } from "lucide-react";
import { assetPath } from "~/lib/asset-path";

export const metadata: Metadata = {
  title: "Bem-vindo · GymFitness Campos",
  description:
    "Check-in na portaria, ficha do seu personal e evolução semana a semana — o app da GymFitness Campos.",
};

/**
 * LP pública de boas-vindas — QR do banner "Conheça o app" cai aqui.
 * Foto real do salão + logo + voz da academia. CTA: criar conta / entrar.
 */
export default function BemVindoPage() {
  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      {/* HERO com foto do salão */}
      <header className="relative overflow-hidden">
        <Image
          src={assetPath("/workout/workout-hero.jpg")}
          alt="Salão de musculação da GymFitness Campos"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-center"
        />
        <span className="absolute inset-0 bg-gradient-to-b from-[#05080f]/70 via-[#05080f]/55 to-[#05080f]" aria-hidden />
        <span
          className="absolute inset-0 mix-blend-overlay"
          style={{ background: "linear-gradient(115deg, rgba(244,113,30,0.28) 0%, rgba(244,113,30,0) 50%)" }}
          aria-hidden
        />
        <div className="relative px-5 pb-10 pt-8">
          <Image
            src={assetPath("/images/logo-academia.png")}
            alt="GymFitness Campos"
            width={132}
            height={42}
            priority
            unoptimized
            className="h-9 w-auto object-contain"
            style={{ filter: "drop-shadow(0 0 16px rgba(255,111,22,0.45))" }}
          />
          <h1 className="mt-8 font-display text-[32px] font-black leading-[1.08] tracking-tight">
            O treino é aqui.
            <br />
            <span className="bg-gradient-to-r from-[#F4711E] to-[#FF9A5C] bg-clip-text text-transparent">
              A evolução é no app.
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            Você escaneou o QR do salão — bom, é por aqui que a ficha anda.
            Check-in na portaria, treino do personal e progresso guardado.
          </p>
          <div className="mt-6 space-y-2.5">
            <Link
              href="/register"
              className="tactile flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
            >
              Criar minha conta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="tactile flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/40 py-4 text-[14px] font-bold text-white backdrop-blur transition-colors active:scale-[0.98]"
            >
              Já treino aqui — entrar
            </Link>
          </div>
        </div>
      </header>

      {/* NÚMEROS DA CASA */}
      <section className="mx-auto grid max-w-md grid-cols-3 gap-2.5 px-5">
        {[
          { value: "400+", label: "alunos treinando" },
          { value: "3.500+", label: "check-ins por mês" },
          { value: "51", label: "aparelhos no salão" },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="rounded-[18px] border border-white/[0.07] bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-3.5 text-center"
          >
            <p className="font-display text-[20px] font-black leading-none">{value}</p>
            <p className="mt-1 text-[10px] font-medium leading-tight text-white/50">{label}</p>
          </div>
        ))}
      </section>

      {/* NA PRÁTICA */}
      <section className="mx-auto mt-8 max-w-md space-y-3 px-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
          Na prática, como é
        </p>
        {[
          {
            Icon: ScanLine,
            title: "Chegou, liberou",
            desc: "QR, NFC ou a senha do dia na portaria — o treino destrava na hora, sem papel e sem espera.",
          },
          {
            Icon: Dumbbell,
            title: "Ficha do seu personal, não genérica",
            desc: "Séries, repetições e vídeos de execução. Terminou, o personal já sabe.",
          },
          {
            Icon: TrendingUp,
            title: "Progresso que você vê",
            desc: "Streak de dias seguidos, volume por semana e diário de treinos com seu feedback.",
          },
          {
            Icon: Trophy,
            title: "Liga da semana + descontos",
            desc: "Disputa saudável com a galera e cupons dos parceiros dentro do app.",
          },
        ].map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F4711E]/25 bg-[#F4711E]/10">
              <Icon className="h-4.5 w-4.5 text-[#FF9A5C]" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold">{title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-white/55">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* FOTO 2 + CTA FINAL */}
      <section className="mx-auto mt-8 max-w-md px-5">
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.07]">
          <Image
            src={assetPath("/workout/workout-rack.jpg")}
            alt="Área de pesos da GymFitness Campos"
            width={800}
            height={420}
            sizes="(max-width: 640px) 100vw, 448px"
            className="h-44 w-full object-cover object-center"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-transparent to-transparent" aria-hidden />
          <p className="absolute bottom-3 left-4 right-4 text-[13px] font-bold leading-snug">
            Conta gratuita em 1 minuto — só e-mail e senha. O resto a gente resolve no salão.
          </p>
        </div>
        <Link
          href="/register"
          className="tactile mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
        >
          Criar minha conta
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="mx-auto mt-10 max-w-md px-5 pb-12 text-center">
        <p className="text-[10px] text-white/25">
          GymFitness Campos · gymfitnesscampos.com.br
        </p>
      </footer>
    </div>
  );
}
