"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m, type Variants } from "framer-motion";
import { Inbox, Crown, Dumbbell, Check, X, Inbox as InboxIcon, FileText, ArrowLeftRight } from "lucide-react";
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
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

const row: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Iniciais de duas letras + cor estável derivada do id (sem fabricar avatar). */
const AVATAR_TONES = [
  "bg-[#FFC24D]/20 text-[#FFC24D]",
  "bg-[#4ADE80]/20 text-[#4ADE80]",
  "bg-sky-400/20 text-sky-400",
  "bg-[#F87171]/20 text-[#F87171]",
  "bg-brand/20 text-brand",
] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const TYPE_META: Record<ApprovalRequest["type"], { label: string; short: string; icon: typeof Crown; cls: string }> = {
  premium: { label: "Desbloqueio de Plano Premium", short: "Premium", icon: Crown, cls: "text-[#FFC24D]" },
  carga: { label: "Ajuste de treino", short: "Carga", icon: Dumbbell, cls: "text-brand" },
  relatorio: { label: "Relatório de evolução", short: "Relatório", icon: FileText, cls: "text-sky-400" },
  ajuste: { label: "Troca de exercício", short: "Troca", icon: ArrowLeftRight, cls: "text-[#4ADE80]" },
};

/**
 * Caixa de entrada de aprovações: pedidos dos alunos (premium, ajuste de
 * carga) com decisão do personal. Estado persistido via trainer-store.
 */
export default function PersonalAprovacoesPage() {
  const { profile, user } = useAuth();
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

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
    const hydrate = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // Sonda direta: getRequests engole erro interno, então testamos a
        // conexão com a tabela antes de confiar que [] é fila vazia.
        const probe = await supabaseBrowser()
          .from("premium_requests")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", profile.gym_id);
        if (probe.error) throw new Error(probe.error.message);
        const rows = await getRequests(profile.gym_id);
        if (alive) { setItems(rows); setLoading(false); }
      } catch {
        if (alive) {
          setLoadError("Não foi possível carregar as aprovações. Verifique a conexão.");
          setLoading(false);
        }
      }
    };
    hydrate();
    window.addEventListener(TRAINER_APPROVALS_EVENT, hydrate);
    window.addEventListener("storage", hydrate);
    const t = setInterval(() => { if (document.visibilityState === 'visible') hydrate(); }, 15000); // produção: fila atualiza sozinha
    return () => {
      alive = false;
      window.removeEventListener(TRAINER_APPROVALS_EVENT, hydrate);
      window.removeEventListener("storage", hydrate);
      clearInterval(t);
    };
  }, [profile?.gym_id, tick]);

  // Realtime: refetch when student submits or trainer decides
  usePremiumRequestsRealtime(profile?.gym_id, () => setTick((t) => t + 1));

  useMedicalClearancesRealtime(profile?.gym_id, () => setTick((t) => t + 1));

  const pending = items.filter((a) => a.status === "pendente");
  const resolved = items.filter((a) => a.status !== "pendente");

  const decide = async (id: string, status: "aprovado" | "recusado") => {
    if (decidingId) return;
    setDecidingId(id);
    try {
      await decideRequest(id, status, user?.id ?? "");
      if (profile?.gym_id) setItems(await getRequests(profile.gym_id));
      toast.success(
        status === "aprovado" ? "Solicitação aprovada" : "Solicitação recusada",
        { description: "O aluno vê a resposta na área dele." }
      );
    } catch (e) {
      toast.error("Não deu registrar a decisão. Tente de novo.", {
        description: String(e instanceof Error ? e.message : e).slice(0, 80),
      });
    } finally {
      setDecidingId(null);
    }
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
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.06] p-6 text-center">
          <p className="text-[13px] font-bold text-foreground">Não foi possível carregar as aprovações</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{loadError}</p>
          <button
            onClick={() => setTick((t) => t + 1)}
            className="tactile mt-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[12px] font-bold text-foreground transition-colors hover:text-brand"
          >
            Tentar novamente
          </button>
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
          <InboxIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Caixa vazia</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pedidos de ajuste de treino e desbloqueio premium chegam aqui.
          </p>
        </div>
      ) : (
        <m.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: Math.min(0.07, 0.4 / Math.max(1, pending.length)), delayChildren: 0.04 } } }}
          initial="hidden"
          animate="show"
          className="space-y-2.5"
        >
          {pending.map((a) => (
            <m.article key={a.id} variants={row} className="gf-card gf-glass !p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border border-white/[0.08]">
                  <AvatarImage src={avatarFor(a) ?? undefined} alt="" />
                  <AvatarFallback className={cn("text-[11px] font-black", toneFor(a.studentId || a.studentName))}>
                    {initialsOf(a.studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                    {(() => {
                      const meta = TYPE_META[a.type] ?? TYPE_META.carga;
                      const Icon = meta.icon;
                      return <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />;
                    })()}
                    {(TYPE_META[a.type] ?? TYPE_META.carga).label}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {a.studentName} · {fmt(a.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(a.type === "ajuste" || a.type === "relatorio") && a.studentId ? (
                  <Link
                    href={a.type === "ajuste" ? `/personal/treinos?aluno=${a.studentId}` : `/personal/alunos?aluno=${a.studentId}`}
                    className="tactile col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand/15 text-[12px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.97]"
                  >
                    {a.type === "ajuste" ? "Abrir plano do aluno para ajustar" : "Abrir ficha do aluno"}
                  </Link>
                ) : null}
                <button
                  onClick={() => decide(a.id, "aprovado")}
                  disabled={decidingId !== null}
                  className="tactile flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#4ADE80]/15 text-[12px] font-bold text-[#4ADE80] ring-1 ring-[#4ADE80]/30 transition-transform active:scale-[0.97] disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> {decidingId === a.id ? "Salvando..." : "Aprovar"}
                </button>
                <button
                  onClick={() => decide(a.id, "recusado")}
                  disabled={decidingId !== null}
                  className="tactile flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#F87171]/15 text-[12px] font-bold text-[#F87171] ring-1 ring-[#F87171]/30 transition-transform active:scale-[0.97] disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> {decidingId === a.id ? "Salvando..." : "Recusar"}
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
                  {a.studentName} · {(TYPE_META[a.type] ?? TYPE_META.carga).short}
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
