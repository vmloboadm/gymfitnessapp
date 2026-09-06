"use client";

import { useEffect, useState } from "react";
import { m, type Variants } from "framer-motion";
import { Inbox, Crown, Dumbbell, Check, X, Inbox as InboxIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { PersonalStudent } from "~/lib/personal-data";
import { useAuth } from "~/hooks/useAuth";
import { usePremiumRequestsRealtime, useMedicalClearancesRealtime } from "~/hooks/useRealtimeSubscriptions";
import {
  TRAINER_APPROVALS_EVENT,
  type ApprovalRequest,
} from "~/lib/trainer-store";
import { decideRequest, getRequests, getGymStudents } from "~/lib/gym-api";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Caixa de entrada de aprovações: pedidos dos alunos (premium, ajuste de
 * carga) com decisão do personal. Estado persistido via trainer-store.
 */
export default function PersonalAprovacoesPage() {
  const { profile, user } = useAuth();
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const [items, setItems] = useState<ApprovalRequest[]>([]);

  // Alunos reais p/ resolver avatares dos pedidos
  useEffect(() => {
    if (!profile?.gym_id) return;
    let alive = true;
    getGymStudents(profile.gym_id)
      .then((rows) => { if (alive) setStudents(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, [profile?.gym_id]);

  useEffect(() => {
    if (!profile?.gym_id) return;
    let alive = true;
    const hydrate = () =>
      getRequests(profile.gym_id)
        .then((rows) => { if (alive) setItems(rows); })
        .catch(() => {});
    hydrate();
    window.addEventListener(TRAINER_APPROVALS_EVENT, hydrate);
    window.addEventListener("storage", hydrate);
    const t = setInterval(hydrate, 15000); // produção: fila atualiza sozinha
    return () => {
      alive = false;
      window.removeEventListener(TRAINER_APPROVALS_EVENT, hydrate);
      window.removeEventListener("storage", hydrate);
      clearInterval(t);
    };
  }, [profile?.gym_id]);

  // Realtime: refetch when student submits or trainer decides
  usePremiumRequestsRealtime(profile?.gym_id, () => {
    if (!profile?.gym_id) return;
    getRequests(profile.gym_id).then(setItems).catch(() => {});
  });

  useMedicalClearancesRealtime(profile?.gym_id, () => {
    if (!profile?.gym_id) return;
    getRequests(profile.gym_id).then(setItems).catch(() => {});
  });

  const pending = items.filter((a) => a.status === "pendente");
  const _isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  const resolved = items.filter((a) => a.status !== "pendente");

  const decide = async (id: string, status: "aprovado" | "recusado") => {
    await decideRequest(id, status, user?.id ?? "");
    setItems(await getRequests(profile?.gym_id ?? "").catch(() => items));
    toast.success(
      status === "aprovado" ? "Solicitação aprovada" : "Solicitação recusada",
      { description: "O aluno vê a resposta na área dele." }
    );
  };

  const avatarFor = (a: ApprovalRequest) =>
    students.find((s) => s.name === a.studentName)?.avatar ?? null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Inbox className="h-5 w-5 text-brand" />
          Aprovações
          {pending.length > 0 ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-brand-foreground">
              {pending.length}
            </span>
          ) : null}
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Requisições dos alunos que dependem do seu ok
        </p>
      </header>

      {/* pendentes */}
      {pending.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
          <InboxIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Caixa vazia</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pedidos de ajuste de treino e desbloqueio premium chegam aqui.
          </p>
        </div>
      ) : (
        <m.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
          {pending.map((a) => (
            <m.article key={a.id} variants={row} className="gf-card gf-glass !p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border border-white/[0.08]">
                  <AvatarImage src={avatarFor(a) ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                    {a.studentName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                    {a.type === "premium" ? (
                      <Crown className="h-3.5 w-3.5 text-[#FFC24D]" />
                    ) : (
                      <Dumbbell className="h-3.5 w-3.5 text-brand" />
                    )}
                    {a.type === "premium" ? "Desbloqueio de Plano Premium" : "Ajuste de treino"}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {a.studentName} · {fmt(a.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide(a.id, "aprovado")}
                  className="tactile flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#4ADE80]/15 text-[12px] font-bold text-[#4ADE80] ring-1 ring-[#4ADE80]/30 transition-transform active:scale-[0.97]"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button
                  onClick={() => decide(a.id, "recusado")}
                  className="tactile flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#F87171]/15 text-[12px] font-bold text-[#F87171] ring-1 ring-[#F87171]/30 transition-transform active:scale-[0.97]"
                >
                  <X className="h-4 w-4" /> Recusar
                </button>
              </div>
            </m.article>
          ))}
        </m.div>
      )}

      {/* resolvidas */}
      {resolved.length > 0 ? (
        <section aria-labelledby="resolved-title">
          <h2 id="resolved-title" className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Histórico
          </h2>
          <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {resolved.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    a.status === "aprovado" ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "bg-[#F87171]/15 text-[#F87171]"
                  )}
                >
                  {a.status === "aprovado" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                  {a.studentName} · {a.type === "premium" ? "Premium" : "Carga"}
                </p>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-bold uppercase tracking-wide",
                    a.status === "aprovado" ? "text-[#4ADE80]" : "text-[#F87171]"
                  )}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
