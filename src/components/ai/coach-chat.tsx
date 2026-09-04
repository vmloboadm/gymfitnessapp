"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Send, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Assistente de Treino: bolha de chat flutuante nas telas principais do
 * aluno. Resposta real do modelo fluindo token a token (proxy SSE da
 * /api/assistente); sem conexão com o modelo, mostra aviso amigável.
 * Escuta o evento `gf-ask-ai` para abrir com contexto pré-preenchido
 * (botão "Perguntar" por exercício).
 */

type Bubble = { id: number; role: "user" | "ai"; text: string; done?: boolean };

const QUICK = [
  "Posso treinar perna hoje?",
  "Supino: senti o ombro, o que ajusto?",
  "Cansei na última série, devo baixar a carga?",
];


/** Personal GymFitness: resposta CURTA, direta, no assunto (máx 3 frases). */
function _concise(s: string): string {
const parts = s.split(/(?<=[.!?])\s+/);
return parts.slice(0, 3).join(" ");
}
// openAiCoach mudou para ~/components/ai/coach-bus (evita puxar o chat no bundle)

export default function AiCoach() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const concise = (s: string) => s.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) {
        setPending(detail.query);
        setOpen(true);
      }
    };
    document.addEventListener("gf-ask-ai", handler);
    return () => document.removeEventListener("gf-ask-ai", handler);
  }, []);

  useEffect(() => {
    if (pending && open) {
      const query = pending;
      setPending(null);
      setInput("");
      setBubbles((prev) => [...prev, { id: idRef.current++, role: "user", text: query }]);
      const bubbleId = idRef.current++;
      setBubbles((prev) => [...prev, { id: bubbleId, role: "ai", text: "", done: false }]);
      void askStreaming(query, bubbleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [bubbles, thinking, open]);

  const OFFLINE = "O Assistente está offline no momento. Tente novamente.";

  /** Pergunta ao modelo via /api/assistente com streaming real: os tokens
   *  chegam e aparecem na bolha na hora. Sem modelo → aviso amigável. */
  async function askStreaming(q: string, bubbleId: number): Promise<void> {
    const history = bubbles
      .slice(-8)
      .map((b) => ({ role: b.role === "user" ? "user" : "assistant", content: b.text }));
    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context: "aluno", history, stream: true }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setBubbles((prev) =>
          prev.map((b) => (b.id === bubbleId ? { ...b, text: data.error ?? OFFLINE, done: true } : b))
        );
        toast.error(data.error ?? OFFLINE);
        return;
      }

      const ct = res.headers.get("Content-Type") ?? "";
      if (ct.includes("application/json")) {
        // roteador não streamou: resposta única animada pelo StreamingText
        const data = (await res.json()) as { ok?: boolean; text?: string };
        const text = data.ok && data.text ? concise(data.text) : OFFLINE;
        setBubbles((prev) => prev.map((b) => (b.id === bubbleId ? { ...b, text, done: false } : b)));
        if (!data.ok) toast.error(OFFLINE);
        return;
      }

      // SSE/texto fluindo: adiciona cada token direto na bolha
      const reader = res.body?.getReader();
      if (!reader) throw new Error("sem corpo");
      const dec = new TextDecoder();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        if (!chunk) continue;
        received += chunk.length;
        setBubbles((prev) =>
          prev.map((b) => (b.id === bubbleId ? { ...b, text: b.text + chunk, done: false } : b))
        );
      }
      if (received === 0) throw new Error("stream vazio");
      setBubbles((prev) => prev.map((b) => (b.id === bubbleId ? { ...b, done: true } : b)));
    } catch {
      setBubbles((prev) => prev.map((b) => (b.id === bubbleId ? { ...b, text: OFFLINE, done: true } : b)));
      toast.error(OFFLINE);
    }
  }

  const send = (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setInput("");
    setBubbles((prev) => [...prev, { id: idRef.current++, role: "user", text: q }]);
    const bubbleId = idRef.current++;
    setBubbles((prev) => [...prev, { id: bubbleId, role: "ai", text: "", done: false }]);
    setThinking(false);
    void askStreaming(q, bubbleId);
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="gf-touch fixed bottom-[88px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_12px_28px_-8px_rgba(244,113,30,0.55)]"
        whileTap={{ scale: 0.9 }}
        aria-label={open ? "Fechar Assistente de Treino" : "Abrir Assistente de Treino"}
      >
        {open ? <X className="h-6 w-6" /> : <Dumbbell className="h-6 w-6" />}
        {!open && <span className="hero-live-dot absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-success" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-44 z-40 mx-auto flex max-h-[60vh] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-brand/15 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">Assistente de Treino</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> online · responde em tempo real
                  </p>
                </div>
              </div>
            </div>

            <div ref={listRef} className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {bubbles.length === 0 && !thinking && (
                <div className="space-y-2">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                    Oi! Sou seu assistente de treino. Pergunta qualquer coisa sobre o seu dia, exercício, carga ou dor, respondo a partir dos seus dados.
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="gf-touch rounded-full border border-border bg-card/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bubbles.map((b) =>
                b.role === "user" ? (
                  <div key={b.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3 py-2.5 text-[13px] leading-relaxed text-brand-foreground">
                      {b.text}
                    </div>
                  </div>
                ) : (
                  <div key={b.id} className="flex items-end gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                      <Dumbbell className="h-3.5 w-3.5" />
                    </span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                      <StreamingText text={b.text} />
                    </div>
                  </div>
                )
              )}

              {thinking && (
                <div className="flex items-end gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                    <Dumbbell className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card/60 px-4 py-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:600ms]" />
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-white/10 bg-[#0A0F1C] p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre seu treino..."
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-400 focus:border-brand/60"
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className="gf-touch flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StreamingText({ text }: { text: string }) {
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (len >= text.length) return;
    const t = setTimeout(() => setLen((l) => Math.min(text.length, l + 8)), 16);
    return () => clearTimeout(t);
  }, [len, text]);

  const done = len >= text.length;
  return (
    <>
      {text.slice(0, len)}
      {!done && <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-brand align-middle" />}
    </>
  );
}