import type { Metadata } from "next";
import Link from "next/link";
import { Store, Tv, Ticket, Smartphone, TrendingUp, Users, CheckCircle2, MessageCircle, ArrowRight, Dumbbell } from "lucide-react";

export const metadata: Metadata = {
  title: "Parceiros · GymFitness Campos",
  description:
    "Coloque sua marca dentro da academia que mais cresce em Campos: banner no salão, vídeo na TV, cupom exclusivo para os alunos e presença no app.",
};

/**
 * LP de parcerias — pública (QR do banner da academia cai aqui).
 * Mobile-first: o parceiro escaneia o QR e vê tudo no celular.
 */
export default function ParceirosPage() {
  const whats = process.env.NEXT_PUBLIC_PARTNER_WHATSAPP ?? "";
  const ctaHref = whats
    ? `https://wa.me/${whats}?text=${encodeURIComponent("Olá! Vim pelo QR code da academia e quero saber mais sobre as parcerias do GymFitness.")}`
    : "mailto:contato@gymfitnesscampos.com.br?subject=" + encodeURIComponent("Quero ser parceiro · GymFitness");

  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      {/* HERO */}
      <header className="relative overflow-hidden px-5 pb-10 pt-12 text-center">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,113,30,0.22),transparent_70%)] blur-2xl"
          aria-hidden
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F4711E] shadow-[0_0_8px_rgba(244,113,30,0.7)]" />
          Parcerias · GymFitness Campos
        </span>
        <h1 className="relative mt-4 font-display text-[30px] font-black leading-tight tracking-tight">
          Sua marca dentro da academia{" "}
          <span className="bg-gradient-to-r from-[#F4711E] to-[#FF9A5C] bg-clip-text text-transparent">
            que mais cresce
          </span>{" "}
          em Campos
        </h1>
        <p className="relative mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-white/60">
          Público frequente, treino todo dia e celular na mão. Seu negócio na
          rotina real dos alunos — dentro do app, no salão e na TV da academia.
        </p>
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
            <p className="mt-1.5 font-display text-[20px] font-black leading-none">{value}</p>
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
            desc: "Espaço destacado na academia, onde seu público treina 6x por semana.",
          },
          {
            Icon: Tv,
            title: "Vídeo na TV da academia",
            desc: "Seu vídeo comercial rodando em loop para todo mundo que treina.",
          },
          {
            Icon: Ticket,
            title: "Cupom exclusivo para alunos",
            desc: "Desconto especial divulgado direto no app — rastreamos o uso.",
          },
          {
            Icon: Smartphone,
            title: "Presença no app",
            desc: "Card de parceiro na home do aluno, com destaque e CTA para o seu negócio.",
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
          "Você fala com a gente e escolhe o plano de parceria",
          "Produzimos o material (banner, vídeo, cupom) junto com você",
          "Sua marca entra no ar — no salão, na TV e no app",
          "Acompanha os resultados e renova se fizer sentido",
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
            "Resposta rápida — falo direto com o gestor",
            "Planos flexíveis para pequenos negócios locais",
            "Sem burocracia: começa na mesma semana",
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
          href="/app/login"
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
