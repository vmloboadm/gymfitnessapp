"use client";

import { UserCheck, MessageCircle } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";

/**
 * Banner "cadastro aguardando confirmação da recepção": aparece enquanto
 * approved_at for nulo. O texto antigo prometia treino montado pelo personal
 * e fazia o aluno achar que precisava "pedir liberação do app". Agora diz o
 * que falta e dá o caminho direto no WhatsApp.
 */
const WHATSAPP = "https://wa.me/5522997787186?text=" +
  encodeURIComponent("Oi! Sou aluno(a) novo(a) no app e quero liberar meu cadastro pra escolher meu treino.");

export function PendingApprovalBanner() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return null;
  if (profile.role !== "student") return null;
  if (profile.approved_at) return null;

  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noreferrer"
      className="mx-auto flex max-w-md items-center gap-2.5 rounded-xl border border-brand/25 bg-brand/[0.05] px-3 py-2.5"
    >
      <UserCheck className="h-4 w-4 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
        Cadastro em confirmação na recepção
      </span>
      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Falar no WhatsApp" />
    </a>
  );
}
