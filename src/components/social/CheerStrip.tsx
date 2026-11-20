"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { supabaseBrowser } from "~/lib/supabase/client";

/** Colega da mesma academia, vindo do ranking. */
export type CheerMate = { student_id: string; name: string | null; avatar_url: string | null };

const EMOJIS = ["💪", "🔥", "👊", "🙌", "👏"] as const;

function firstName(name: string | null): string {
  return (name ?? "").trim().split(" ")[0] || "Atleta";
}

function initials(name: string | null): string {
  return (name ?? "A").trim().slice(0, 2).toUpperCase();
}

/** Bolha 3D: anel laranja em degradê, brilho no topo e sombra de profundidade. */
export function Bubble({ src, name, size, onClick, delay = 0 }: { src: string | null; name: string | null; size: number; onClick?: () => void; delay?: number }) {
  return (
    <m.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
      className="relative shrink-0"
      style={{ width: size, height: size, transformStyle: "preserve-3d" }}
    >
      <m.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.92, rotateX: 10 }}
        whileHover={{ rotateX: -6, rotateY: 6 }}
        className="relative h-full w-full rounded-full p-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[#F4711E]"
        style={{
          background: "conic-gradient(from 200deg, rgba(255,178,122,0.55), rgba(244,113,30,0.7), rgba(184,71,11,0.55), rgba(244,113,30,0.7), rgba(255,178,122,0.55))",
          boxShadow: "0 6px 14px -6px rgba(244,113,30,0.35), inset 0 -3px 6px rgba(0,0,0,0.3)",
          transformStyle: "preserve-3d",
        }}
        aria-label={`Ver ${firstName(name)}`}
      >
        <span
          className="pointer-events-none absolute inset-[2px] z-10 rounded-full"
          style={{ background: "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.4), transparent 42%)" }}
          aria-hidden
        />
        <Avatar className="h-full w-full border border-black/40">
          <AvatarImage src={src ?? undefined} alt={name ?? "Atleta"} />
          <AvatarFallback className="bg-secondary text-[12px] font-black text-secondary-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
      </m.button>
    </m.div>
  );
}

/** Faixa de bolhas dos colegas, no topo do ranking. Tocar abre a folha de força. */
export function CheerStrip({ mates }: { mates: CheerMate[] }) {
  const [open, setOpen] = useState<CheerMate | null>(null);
  const [emoji, setEmoji] = useState<string>("💪");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  if (mates.length === 0) return null;

  const send = async () => {
    if (!open || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabaseBrowser().rpc("send_cheer" as never, { p_to: open.student_id, p_emoji: emoji } as never);
      if (error) throw new Error(error.message);
      const res = data as { ok?: boolean; motivo?: string } | null;
      if (res?.ok) {
        setSentTo((s) => new Set(s).add(open.student_id));
        toast.success(`${emoji} Força enviada pra ${firstName(open.name)}!`);
        setOpen(null);
      } else if (res?.motivo === "ja_enviou_hoje") {
        toast(`Você já mandou força pra ${firstName(open.name)} hoje. Amanhã manda de novo.`);
      } else {
        toast.error("Não deu pra enviar agora. Tenta de novo.");
      }
    } catch {
      toast.error("Sem conexão. Tenta de novo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Galera na academia" className="mb-5">
      <p className="gf-section mb-2">Galera na academia</p>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1" style={{ scrollbarWidth: "none" }}>
        {mates.map((mt, i) => (
          <div key={mt.student_id} className="flex snap-start flex-col items-center gap-1.5">
            <Bubble src={mt.avatar_url} name={mt.name} size={46} delay={i * 0.15} onClick={() => setOpen(mt)} />
            <span className="max-w-[56px] truncate text-[10px] font-medium text-muted-foreground/80">
              {sentTo.has(mt.student_id) ? "✓ " : ""}
              {firstName(mt.name)}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {open ? (
          <m.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <m.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 60, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-sm rounded-[24px] border border-border bg-card p-5 text-center shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={`Mandar força para ${firstName(open.name)}`}
            >
              <div className="mx-auto mb-3 flex justify-center">
                <Bubble src={open.avatar_url} name={open.name} size={96} />
              </div>
              <p className="text-base font-black">{firstName(open.name)}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Manda uma força e mostra que tá junto 🟠</p>

              <div className="mt-4 flex justify-center gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`h-11 w-11 rounded-2xl text-xl transition-transform active:scale-90 ${
                      emoji === e ? "bg-[#F4711E]/25 ring-2 ring-[#F4711E]" : "bg-white/5"
                    }`}
                    aria-pressed={emoji === e}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="mt-5 w-full rounded-2xl bg-[#F4711E] px-5 py-3.5 text-[14px] font-black text-black shadow-[0_0_20px_rgba(244,113,30,0.4)] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? "Enviando..." : `Mandar força ${emoji}`}
              </button>
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
