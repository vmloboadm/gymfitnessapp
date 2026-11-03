"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartHandshake, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";
import { cn } from "~/lib/utils";
import { formatBRL, parseBRLToCents } from "~/lib/money";

/**
 * "Meus planos de acompanhamento" (perfil do personal): o que aparece para o
 * aluno em Treino → Seu personal → Acompanhamento. Preço é opcional (vazio =
 * "valor a combinar"). Regras de acesso no banco (migration 076).
 */

type Offer = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  sessions_per_week: number | null;
  duration_label: string | null;
  active: boolean;
  sort: number;
  promo_price_cents: number | null;
  promo_label: string | null;
  promo_until: string | null;
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  price: string;
  sessions: string;
  duration: string;
  promoPrice: string;
  promoLabel: string;
  promoUntil: string;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  price: "",
  sessions: "",
  duration: "por mês",
  promoPrice: "",
  promoLabel: "Black Friday",
  promoUntil: "2026-11-30",
};

const EXAMPLES = [
  { title: "Acompanhamento 3x por semana", sessions: "3", price: "", duration: "por mês" },
  { title: "Consultoria online (treino + ajustes)", sessions: "", price: "", duration: "por mês" },
  { title: "Aula avulsa", sessions: "1", price: "", duration: "por aula" },
];

export function OffersEditor({ trainerId, gymId }: { trainerId: string; gymId: string }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser()
      .from("personal_offers" as never)
      .select("id, title, description, price_cents, sessions_per_week, duration_label, active, sort, promo_price_cents, promo_label, promo_until")
      .eq("trainer_id", trainerId)
      .order("sort")
      .order("created_at");
    if (error) {
      logger.error("offers.load", error);
      setOffers([]);
      return;
    }
    setOffers((data as unknown as Offer[]) ?? []);
  }, [trainerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (title.length < 2) {
      toast.message("Dê um nome ao plano.");
      return;
    }
    const price = draft.price.trim() ? parseBRLToCents(draft.price) : null;
    if (draft.price.trim() && price === null) {
      toast.message("Preço inválido. Ex.: 250 ou 250,00");
      return;
    }
    const sessions = draft.sessions.trim() ? Number(draft.sessions) : null;
    const promo = draft.promoPrice.trim() ? parseBRLToCents(draft.promoPrice) : null;
    if (draft.promoPrice.trim() && promo === null) {
      toast.message("Preço promocional inválido. Ex.: 199 ou 199,90");
      return;
    }
    if (promo !== null && (!draft.promoUntil || (price !== null && promo >= price))) {
      toast.message(!draft.promoUntil ? "Diga até quando vale a promoção." : "O preço promocional precisa ser menor que o normal.");
      return;
    }
    const row = {
      gym_id: gymId,
      trainer_id: trainerId,
      title,
      description: draft.description.trim() || null,
      price_cents: price,
      sessions_per_week: sessions && sessions >= 1 && sessions <= 7 ? sessions : null,
      duration_label: draft.duration.trim() || null,
      promo_price_cents: promo,
      promo_label: promo !== null ? draft.promoLabel.trim() || "Promoção" : null,
      promo_until: promo !== null ? draft.promoUntil : null,
    };
    setSaving(true);
    const sb = supabaseBrowser();
    const { error } = draft.id
      ? await sb.from("personal_offers" as never).update(row as never).eq("id", draft.id)
      : await sb.from("personal_offers" as never).insert({ ...row, sort: offers?.length ?? 0 } as never);
    setSaving(false);
    if (error) {
      logger.error("offers.save", error);
      toast.error("Não foi possível salvar o plano.");
      return;
    }
    toast.success(draft.id ? "Plano atualizado." : "Plano criado! Já aparece para os alunos.");
    setDraft(null);
    void load();
  };

  const toggle = async (o: Offer) => {
    const { error } = await supabaseBrowser()
      .from("personal_offers" as never)
      .update({ active: !o.active } as never)
      .eq("id", o.id);
    if (error) return toast.error("Não foi possível alterar.");
    void load();
  };

  const remove = async (o: Offer) => {
    if (!window.confirm(`Apagar o plano "${o.title}"?`)) return;
    const { error } = await supabaseBrowser().from("personal_offers" as never).delete().eq("id", o.id);
    if (error) return toast.error("Não foi possível apagar.");
    void load();
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]";

  return (
    <section className="gf-card gf-glass space-y-3 !p-4" aria-labelledby="offers-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="offers-title" className="flex items-center gap-1.5 text-[14px] font-black text-foreground">
            <HeartHandshake className="h-4 w-4 text-[#FFC24D]" /> Meus planos de acompanhamento
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            Aparecem para os alunos em Treino → Seu personal. Eles escolhem e te chamam no WhatsApp já com o plano.
          </p>
        </div>
        {!draft ? (
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="tactile flex shrink-0 items-center gap-1 rounded-lg border border-brand/40 px-2.5 py-1 text-[11px] font-bold text-brand"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        ) : null}
      </div>

      {offers === null ? <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" /> : null}

      {offers && offers.length === 0 && !draft ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-muted-foreground">Comece por um destes exemplos (dá para editar):</p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.title}
              type="button"
              onClick={() => setDraft({ ...EMPTY, ...ex })}
              className="tactile flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-[12.5px] font-semibold text-foreground"
            >
              {ex.title} <Plus className="h-4 w-4 text-brand" />
            </button>
          ))}
        </div>
      ) : null}

      {offers?.map((o) => (
        <div key={o.id} className={cn("rounded-xl border border-border p-3", !o.active && "opacity-60")}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground">{o.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatBRL(o.price_cents)}
                {o.price_cents !== null && o.duration_label ? ` ${o.duration_label}` : ""}
                {o.sessions_per_week ? ` · ${o.sessions_per_week}x por semana` : ""}
                {!o.active ? " · pausado" : ""}
                {o.promo_price_cents !== null && o.promo_until
                  ? ` · ${o.promo_label ?? "Promoção"} ${formatBRL(o.promo_price_cents)} até ${o.promo_until.slice(8, 10)}/${o.promo_until.slice(5, 7)}`
                  : ""}
              </p>
            </div>
            <button type="button" aria-label="Editar plano" onClick={() => setDraft({
              id: o.id,
              title: o.title,
              description: o.description ?? "",
              price: o.price_cents === null ? "" : (o.price_cents / 100).toFixed(2).replace(".", ","),
              sessions: o.sessions_per_week ? String(o.sessions_per_week) : "",
              duration: o.duration_label ?? "",
              promoPrice: o.promo_price_cents === null ? "" : (o.promo_price_cents / 100).toFixed(2).replace(".", ","),
              promoLabel: o.promo_label ?? "Black Friday",
              promoUntil: o.promo_until ?? "2026-11-30",
            })} className="tactile rounded-full p-1.5 text-muted-foreground hover:text-brand">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label={o.active ? "Pausar plano" : "Reativar plano"} onClick={() => void toggle(o)} className="tactile rounded-full p-1.5 text-muted-foreground hover:text-brand">
              {o.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button type="button" aria-label="Apagar plano" onClick={() => void remove(o)} className="tactile rounded-full p-1.5 text-muted-foreground hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {o.description ? <p className="mt-1 text-[11.5px] text-muted-foreground">{o.description}</p> : null}
        </div>
      ))}

      {draft ? (
        <div className="space-y-2 rounded-xl border border-brand/40 p-3">
          <input className={input} placeholder="Nome do plano (ex.: Acompanhamento 3x por semana)" aria-label="Nome do plano"
            value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className={cn(input, "resize-none")} rows={2} maxLength={400} aria-label="O que está incluso"
            placeholder="O que está incluso (opcional): avaliação, ajustes semanais, WhatsApp…"
            value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Preço (R$)</span>
            <span>Período</span>
            <span>Vezes/semana</span>
          </div>
          <div className="-mt-1 grid grid-cols-3 gap-2">
            <input className={input} inputMode="decimal" placeholder="250,00" aria-label="Preço em reais (vazio = a combinar)"
              value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            <input className={input} placeholder="por mês" aria-label="Período do preço"
              value={draft.duration} maxLength={40} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
            <input className={input} inputMode="numeric" placeholder="3" aria-label="Vezes por semana"
              value={draft.sessions} onChange={(e) => setDraft({ ...draft, sessions: e.target.value.replace(/\D/g, "").slice(0, 1) })} />
          </div>
          <p className="text-[10.5px] text-muted-foreground">Preço vazio aparece como “valor a combinar”.</p>
          <div className="rounded-lg border border-white/15 bg-black/40 p-2.5">
            <p className="text-[11px] font-black text-foreground">🖤 Preço promocional (opcional)</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Promo (R$)</span>
              <span>Nome</span>
              <span>Vale até</span>
            </div>
            <div className="mt-0.5 grid grid-cols-3 gap-2">
              <input className={input} inputMode="decimal" placeholder="199,00" aria-label="Preço promocional"
                value={draft.promoPrice} onChange={(e) => setDraft({ ...draft, promoPrice: e.target.value })} />
              <input className={input} placeholder="Black Friday" aria-label="Nome da promoção" maxLength={30}
                value={draft.promoLabel} onChange={(e) => setDraft({ ...draft, promoLabel: e.target.value })} />
              <input className={input} type="date" aria-label="Promoção vale até"
                value={draft.promoUntil} onChange={(e) => setDraft({ ...draft, promoUntil: e.target.value })} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">O aluno vê “de R$ X por R$ Y” com o selo até essa data.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="tactile flex-1 rounded-xl border border-border py-2.5 text-[12.5px] font-bold text-muted-foreground">
              Cancelar
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="tactile flex-1 rounded-xl bg-brand py-2.5 text-[12.5px] font-black text-brand-foreground disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar plano"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
