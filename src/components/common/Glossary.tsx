"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

export type GlossaryItem = { term: string; text: string };

/**
 * Dicionário leigo: explica siglas/jargões do treino em português claro,
 * sem sair da tela. Um item aberto por vez (leve, sem lib externa).
 */
export function GlossaryCard({
  items,
  title = "Dicionário do treino",
  subtitle = "Sem grilo: o que cada palavra significa",
  className,
}: {
  items: GlossaryItem[];
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className={cn("gf-card gf-glass !py-4", className)}>
      <div className="mb-1 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-brand" />
        <p className="gf-section">{title}</p>
      </div>
      <p className="gf-card-text mb-2">{subtitle}</p>
      <div className="space-y-1">
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <div key={it.term} className="overflow-hidden rounded-xl border border-border bg-card/40">
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                aria-expanded={open}
                className="gf-touch flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-[13px] font-semibold text-foreground">{it.term}</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
                />
              </button>
              {open ? (
                <p className="animate-fade-in px-3 pb-3 text-[12px] leading-relaxed text-muted-foreground">{it.text}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dica pontual inline (uma linha expansível) para um termo específico. */
export function GlossaryTip({
  term,
  children,
  className,
}: {
  term: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card/40", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="gf-touch flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">?</span>
        <span className="flex-1 text-xs font-semibold text-foreground">O que é {term}?</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <p className="animate-fade-in px-3 pb-3 text-[12px] leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}
