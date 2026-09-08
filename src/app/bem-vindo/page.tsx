import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine, Dumbbell, TrendingUp, Trophy, ArrowRight, CheckCircle2, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Bem-vindo · GymFitness Campos",
  description:
    "Check-in na portaria, treino do seu personal, progresso e ranking — tudo no app da GymFitness Campos.",
};

/**
 * LP pública de boas-vindas — QR do banner "Conheça o app" cai aqui.
 * Mobile-first: explica em 30s + CTA para entrar/criar conta.
 */
export default function BemVindoPage() {
  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      <header className="relative overflow-hidden px-5 pb-8 pt-12 text-center">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,113,30,0.22),transparent_70%)] blur-2xl"
          aria-hidden
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F4711E] shadow-[0_0_8px_rgba(244,113,30,0.7)]" />
          GymFitness Campos · App do aluno
        </span>
        <h1 className="relative mt-4 font-display text-[30px] font-black leading-tight tracking-tight">
          Seu treino, seu progresso,{" "}
          <span className="bg-gradient-to-r from-[#F4711E] to-[#FF9A5C] bg-clip-text text-transparent">
            tudo no bolso
          </span>
        </h1>
        <p className="relative mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-white/60">
          Escaneou o QR da academia? Aqui começa: check-in, treino do personal
          e evolução semana a semana.
        </p>
      </header>

      <section className="mx-auto max-w-md space-y-3 px-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
          Como funciona
        </p>
        {[
          {
            Icon: ScanLine,
            title: "1. Check-in na portaria",
            desc: "QR, NFC ou senha do dia — libera seu treino na hora.",
          },
          {
            Icon: Dumbbell,
            title: "2. Treino do seu personal",
            desc: "Ficha montada para você, com vídeos e descanso guiado.",
          },
          {
            Icon: TrendingUp,
            title: "3. Progresso de verdade",
            desc: "Diário de treinos, volume, streak e feedback que o personal vê.",
          },
          {
            Icon: Trophy,
            title: "4. Ranking e conquistas",
            desc: "Liga da semana, medalhas e desafios com a galera.",
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

      <section className="mx-auto mt-8 max-w-md px-5">
        <Link
          href="/register"
          className="tactile flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
        >
          <Smartphone className="h-5 w-5" />
          Criar minha conta
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/login"
          className="tactile mt-2.5 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.07]"
        >
          Já sou aluno — entrar
        </Link>
        <div className="mt-4 space-y-1.5">
          {[
            "Leva 1 minuto — só e-mail e senha",
            "Seu personal já acompanha sua evolução",
            "Descontos de parceiros dentro do app",
          ].map((item) => (
            <p key={item} className="flex items-center gap-1.5 text-[12px] text-white/50">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#4ADE80]" />
              {item}
            </p>
          ))}
        </div>
      </section>

      <footer className="mx-auto mt-10 max-w-md px-5 pb-12 text-center">
        <p className="text-[10px] text-white/25">
          GymFitness · gymfitnesscampos.com.br
        </p>
      </footer>
    </div>
  );
}
