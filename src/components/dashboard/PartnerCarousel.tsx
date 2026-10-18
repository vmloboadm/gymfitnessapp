"use client";

import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { ExternalLink, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { isDemoMode, demoPatrocinadores, codeResgate, type Patrocinador } from "~/lib/demo-bridge";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";

/** Parceiro com código de resgate real cadastrado (coluna resgate). */
type Partner = Patrocinador & { code?: string };

/** Monograma premium, primeira letra em display pesado sobre a cor da marca.
    Quando o parceiro cadastra a logo (upload), ela substitui o monograma. */
function PartnerMark({ p, size = 44 }: { p: Patrocinador; size?: number }) {
  const radius = Math.round(size * 0.28);
  if (p.logo) {
    return (
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/12 bg-white/5"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <Image
          src={p.logo}
          alt={p.name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `radial-gradient(120% 120% at 25% 0%, ${p.brand} 0%, ${p.brand} 45%, rgba(0,0,0,0.45) 130%)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.10), 0 4px 14px -2px ${p.brand}66`,
      }}
    >
      <span className="font-display text-lg font-extrabold leading-none text-white" style={{ fontSize: size * 0.42 }}>
        {p.name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

/** Carrossel universal de parceiros, snap central sedoso, autoplay lento, peek do próximo card.
    Sem corte abrupto na borda: o contéudo do card nunca é cortado feio. */
export default function PartnerCarousel() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  // produção: patrocinadores reais do gym (tabela partners)
  const [partners, setPartners] = useState<Partner[]>([]);
  useEffect(() => {
    if (isDemoMode()) {
      setPartners(demoPatrocinadores());
      return;
    }
    if (!gymId) {
      setPartners([]);
      return;
    }
    const sb = supabaseBrowser();
    sb.from("partners")
      .select("id, name, image_url, link, resgate")
      .eq("gym_id", gymId)
      .eq("active", true)
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ id: string; name: string; image_url: string | null; link: string | null; resgate: string | null }>;
        setPartners(
          rows
            .filter((p) => p.name?.trim() && (p.link || p.resgate))
            .map((p) => ({
              id: p.id,
              name: p.name,
              msg: "",
              discount: 0,
              url: p.link ?? "",
              brand: "#1B3A66",
              logo: p.image_url ?? "",
              code: p.resgate ?? "",
            }))
        );
      });
  }, [gymId]);
  const [emblaRef] = useEmblaCarousel(
    {
      loop: partners.length > 1,
      align: "center",
      containScroll: false,
      skipSnaps: false,
    },
    [
      Autoplay({
        delay: 5200,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ]
  );

  if (partners.length === 0) return null;

  const rescue = (p: Partner) => {
    if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
    const code = p.code ?? (isDemoMode() ? codeResgate(p.id) : "");
    if (code) {
      toast.success(`Código de resgate: ${code}`, {
        description: `Copie o código e apresente no ${p.name} para aproveitar a oferta.`,
      });
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-2.5">
        <p className="pm-mono text-[#7E8AA0]">Parceiros da academia</p>
        <span className="flex items-center gap-1 text-[10px] text-[#6E7A90]">
          <BadgePercent className="h-3 w-3" />
          ofertas exclusivas
        </span>
      </div>

      {/* máscara lateral suave, o card vizinho desvanece, nunca corta feio */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6"
        style={{ background: "linear-gradient(90deg, #050507 0%, transparent 100%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6"
        style={{ background: "linear-gradient(270deg, #050507 0%, transparent 100%)" }}
        aria-hidden
      />

      <div className="overflow-hidden scroll-smooth" ref={emblaRef}>
        <div className="flex snap-x snap-mandatory items-stretch gap-3">
          {partners.map((p) => (
            <div
              key={p.id}
              className="shrink-0 snap-center"
              style={{ flex: "0 0 78%" }}
            >
              <div className="flex h-full flex-col rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <PartnerMark p={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#F4F6FB]">{p.name}</p>
                    <p className="pm-mono mt-0.5 text-[9px] uppercase tracking-wider text-[#7E8AA0]">parceiro oficial</p>
                  </div>
                </div>

                {p.msg ? (
                  <p className="mt-3 line-clamp-2 text-[12px] leading-snug text-[#BFC7D8]">{p.msg}</p>
                ) : (
                  <div className="mt-3" />
                )}

                <div className="mt-auto pt-3">
                  <button
                    onClick={() => rescue(p)}
                    className="tactile gf-touch flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-white/12 bg-white/[0.03] py-2.5 text-[12px] font-bold text-[#FFB073] transition-colors hover:bg-white/[0.07]"
                  >
                    {p.discount > 0 ? `Resgatar ${p.discount}% Off` : "Resgatar"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}