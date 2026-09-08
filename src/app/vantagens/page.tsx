import type { Metadata } from "next";
import Link from "next/link";
import { Ticket, ArrowRight, Lock } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";

export const metadata: Metadata = {
  title: "Vantagens · GymFitness Campos",
  description:
    "Descontos exclusivos dos parceiros para alunos GymFitness. Entre no app para revelar seu cupom.",
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
 * LP pública de vantagens — QR do banner "Parceiros" (lado aluno) cai aqui.
 * Mostra os descontos, borra o cupom e pede login para revelar.
 */
export default async function VantagensPage() {
  const sponsors = await getSponsors();

  return (
    <div className="min-h-[100dvh] bg-[#05080f] text-[#F4F6FB]">
      <header className="relative overflow-hidden px-5 pb-8 pt-12 text-center">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,194,77,0.18),transparent_70%)] blur-2xl"
          aria-hidden
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
          <Ticket className="h-3 w-3 text-[#FFC24D]" />
          Clube de vantagens · Alunos
        </span>
        <h1 className="relative mt-4 font-display text-[30px] font-black leading-tight tracking-tight">
          Descontos exclusivos{" "}
          <span className="bg-gradient-to-r from-[#FFC24D] to-[#FF9A5C] bg-clip-text text-transparent">
            para quem treina aqui
          </span>
        </h1>
        <p className="relative mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-white/60">
          Parceiros da academia com cupom só para alunos. Entre no app para
          revelar e usar.
        </p>
      </header>

      <section className="mx-auto max-w-md space-y-3 px-5">
        {sponsors.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-[14px] font-bold">Novos parceiros a caminho</p>
            <p className="mt-1 text-[12px] text-white/50">
              O clube de vantagens está sendo montado. Entre no app e ative o
              aviso para ser o primeiro a usar.
            </p>
          </div>
        ) : (
          sponsors.map((s) => (
            <div
              key={s.id}
              className="rounded-[18px] border border-[#FFC24D]/25 bg-gradient-to-br from-[#FFC24D]/10 via-transparent to-transparent p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFC24D]">
                Parceiro GymFitness
              </p>
              <p className="mt-1 text-[15px] font-black">{s.name}</p>
              <p className="mt-0.5 text-[13px] text-white/65">{s.discount_text}</p>
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="select-none text-[13px] font-bold tracking-widest text-white/30 blur-[4px]">
                  CUPOM-EXCLUSIVO
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
          Ainda não tem conta?{" "}
          <Link href="/register" className="font-bold text-[#FF9A5C]">
            Criar grátis
          </Link>
        </p>
      </section>

      <footer className="mx-auto mt-10 max-w-md px-5 pb-12 text-center">
        <p className="text-[10px] text-white/25">
          GymFitness · gymfitnesscampos.com.br
        </p>
      </footer>
    </div>
  );
}
