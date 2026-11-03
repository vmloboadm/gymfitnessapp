"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Painel da equipe: quantos alunos aprovados estão sem ficha e atalho para
 * o treino inicial automático. Some quando todo mundo tem treino.
 */
export function StarterPlanCard() {
  const [s, setS] = useState<{ without_plan: number; medical: number } | null>(null);
  const [templates, setTemplates] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const sb = supabaseBrowser();
      const [st, tp] = await Promise.all([
        sb.rpc("starter_plan_status" as never),
        sb.from("starter_templates" as never).select("id", { count: "exact", head: true }),
      ]);
      if (!alive) return;
      setS((st.data as unknown as { without_plan: number; medical: number } | null) ?? null);
      setTemplates(tp.count ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!s || s.without_plan === 0) return null;

  return (
    <Link
      href="/personal/treino-inicial"
      className="tactile gf-card gf-glass flex items-center gap-3 !rounded-2xl !border-warning/40 !p-3.5 transition-transform active:scale-[0.985]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-warning/40 bg-warning/10 text-warning">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-foreground">
          {s.without_plan} aluno{s.without_plan === 1 ? "" : "s"} sem ficha de treino
        </p>
        <p className="text-[11px] text-muted-foreground">
          {templates === 0
            ? "Escolha um modelo inicial e eles já começam a treinar hoje"
            : "Eles já podem escolher um treino pronto. Ou aplique em 1 toque"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
