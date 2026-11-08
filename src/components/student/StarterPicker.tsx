"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Dumbbell, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";
import { cn } from "~/lib/utils";

/**
 * Escolha do treino base (migration 074): 3 sugeridos para o sexo, nível e
 * dias do aluno + "ver todos". Escolheu → vira a ficha na hora, sem esperar
 * o personal. Também serve para TROCAR de treino base (ficha montada pelo
 * personal nunca é trocada por aqui).
 */

type Option = {
  id: string;
  label: string;
  description: string | null;
  split: string | null;
  level: string;
  days_per_week: number;
  days: string[];
  exercises: number;
  is_base: boolean;
  recommended: boolean;
};

const REASONS: Record<string, string> = {
  nao_aprovado: "Falta a recepção confirmar seu cadastro. Chama no WhatsApp que liberamos.",
  avaliacao_medica: "Pelo seu histórico de saúde, quem monta seu treino é o personal. Peça abaixo.",
  ficha_do_personal: "Você já tem um treino montado pelo seu personal. Para mudar, peça um ajuste a ele.",
  modelo_indisponivel: "Esse treino não está mais disponível. Escolha outro.",
};

const WHATSAPP_LIBERAR = "https://wa.me/5522997787186?text=" +
  encodeURIComponent("Oi! Quero liberar meu cadastro pra escolher meu treino no app.");

export function StarterPicker({
  onPicked,
  fallback = null,
  eyebrow = "Sem espera",
  title = "Escolha seu treino e comece hoje",
  subtitle = "Treinos prontos, montados nas divisões mais usadas. Seu personal acompanha e ajusta quando você quiser.",
}: {
  onPicked: () => void;
  /** o que mostrar se a academia não tiver nenhum treino pronto */
  fallback?: ReactNode;
  eyebrow?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { profile } = useAuth();

  const { data, loading } = useAsyncQuery<Option[]>(
    async () => {
      const { data: rows, error } = await supabaseBrowser().rpc("starter_options" as never);
      if (error) return { data: null, error };
      return { data: (rows as unknown as Option[]) ?? [], error: null };
    },
    []
  );

  const pick = async (o: Option) => {
    setBusyId(o.id);
    try {
      const { data: res, error } = await supabaseBrowser().rpc("pick_starter_plan" as never, { p_template: o.id } as never);
      if (error) throw error;
      const r = res as unknown as { ok: boolean; reason?: string };
      if (r.ok) {
        toast.success(`Treino "${o.label}" liberado! Bora começar 💪`);
        onPicked();
        return;
      }
      toast.message(REASONS[r.reason ?? ""] ?? "Não deu para liberar esse treino agora.");
    } catch (err) {
      logger.error("starter_plan.pick", err);
      toast.error("Não foi possível liberar o treino. Tente de novo.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" aria-label="Carregando treinos" />;
  }

  // Aluno ainda não aprovado: mostrar a lista e deixar tocar para depois
  // responder "não deu para liberar" é o que fazia o aluno achar que o app
  // travou. Aqui ele vê o que falta e fala direto com a recepção.
  if (profile?.role === "student" && !profile.approved_at) {
    return (
      <section className="rounded-2xl border border-brand/40 bg-brand/[0.08] p-4" aria-label="Cadastro aguardando confirmação">
        <p className="text-[11px] font-black uppercase tracking-wider text-brand">Quase lá</p>
        <h2 className="mt-0.5 text-[17px] font-black leading-tight text-foreground">
          Falta a recepção confirmar seu cadastro
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          Assim que confirmar, a lista de treinos aparece aqui e você começa no mesmo dia.
        </p>
        <a
          href={WHATSAPP_LIBERAR}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-black text-black"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
        </a>
      </section>
    );
  }

  const options = data ?? [];
  if (options.length === 0) return <>{fallback}</>;

  const visible = showAll ? options : options.filter((o) => o.recommended);
  const hiddenCount = options.length - options.filter((o) => o.recommended).length;

  return (
    <section className="space-y-3" aria-label="Escolha seu treino">
      <div>
        {eyebrow ? (
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
            <Sparkles className="h-4 w-4" /> {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-[17px] font-black leading-tight text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{subtitle}</p>
      </div>

      {visible.map((o, idx) => (
        <article
          key={o.id}
          className={cn(
            "gf-rise rounded-2xl border bg-card/70 p-4",
            o.recommended && idx === 0 && !showAll ? "border-brand/60 bg-gradient-to-br from-brand/15 via-card to-card" : "border-border"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-black text-foreground">{o.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                {o.label.includes(o.level) ? "" : `${o.level} · `}
                {o.days_per_week}x por semana · {o.exercises} exercícios
              </p>
            </div>
            {o.recommended && idx === 0 && !showAll ? (
              <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-brand-foreground">
                Para você
              </span>
            ) : null}
          </div>
          {o.description ? (
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{o.description}</p>
          ) : null}
          <ul className="mt-3 space-y-1.5">
            {o.days.map((d, i) => {
              const [letter, ...rest] = d.split(" · ");
              const named = rest.length > 0;
              return (
                <li key={i} className="flex items-center gap-2 text-[12.5px] text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-black text-brand">
                    {named ? letter : String.fromCharCode(65 + i)}
                  </span>
                  <span className="truncate">{named ? rest.join(" · ") : d}</span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void pick(o)}
            disabled={busyId !== null}
            className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[13.5px] font-black text-brand-foreground disabled:opacity-60"
          >
            <Dumbbell className="h-4 w-4" />
            {busyId === o.id ? "Liberando…" : "Começar este treino"}
          </button>
        </article>
      ))}

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="tactile flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-[12.5px] font-bold text-muted-foreground"
        >
          {showAll ? "Ver só os sugeridos" : `Ver todos os treinos (${options.length})`}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
        </button>
      ) : null}
    </section>
  );
}
