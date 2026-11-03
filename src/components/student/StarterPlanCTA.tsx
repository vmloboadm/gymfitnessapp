"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";

/**
 * Aluno aprovado e sem ficha: pega na hora o treino inicial da academia
 * (modelo escolhido pelo personal, que depois revisa). Se a academia ainda
 * não tem modelo, ou o aluno precisa de avaliação médica, explica e some.
 */
const REASONS: Record<string, string> = {
  sem_modelo: "Sua academia ainda não liberou o treino inicial. O personal já foi avisado.",
  avaliacao_medica: "Pelo seu histórico de saúde, o personal monta seu treino pessoalmente.",
  nao_aprovado: "Seu cadastro ainda está em aprovação.",
  ja_tem_ficha: "Você já tem um treino. Atualizando…",
};

export function StarterPlanCTA({ studentId, onAssigned }: { studentId: string; onAssigned: () => void }) {
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const take = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabaseBrowser().rpc("assign_starter_plan" as never, { p_student: studentId } as never);
      if (error) throw error;
      const r = data as unknown as { ok: boolean; reason?: string; template?: string };
      if (r.ok || r.reason === "ja_tem_ficha") {
        toast.success("Seu treino está pronto! Bora começar 💪");
        onAssigned();
        return;
      }
      toast.message(REASONS[r.reason ?? ""] ?? "Não deu para liberar agora.");
      setHidden(true);
    } catch (err) {
      logger.error("starter_plan.assign", err);
      toast.error("Não foi possível liberar o treino agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gf-rise rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/20 via-card to-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
        <Sparkles className="h-4 w-4" /> Comece hoje
      </p>
      <p className="mt-1 text-[15px] font-black text-foreground">Receba o treino inicial da academia</p>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
        Montado pelo personal para o seu nível e os seus dias. Ele revisa e ajusta depois, você já treina hoje.
      </p>
      <button
        type="button"
        onClick={() => void take()}
        disabled={busy}
        className="tactile mt-3 w-full rounded-xl bg-brand py-3 text-[14px] font-black text-brand-foreground disabled:opacity-60"
      >
        {busy ? "Liberando…" : "Quero meu treino"}
      </button>
    </div>
  );
}
