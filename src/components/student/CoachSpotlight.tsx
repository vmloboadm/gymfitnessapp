"use client";

import { useEffect, useState } from "react";
import { ChevronRight, HeartHandshake } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { PersonalChooser, type Personal } from "~/components/student/PersonalSupportBox";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { formatBRL } from "~/lib/money";

/**
 * Destaque "Treine com a Daiana" (Home e aba Treino): foto do personal,
 * bio, plano mais barato e o botão de contratar. Abre a mesma escolha do
 * personal com WhatsApp e plano. Some se a academia não tiver personal.
 */
export function CoachSpotlight({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const [list, setList] = useState<Personal[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabaseBrowser()
      .rpc("gym_personals" as never)
      .then(({ data }) => {
        if (alive) setList((data as unknown as Personal[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!list || list.length === 0 || profile?.role !== "student") return null;

  const main = list[0];
  const first = (main.name ?? "").trim().split(/\s+/)[0] || "o personal";
  const offers = list.flatMap((p) => p.offers ?? []);
  const priced = offers.filter((o) => o.price_cents !== null).sort((a, b) => a.price_cents! - b.price_cents!);
  const fromLine = priced[0]
    ? `Planos a partir de ${formatBRL(priced[0].price_cents)}${priced[0].duration_label ? ` ${priced[0].duration_label}` : ""}`
    : offers.length > 0
      ? `${offers.length} plano${offers.length > 1 ? "s" : ""} de acompanhamento`
      : "Treino sob medida, correção e evolução de perto";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tactile relative block w-full overflow-hidden rounded-2xl border border-[#FFC24D]/45 bg-gradient-to-br from-[#FFC24D]/20 via-card to-card p-4 text-left"
        aria-label={`Treinar com ${main.name ?? "personal"}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {list.length > 1 ? (
              <div className="flex -space-x-3">
                {list.slice(0, 3).map((p) => (
                  <Avatar key={p.id} className={compact ? "h-11 w-11 border-2 border-card" : "h-14 w-14 border-2 border-card"}>
                    {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name ?? ""} /> : null}
                    <AvatarFallback className="bg-[#FFC24D]/25 font-black text-[#FFC24D]">{(p.name ?? "P").charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : (
              <Avatar className={compact ? "h-12 w-12 border-2 border-[#FFC24D]/60" : "h-16 w-16 border-2 border-[#FFC24D]/60"}>
                {main.avatar_url ? <AvatarImage src={main.avatar_url} alt={main.name ?? ""} /> : null}
                <AvatarFallback className="bg-[#FFC24D]/25 text-lg font-black text-[#FFC24D]">{first.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC24D] text-black ring-2 ring-card">
              <HeartHandshake className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#FFC24D]">Acompanhamento personalizado</p>
            <p className={compact ? "text-[14.5px] font-black leading-tight text-foreground" : "text-[16px] font-black leading-tight text-foreground"}>
              {list.length > 1 ? `Treine com ${list.slice(0, 3).map((p) => (p.name ?? "").trim().split(/\s+/)[0]).join(", ").replace(/, ([^,]*)$/, " ou $1")}` : `Treine com ${first}`}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{fromLine}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[#FFC24D]" />
        </div>
        {!compact && main.bio && list.length === 1 ? (
          <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-muted-foreground">“{main.bio}”</p>
        ) : null}
        {!compact ? (
          <span className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#FFC24D] py-2.5 text-[13px] font-black text-black">
            {list.length > 1 ? "Ver personais e planos" : `Quero treinar com ${first}`}
          </span>
        ) : null}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        {open ? (
          <PersonalChooser
            studentName={profile?.name ?? ""}
            goal={(profile as { objetivo?: string | null } | null)?.objetivo ?? profile?.goal ?? null}
            onSent={() => {}}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
