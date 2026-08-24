"use client";

import { Sparkles } from "lucide-react";

/**
 * Dica GymFitness — em produção, o `text` vem da rota /api/ai-tip
 * (LLM gera dica personalizada por sessões/estatísticas do aluno).
 * Hoje é uma rotação de frases educativas locais (TIPS) como fallback.
 */
export function DailyTip({ text }: { text: string }) {
  return (
    <section className="pm-surface flex items-center gap-4 p-6">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#FF9A5C]/25 bg-[#FF9A5C]/10 text-[#FF9A5C]">
        <Sparkles className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#050507] ring-1 ring-[#FF9A5C]/30">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF9A5C] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF9A5C]" />
          </span>
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="pm-mono flex items-center gap-1.5 text-[#FF9A5C]">
          Dica GymFitness
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[#D6DCEC]">{text}</p>
      </div>
    </section>
  );
}