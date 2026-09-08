import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Ticket, ArrowRight, Lock } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { assetPath } from "~/lib/asset-path";

export const metadata: Metadata = {
  title: "Vantagens · GymFitness Campos",
  description:
    "Cupons dos parceiros só para quem treina na GymFitness Campos. Entre no app para revelar o seu.",
};

type Sponsor = {
  id: string;
  name: string;
  discount_text: string;
  cta_type: "coupon" | "whatsapp";
};

async function getSponsors(): Promise<Sponsor[]> {
  try {
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("sponsors")
      .select("id, name, discount_text, cta_type")
      .eq("active", true)
      .order("ord", { ascending: true })
      .limit(20);
    return (data ?? []) as Sponsor[];
  } catch {
    return [];
  }
}

/**
 * LP pública de vantagens. QR do banner "Descontos de parceiros" cai aqui.
 * Foto + logo + lista real de parceiros com cupom borrado. CTA: entrar.
 */
export default async function VantagensPage() {
  const sponsors = await getSponsors();

  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      {/* HERO com foto */}
      <header className="relative overflow-hidden">
        <Image
          src={assetPath("/workout/workout-woman.jpg")}
          alt="Aluna treinando na GymFitness Campos"
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
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 backdrop-blur">
            <Ticket className="h-3 w-3 text-[#FFC24D]" />
            Clube de vantagens · só alunos
          </span>
          <h1 className="mt-3 text-balance font-display text-[28px] font-black leading-[1.12] tracking-tight sm:text-[30px]">
            Treina aqui,{" "}
            <span className="bg-gradient-to-r from-[#FFC24D] to-[#FF9A5C] bg-clip-text text-transparent">
              paga menos lá fora.
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            Lanchonete, suplemento, roupa, barbearia. Parceiro do bairro com
            desconto preso no seu login. O cupom só revela dentro do app.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-md space-y-3 px-5">
        {sponsors.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-[14px] font-bold">Primeiros parceiros entrando</p>
            <p className="mt-1 text-[12px] leading-snug text-white/50">
              O clube está sendo fechado com os comércios do bairro. Cria tua
              conta que o aviso chega quando o primeiro cupom sair.
            </p>
          </div>
        ) : (
          sponsors.map((s) => (
            <div
              key={s.id}
              className="rounded-[18px] border border-[#FFC24D]/25 bg-gradient-to-br from-[#FFC24D]/10 via-transparent to-transparent p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFC24D]">
                Parceiro do bairro
              </p>
              <p className="mt-1 text-[15px] font-black">{s.name}</p>
              <p className="mt-0.5 text-[13px] text-white/65">{s.discount_text}</p>
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="select-none text-[13px] font-bold tracking-widest text-white/30 blur-[4px]">
                  CUPOM-EXCLUSIVO
                </span>
                <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  entra p/ revelar
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mx-auto mt-8 max-w-md px-5">
        <Link
          href="/login"
          className="tactile flex items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_8px_24px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
        >
          Entrar e revelar meus cupons
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-center text-[11px] text-white/40">
          Ainda não treina aqui?{" "}
          <Link href="/bem-vindo" className="font-bold text-[#FF9A5C]">
            Conhece o app primeiro
          </Link>
        </p>
      </section>

      <footer className="mx-auto mt-10 max-w-md px-5 pb-12 text-center">
        <p className="text-[10px] text-white/25">
          GymFitness Campos · gymfitnesscampos.com.br
        </p>
      </footer>
    </div>
  );
}
