"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ClipboardPen, HeartHandshake, MessageCircle, Repeat, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { supabaseBrowser } from "~/lib/supabase/client";
import { normalizeBRPhone } from "~/lib/whatsapp";
import { formatBRL } from "~/lib/money";
import { toast } from "sonner";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { StarterPicker } from "~/components/student/StarterPicker";
import { useAuth } from "~/hooks/useAuth";
import { isOffline } from "~/lib/offline-queue";
import { logger } from "~/lib/logger";

/**
 * Caixa "Seu personal", sempre visível na aba Treino: pedir ajuste, pedir um
 * treino feito pelo personal, contratar acompanhamento e trocar de treino
 * base. Cada pedido cai em Aprovações e avisa a equipe (sininho + push).
 */

type Kind = "acompanhamento" | "treino" | "ajuste";

const KINDS: Record<Kind, { title: string; text: string; placeholder: string; cta: string; sent: string }> = {
  acompanhamento: {
    title: "Acompanhamento com personal",
    text: "Treino sob medida, correção de execução e evolução acompanhada de perto.",
    placeholder: "Seu objetivo, dias e horários que prefere… (opcional)",
    cta: "Quero acompanhamento",
    sent: "Pedido enviado! O personal vai falar com você.",
  },
  treino: {
    title: "Treino feito pelo personal",
    text: "O personal monta uma ficha só para você, do seu jeito.",
    placeholder: "Objetivo, lesões, o que gosta ou não gosta… (opcional)",
    cta: "Pedir meu treino",
    sent: "Pedido enviado ao personal!",
  },
  ajuste: {
    title: "Ajuste no meu treino",
    text: "Trocar exercício, mudar carga, dor ou desconforto.",
    placeholder: "O que você quer ajustar?",
    cta: "Enviar pedido",
    sent: "Pedido de ajuste enviado!",
  },
};

export function PersonalSupportBox({ onPlanChanged, hasPlan }: { onPlanChanged: () => void; hasPlan: boolean }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState<Kind | "trocar" | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Set<Kind>>(new Set());

  const send = async (kind: Kind) => {
    if (!user || !profile?.gym_id) return;
    if (kind === "ajuste" && !text.trim()) {
      toast.message("Conte rapidinho o que você quer ajustar.");
      return;
    }
    if (isOffline()) {
      toast.error("Sem internet agora. Tente de novo quando conectar.");
      return;
    }
    setSending(true);
    try {
      const { submitRequest } = await import("~/lib/gym-api");
      await submitRequest({
        gymId: profile.gym_id,
        userId: user.id,
        userName: profile.name ?? "Aluno",
        type: kind,
        message: text.trim() || KINDS[kind].title,
      });
      toast.success(KINDS[kind].sent);
      setSent((s) => new Set(s).add(kind));
      setText("");
      setOpen(null);
    } catch (err) {
      logger.error("support_request.send", err, { kind });
      toast.error("Não foi possível enviar. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  const Row = ({ kind, icon: Icon, highlight }: { kind: Kind; icon: typeof HeartHandshake; highlight?: boolean }) => (
    <button
      type="button"
      onClick={() => setOpen(kind)}
      className={
        highlight
          ? "tactile flex w-full items-center gap-3 rounded-xl border border-[#FFC24D]/40 bg-gradient-to-br from-[#FFC24D]/15 via-card to-card p-3 text-left"
          : "tactile flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left"
      }
    >
      <span
        className={
          highlight
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC24D]/20 text-[#FFC24D]"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand"
        }
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-foreground">{KINDS[kind].title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {sent.has(kind) ? "Pedido enviado ✓" : KINDS[kind].text}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );

  return (
    <section className="space-y-2" aria-label="Fale com o personal">
      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Seu personal</p>
      <Row kind="acompanhamento" icon={HeartHandshake} highlight />
      <Row kind="treino" icon={ClipboardPen} />
      {hasPlan ? <Row kind="ajuste" icon={SlidersHorizontal} /> : null}
      {hasPlan ? (
        <button
          type="button"
          onClick={() => setOpen("trocar")}
          className="tactile flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand">
            <Repeat className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-foreground">Trocar de treino pronto</span>
            <span className="block truncate text-[11px] text-muted-foreground">AB, ABC, ABCD ou ABCDE</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : null}

      <BottomSheet open={open !== null} onClose={() => setOpen(null)}>
        {open === "trocar" ? (
          <div className="max-h-[75dvh] overflow-y-auto p-1 pb-4">
            <StarterPicker
              eyebrow={null}
              title="Trocar de treino"
              subtitle="O treino atual fica no seu histórico. Se o seu treino foi montado pelo personal, peça um ajuste a ele."
              onPicked={() => {
                setOpen(null);
                onPlanChanged();
              }}
            />
          </div>
        ) : open === "acompanhamento" ? (
          <PersonalChooser
            studentName={profile?.name ?? ""}
            goal={(profile as { objetivo?: string | null; goal?: string | null } | null)?.objetivo ?? profile?.goal ?? null}
            onSent={() => {
              setSent((s) => new Set(s).add("acompanhamento"));
            }}
          />
        ) : open ? (
          <div className="space-y-3 p-1 pb-4">
            <h2 className="pr-10 text-lg font-black text-foreground">{KINDS[open].title}</h2>
            <p className="text-[13px] text-muted-foreground">{KINDS[open].text}</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder={KINDS[open].placeholder}
              aria-label={KINDS[open].placeholder}
              className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[13px]"
            />
            <button
              type="button"
              onClick={() => void send(open)}
              disabled={sending}
              className="tactile w-full rounded-xl bg-brand py-3 text-[14px] font-black text-brand-foreground disabled:opacity-60"
            >
              {sending ? "Enviando…" : KINDS[open].cta}
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}

type Offer = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  sessions_per_week: number | null;
  duration_label: string | null;
};
export type Personal = {
  id: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  offers?: Offer[];
};

const priceLine = (o: Offer) =>
  `${formatBRL(o.price_cents)}${o.price_cents !== null && o.duration_label ? ` ${o.duration_label}` : ""}`;

/** Escolha do personal: foto, nome, bio e WhatsApp com mensagem pronta. */
export function PersonalChooser({ studentName, goal, onSent }: { studentName: string; goal: string | null; onSent: () => void }) {
  const [list, setList] = useState<Personal[] | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await supabaseBrowser().rpc("gym_personals" as never);
      if (!alive) return;
      if (error) {
        logger.error("coaching.list", error);
        setList([]);
        return;
      }
      setList((data as unknown as Personal[]) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "";
  const message = (p: Personal, o?: Offer) =>
    `Oi, ${firstName(p.name)}! Sou ${studentName.trim() || "aluno(a)"} da GymFitness. ` +
    (o
      ? `Vi no app o seu plano "${o.title}" (${priceLine(o)}) e quero contratar.`
      : `Vi seu perfil no app e quero saber como funciona o acompanhamento com você.`) +
    (goal ? ` Meu objetivo é ${goal.toLowerCase()}.` : "");

  // registra o pedido e avisa o personal; não espera, para o WhatsApp abrir
  // ainda dentro do toque (senão o celular bloqueia a abertura)
  const record = (p: Personal, o?: Offer) => {
    void (async () => {
      const { error } = await supabaseBrowser().rpc(
        "request_coaching" as never,
        { p_trainer: p.id, p_message: null, p_offer: o?.id ?? null } as never
      );
      if (error) logger.error("coaching.request", error);
    })();
    setDone(o?.id ?? p.id);
    onSent();
  };

  if (list === null) return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />;

  return (
    <div className="max-h-[75dvh] space-y-3 overflow-y-auto p-1 pb-4">
      <h2 className="pr-10 text-lg font-black text-foreground">Acompanhamento com personal</h2>
      <p className="text-[13px] text-muted-foreground">
        Escolha o personal e fale direto com ele no WhatsApp. A mensagem já vai pronta.
      </p>
      {list.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum personal cadastrado na academia ainda.</p>
      ) : null}
      {list.map((p) => {
        const phone = normalizeBRPhone(p.phone);
        const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message(p))}` : null;
        return (
          <article key={p.id} className="rounded-2xl border border-border bg-card/70 p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border border-white/[0.08]">
                {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name ?? "Personal"} /> : null}
                <AvatarFallback className="bg-brand/20 text-[15px] font-black text-brand">
                  {(p.name ?? "P").trim().charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black text-foreground">{p.name ?? "Personal"}</p>
                <p className="text-[11px] font-semibold text-brand">Personal trainer</p>
              </div>
            </div>
            {p.bio ? <p className="mt-2 line-clamp-4 text-[12.5px] leading-snug text-muted-foreground">{p.bio}</p> : null}
            {phone && p.offers && p.offers.length > 0 ? (
              <div className="mt-3 space-y-2">
                {p.offers.map((o) => (
                  <div key={o.id} className="rounded-xl border border-[#FFC24D]/35 bg-gradient-to-br from-[#FFC24D]/10 via-card to-card p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-black text-foreground">{o.title}</p>
                      <p className="shrink-0 text-[13px] font-black text-[#FFC24D]">{formatBRL(o.price_cents)}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {[o.price_cents !== null ? o.duration_label : null, o.sessions_per_week ? `${o.sessions_per_week}x por semana` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {o.description ? <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{o.description}</p> : null}
                    <a
                      href={`https://wa.me/${phone}?text=${encodeURIComponent(message(p, o))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => record(p, o)}
                      className="tactile mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-[13px] font-black text-black"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {done === o.id ? "Abrir WhatsApp de novo" : "Quero este plano"}
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
            {href && p.offers && p.offers.length > 0 ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => record(p)}
                className="tactile mt-2 block text-center text-[12px] font-bold text-muted-foreground underline-offset-2 hover:underline"
              >
                Só quero conversar com {firstName(p.name)}
              </a>
            ) : href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => record(p)}
                className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[14px] font-black text-black"
              >
                <MessageCircle className="h-4 w-4" />
                {done === p.id ? "Abrir WhatsApp de novo" : `Chamar ${firstName(p.name)} no WhatsApp`}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  record(p);
                  toast.success("Pedido enviado! O personal vai falar com você.");
                }}
                className="tactile mt-3 w-full rounded-xl bg-brand py-3 text-[14px] font-black text-brand-foreground"
              >
                {done === p.id ? "Pedido enviado ✓" : "Pedir pelo app"}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
