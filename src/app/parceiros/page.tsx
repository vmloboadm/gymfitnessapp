import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Store, Tv, Ticket, Smartphone, TrendingUp, Users, CheckCircle2, MessageCircle, ArrowRight, Dumbbell } from "lucide-react";
import { partnerLink } from "~/lib/whatsapp";
import { assetPath } from "~/lib/asset-path";

export const metadata: Metadata = {
  title: "Parceiros · GymFitness Campos",
  description:
    "Banner no salão, vídeo na TV e cupom no app: sua marca na rotina de quem treina todo dia em Campos.",
};

/**
 * LP de parcerias, pública. QR do banner "Seja parceiro" cai aqui.
 * Mobile-first: o lojista escaneia no salão e fecha no WhatsApp.
 */
export default function ParceirosPage() {
  const ctaHref = partnerLink();

  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      {/* HERO com foto do salão */}
      <header className="relative overflow-hidden">
        <Image
          src={assetPath("/workout/workout-strength.jpg")}
          alt="Salão de musculação da GymFitness Campos"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-center"
        />
        <span className="absolute inset-0 bg-gradient-to-b from-[#05080f]/70 via-[#05080f]/55 to-[#05080f]" aria-hidden />
        <div className="relative px-5 pb-10 pt-8 text-center">
          <Image
            src={assetPath("/images/logo-academia.png")}
            alt="GymFitness Campos"
            width={132}
            height={42}
            priority
            unoptimized
            className="mx-auto h-9 w-auto object-contain"
            style={{ filter: "drop-shadow(0 0 16px rgba(255,111,22,0.45))" }}
          />
          <h1 className="mt-8 text-balance font-display text-[28px] font-black leading-[1.12] tracking-tight sm:text-[30px]">
            400+ alunos passam pelo seu banner{" "}
            <span className="bg-gradient-to-r from-[#F4711E] to-[#FF9A5C] bg-clip-text text-transparent">
              toda semana.
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            Não é outdoor que ninguém olha. É o salão onde o bairro treina
            6x por semana, com sua marca no banner, na TV e no cupom do app.
          </p>
        </div>
      </header>

      {/* NÚMEROS */}
      <section className="mx-auto grid max-w-md grid-cols-3 gap-2.5 px-5">
        {[
          { Icon: Users, value: "400+", label: "alunos ativos" },
          { Icon: TrendingUp, value: "3.500+", label: "check-ins/mês" },
          { Icon: Dumbbell, value: "6 dias", label: "de treino por semana" },
        ].map(({ Icon, value, label }) => (
          <div
            key={label}
            className="rounded-[18px] border border-white/[0.07] bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-3.5 text-center"
          >
            <Icon className="mx-auto h-4 w-4 text-[#FF9A5C]" />
            <p className="mt-1.5 font-display text-[19px] font-black leading-none sm:text-[20px]">{value}</p>
            <p className="mt-1 text-[10px] font-medium leading-tight text-white/50">{label}</p>
          </div>
        ))}
      </section>

      {/* BENEFÍCIOS */}
      <section className="mx-auto mt-8 max-w-md space-y-3 px-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
          O que você recebe
        </p>
        {[
          {
            Icon: Store,
            title: "Banner no salão",
            desc: "Sua marca na parede onde 400+ alunos batem ponto toda semana.",
          },
          {
            Icon: Tv,
            title: "Vídeo na TV do salão",
            desc: "Teu comercial rodando no descanso entre as séries. Ninguém pula.",
          },
          {
            Icon: Ticket,
            title: "Cupom que o aluno usa",
            desc: "Desconto preso no login do aluno. Sem print vazando pra fora.",
          },
          {
            Icon: Smartphone,
            title: "Card dentro do app",
            desc: "Teu nome na tela que o aluno abre todo dia antes de treinar.",
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

      {/* COMO FUNCIONA */}
      <section className="mx-auto mt-8 max-w-md space-y-3 px-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
          Como funciona
        </p>
        {[
          "Chama no WhatsApp e conta o que você vende",
          "A gente monta banner + vídeo + cupom com você",
          "Sua marca entra no ar no salão, na TV e no app",
          "Vê o movimento e decide se renova. Sem fidelidade",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3 px-1">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F4711E]/15 text-[10px] font-black text-[#FF9A5C]">
              {i + 1}
            </span>
            <p className="text-[13px] leading-snug text-white/70">{step}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mx-auto mt-10 max-w-md px-5">
        <a
          href={ctaHref}
          className="tactile flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
        >
          <MessageCircle className="h-5 w-5" />
          Quero ser parceiro
          <ArrowRight className="h-4 w-4" />
        </a>
        <div className="mt-4 space-y-1.5">
          {[
            "Fala direto com o gestor, sem intermediário",
            "Cabe no bolso do comércio de bairro",
            "No ar ainda esta semana",
          ].map((item) => (
            <p key={item} className="flex items-center gap-1.5 text-[12px] text-white/50">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#4ADE80]" />
              {item}
            </p>
          ))}
        </div>
      </section>

      <footer className="mx-auto mt-10 max-w-md px-5 pb-12 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/40 transition-colors hover:text-white/70"
        >
          <Dumbbell className="h-3.5 w-3.5" />
          Já é aluno? Entrar no app
        </Link>
        <p className="mt-3 text-[10px] text-white/25">
          GymFitness · gymfitnesscampos.com.br
        </p>
      </footer>
    </div>
  );
}
