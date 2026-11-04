"use client";

import { useEffect, useState } from "react";
import { Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";
import { formatBRL } from "~/lib/money";

/**
 * "Indique um amigo" (migration 083): o aluno manda o link com o próprio
 * código. Cada amigo que se matricula (e é aprovado) rende desconto na
 * mensalidade. Sem limite de indicações.
 */

type Referral = {
  code: string | null;
  total: number;
  approved: number;
  credit_cents: number;
  per_friend_cents: number;
};

function inviteLink(code: string): string {
  return `${window.location.origin}/app/register?ref=${encodeURIComponent(code)}`;
}

function inviteText(code: string): string {
  return `Bora treinar comigo na GymFitness? Cadastra pelo meu link: ${inviteLink(code)}`;
}

export function IndicaCard() {
  const [data, setData] = useState<Referral | null>(null);

  useEffect(() => {
    let alive = true;
    supabaseBrowser()
      .rpc("my_referral" as never)
      .then(({ data: row, error }) => {
        if (!alive) return;
        if (error) {
          logger.error("referral.load", error);
          return;
        }
        setData(row as Referral);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!data?.code) return null;
  const code = data.code;

  const share = async () => {
    const text = inviteText(code);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "GymFitness", text, url: inviteLink(code) });
        return;
      } catch {
        // cancelado pelo usuário: cai no copiar
      }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      toast.success("Link copiado! Manda para seu amigo.");
    } catch (err) {
      logger.error("referral.copy", err);
      toast.error("Não consegui copiar", { description: inviteLink(code) });
    }
  };

  return (
    <article className="gf-rise overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Gift className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">Indique um amigo</h3>
          <p className="text-sm text-muted-foreground">
            Cada amigo que se matricular pelo seu link te dá {formatBRL(data.per_friend_cents)} de desconto
            na mensalidade. Sem limite.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-background/60 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seu código</p>
          <p className="font-mono text-lg font-semibold tracking-widest">{code}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
          >
            <Copy className="size-4" aria-hidden /> Copiar
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white"
          >
            <Share2 className="size-4" aria-hidden /> Enviar
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm">
        {data.total === 0 ? (
          <span className="text-muted-foreground">Ainda não tem amigos indicados. Manda o link pra quem treina com você.</span>
        ) : (
          <>
            <strong>{data.approved}</strong> {data.approved === 1 ? "amigo matriculado" : "amigos matriculados"} ·{" "}
            <strong>{formatBRL(data.credit_cents)}</strong> de desconto acumulado
            {data.total > data.approved && (
              <span className="text-muted-foreground"> · {data.total - data.approved} aguardando aprovação</span>
            )}
          </>
        )}
      </p>
    </article>
  );
}
