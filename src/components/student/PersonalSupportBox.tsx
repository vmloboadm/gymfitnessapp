"use client";

import { useState } from "react";
import { ChevronRight, ClipboardPen, HeartHandshake, Repeat, SlidersHorizontal } from "lucide-react";
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
        ) : open ? (
          <div className="space-y-3 p-1 pb-4">
            <h2 className="text-lg font-black text-foreground">{KINDS[open].title}</h2>
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
