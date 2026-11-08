"use client";

import { UserCheck, Clock, MessageCircle } from "lucide-react";
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
    <div className="mx-auto max-w-md px-4 pt-3">
      <div className="flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/[0.08] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
          <UserCheck className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-black text-brand">
            Falta a recepção confirmar seu cadastro
            <Clock className="h-3.5 w-3.5" />
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Assim que confirmar, você escolhe seu treino aqui no app e começa no
            mesmo dia. Se já resolveu na recepção, chama a gente que liberamos.
          </p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-black text-black"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
