import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, Flame, TrendingUp, Trophy, ArrowRight } from "lucide-react";
import { assetPath } from "~/lib/asset-path";

export const metadata: Metadata = {
  title: "Evolução · GymFitness Campos",
  description:
    "Treinou, ficou registrado. Diário de treinos, streak, volume e feedback que o personal acompanha. GymFitness Campos.",
};

/**
 * LP pública "treinou, ficou registrado". QR do banner de progresso cai aqui.
 * Mostra o que o app guarda de cada treino. CTA: criar conta / entrar.
 */
export default function EvolucaoPage() {
  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      {/* HERO com foto */}
      <header className="relative overflow-hidden">
        <Image
          src={assetPath("/workout/workout-rack.jpg")}
          alt="Área de pesos da GymFitness Campos"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-center"
        />
        <span className="absolute inset-0 bg-gradient-to-b from-[#05080f]/70 via-[#05080f]/55 to-[#05080f]" aria-hidden />
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
          <h1 className="mt-8 text-balance font-display text-[29px] font-black leading-[1.1] tracking-tight sm:text-[32px]">
            Treinou?{" "}
            <span className="bg-gradient-to-r from-[#4ADE80] to-[#FF9A5C] bg-clip-text text-transparent">
              Ficou registrado.
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            Aqui nenhum treino some. Cada sessão vira histórico, número e
            feedback que teu personal lê. Evoluir de verdade é ver o número subir.
          </p>
          <div className="mt-6 space-y-2.5">
            <Link
              href="/register"
              className="tactile flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
            >
              Começar a registrar
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="tactile flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/40 py-4 text-[14px] font-bold text-white backdrop-blur transition-colors active:scale-[0.98]"
            >
              Sou aluno, entrar
            </Link>
          </div>
        </div>
      </header>

      {/* O QUE FICA GUARDADO */}
      <section className="mx-auto mt-2 max-w-md space-y-3 px-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
          O que fica guardado
        </p>
        {[
          {
            Icon: ClipboardCheck,
            title: "Diário de treinos",
            desc: "Data, duração, sensação e tua nota. Daqui 3 meses tu lê e vê onde chegou.",
          },
          {
            Icon: Flame,
            title: "Streak que cobra",
            desc: "Dias seguidos acesos na tela. Falhar dói mais quando a chama apaga.",
          },
          {
            Icon: TrendingUp,
            title: "Volume semana a semana",
            desc: "Carga total movida, treinos feitos, comparação com a semana passada. Número não mente.",
          },
          {
            Icon: Trophy,
            title: "Liga + personal de olho",
            desc: "Teu feedback chega no personal na hora. Ele ajusta a ficha com base no que tu sentiu.",
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
            src={assetPath("/workout/workout-strength.jpg")}
            alt="Treino de força na GymFitness Campos"
            width={800}
            height={420}
            sizes="(max-width: 640px) 100vw, 448px"
            className="h-44 w-full object-cover object-center"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-transparent to-transparent" aria-hidden />
          <p className="absolute bottom-3 left-4 right-4 text-[13px] font-bold leading-snug">
            O primeiro registro é o treino de hoje. Bora.
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
