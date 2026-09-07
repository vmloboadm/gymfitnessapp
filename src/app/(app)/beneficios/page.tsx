"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, MessageCircle, Ticket, Plus, Pause, Play, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, EmptyState } from "~/components/common/AsyncStates";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { AiCoach } from "~/components/ai/AiCoachLazy";
import { cn } from "~/lib/utils";
import { isDemoMode } from "~/lib/demo-bridge";

type Sponsor = {
  id: string;
  gym_id: string | null;
  name: string;
  logo_url: string | null;
  discount_text: string;
  min_value: string | null;
  cta_type: "coupon" | "whatsapp";
  cta_value: string | null;
  active: boolean;
  ord: number;
};

/**
 * Benefícios do aluno: cards de patrocinadores globais com desconto.
 * Botão "Sou aluno GymFitness" revela o cupom ou abre o WhatsApp do parceiro.
 * Gestor cadastra/pausa parceiros direto aqui.
 */
export default function BeneficiosPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();
  const gymId = profile?.gym_id ?? "";
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const { data, loading, refetch } = useAsyncQuery<Sponsor[]>(
    async () => {
      if (demo) return { data: [], error: null };
      const sb = supabaseBrowser();
      if (!gymId) return { data: null, error: { message: "Sessão indisponível" } };
      const { data: rows, error } = await sb
        .from("sponsors")
        .select("*")
        .or(`gym_id.is.null,gym_id.eq.${gymId}`)
        .eq("active", true)
        .order("ord", { ascending: true });
      if (error) return { data: null, error };
      return { data: (rows ?? []) as Sponsor[], error: null };
    },
    [gymId, demo]
  );

  const sponsors = useMemo(() => data ?? [], [data]);

  if (loading) {
    return (
      <>
        <TopBar title="Benefícios" subtitle="Descontos de parceiros" />
        <div className="space-y-3 p-4"><SkeletonList rows={3} /></div>
        <AiCoach />
      </>
    );
  }

  return (
    <>
      <TopBar title="Benefícios" subtitle={`${sponsors.length} parceiro${sponsors.length === 1 ? "" : "s"} com desconto`} />
      <div className="mx-auto max-w-md space-y-3 p-4 pb-10">
        {sponsors.length === 0 ? (
          <EmptyState
            title="Em breve"
            description="Estamos fechando parcerias com descontos exclusivos para alunos GymFitness. Volte em alguns dias!"
            icon={Store}
          />
        ) : (
          sponsors.map((s) => (
            <article key={s.id} className="gf-card gf-glass relative overflow-hidden !p-4">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-[#FFC24D]" aria-hidden />
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-lg font-black text-brand-foreground">
                  {s.name[0]?.toUpperCase() ?? "P"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-black text-foreground">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-[#4ADE80]">
                    <BadgePercent className="h-3.5 w-3.5" /> {s.discount_text}
                  </p>
                  {s.min_value ? (
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">Válido {s.min_value}</p>
                  ) : null}
                </div>
              </div>
              {revealed.has(s.id) && s.cta_type === "coupon" && s.cta_value ? (
                <div className="mt-3 rounded-xl border border-dashed border-brand/50 bg-brand/[0.07] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seu cupom</p>
                  <p className="mt-0.5 font-display text-xl font-black tracking-widest text-brand">{s.cta_value}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Apresente na loja ou use no site do parceiro</p>
                </div>
              ) : (
                <CtaButton sponsor={s} revealed={revealed.has(s.id)} onReveal={() => setRevealed((p) => new Set(p).add(s.id))} />
              )}
            </article>
          ))
        )}

        {isManager && !demo ? (
          <ManagerSponsorForm gymId={gymId} open={showForm} onOpen={() => setShowForm(true)} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />
        ) : null}
      </div>
      <AiCoach />
    </>
  );
}

function CtaButton({ sponsor: s, revealed, onReveal }: { sponsor: Sponsor; revealed: boolean; onReveal: () => void }) {
  if (s.cta_type === "whatsapp" && s.cta_value) {
    const href = `https://wa.me/${s.cta_value.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Sou aluno GymFitness e quero meu desconto (${s.discount_text}).`)}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-[13px] font-black text-black shadow-lg"
      >
        <MessageCircle className="h-4 w-4" /> Sou aluno GymFitness — pedir desconto
      </a>
    );
  }
  return (
    <button
      onClick={onReveal}
      disabled={revealed && !s.cta_value}
      className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-60"
    >
      <Ticket className="h-4 w-4" /> Sou aluno GymFitness — ver desconto
    </button>
  );
}

/** Form do gestor: cadastrar parceiro (nome, desconto, mínimo, CTA). */
function ManagerSponsorForm({ gymId, open, onOpen, onClose, onSaved }: {
  gymId: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("");
  const [minValue, setMinValue] = useState("");
  const [ctaType, setCtaType] = useState<"coupon" | "whatsapp">("coupon");
  const [ctaValue, setCtaValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);
  const [all, setAll] = useState<Sponsor[]>([]);

  useEffect(() => {
    if (!managing || !gymId) return;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb
          .from("sponsors")
          .select("*")
          .or(`gym_id.is.null,gym_id.eq.${gymId}`)
          .order("ord");
        setAll((data ?? []) as Sponsor[]);
      } catch {
        setAll([]);
      }
    })();
  }, [managing, gymId]);

  const save = async () => {
    if (!name.trim() || !discount.trim() || saving) return;
    setSaving(true);
    const sb = supabaseBrowser();
    const { error } = await sb.from("sponsors").insert({
      gym_id: gymId,
      name: name.trim(),
      discount_text: discount.trim(),
      min_value: minValue.trim() || null,
      cta_type: ctaType,
      cta_value: ctaValue.trim() || null,
      active: true,
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Não deu salvar", { description: error.message });
      return;
    }
    toast.success("Parceiro cadastrado!");
    setName(""); setDiscount(""); setMinValue(""); setCtaValue("");
    onSaved();
  };

  const toggle = async (s: Sponsor) => {
    const sb = supabaseBrowser();
    await sb.from("sponsors").update({ active: !s.active } as never).eq("id", s.id);
    setAll((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
  };

  const remove = async (s: Sponsor) => {
    if (!window.confirm(`Remover ${s.name}?`)) return;
    const sb = supabaseBrowser();
    await sb.from("sponsors").delete().eq("id", s.id);
    setAll((prev) => prev.filter((x) => x.id !== s.id));
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="tactile flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-brand/10 py-3 text-[12px] font-bold text-brand"
        >
          <Plus className="h-4 w-4" /> Cadastrar parceiro
        </button>
        <button
          onClick={() => setManaging((v) => !v)}
          className="tactile rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[12px] font-bold text-muted-foreground"
        >
          {managing ? "Fechar" : "Gerenciar"}
        </button>
      </div>

      {managing && all.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {all.map((s) => (
            <li key={s.id} className={cn("flex items-center gap-2 rounded-xl border p-2.5", s.active ? "border-white/[0.06] bg-white/[0.03]" : "border-white/[0.04] bg-white/[0.01] opacity-60")}>
              <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-foreground">{s.name}</p>
              <button onClick={() => toggle(s)} aria-label={s.active ? `Pausar ${s.name}` : `Ativar ${s.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-brand">
                {s.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => remove(s)} aria-label={`Remover ${s.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-[#F87171]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <BottomSheet open={open} onClose={onClose}>
        <div className="space-y-3">
          <p className="text-base font-bold text-foreground">Novo parceiro</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do parceiro" aria-label="Nome do parceiro"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Desconto: ex. 15% em tudo" aria-label="Texto do desconto"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
          <input value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="Valor mínimo (opcional): ex. acima de R$ 100" aria-label="Valor mínimo"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
          <div className="flex gap-1.5" role="group" aria-label="Tipo de resgate">
            {(["coupon", "whatsapp"] as const).map((t) => (
              <button key={t} onClick={() => setCtaType(t)}
                className={cn("flex-1 rounded-xl border py-2.5 text-[11px] font-bold transition-colors",
                  ctaType === t ? "border-brand bg-brand/15 text-brand" : "border-white/[0.08] bg-white/[0.03] text-muted-foreground")}>
                {t === "coupon" ? "Cupom no app" : "WhatsApp do parceiro"}
              </button>
            ))}
          </div>
          <input value={ctaValue} onChange={(e) => setCtaValue(e.target.value)} placeholder={ctaType === "coupon" ? "Código do cupom: ex. GF15" : "WhatsApp: ex. 5522999999999"} aria-label="Cupom ou WhatsApp"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50" />
          <button onClick={save} disabled={!name.trim() || !discount.trim() || saving}
            className="h-12 w-full rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40">
            {saving ? "Salvando..." : "Cadastrar parceiro"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
