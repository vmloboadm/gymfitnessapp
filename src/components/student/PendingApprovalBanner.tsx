"use client";

import { UserCheck, Clock } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";

/**
 * Banner "aguardando aprovação do personal": aluno novo só entra na lista do
 * personal depois que um dos trainers/gestores aprovar em /personal/alunos.
 * Aparece no início e no treino enquanto approved_at for nulo.
 */
export function PendingApprovalBanner() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return null;
  if (profile.role !== "student") return null;
  if (profile.approved_at) return null;

  return (
    <div className="mx-auto max-w-md px-4 pt-3">
      <div className="flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/[0.08] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
          <UserCheck className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-black text-brand">
            Aguardando aprovação do seu personal
            <Clock className="h-3.5 w-3.5" />
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Seu cadastro chegou na academia. Assim que um personal aprovar, seu
            treino é montado e aparece aqui. Enquanto isso, explore o app à vontade.
          </p>
        </div>
      </div>
    </div>
  );
}
