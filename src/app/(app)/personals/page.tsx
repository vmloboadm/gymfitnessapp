"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { MessageCircle, UserRoundCheck } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { demoPersonais, isDemoMode } from "~/lib/demo-bridge";

/**
 * Personais da casa: lista real de trainers/managers do gym
 * (list_my_gym_trainers) marcando o personal vinculado (student_trainers).
 * Contato é pelo chat do app, sem telefone ou nota inventados.
 */

type Trainer = {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  linked?: boolean;
};

export default function PersonaisMarketplacePage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<Trainer[]>(
    async () => {
      if (demo) {
        const list = demoPersonais().map((p) => ({
          id: p.id,
          name: p.trainer.name,
          avatar_url: null,
          role: "trainer",
          linked: false,
        }));
        return { data: list, error: null };
      }
      if (!user) return { data: null, error: { message: "Sessão indisponível" } };
      const supabase = supabaseBrowser();

      const [linkRes, rpc] = await Promise.all([
        supabase.from("student_trainers").select("trainer_id").eq("student_id", user.id),
        supabase.rpc("list_my_gym_trainers"),
      ]);
      if (linkRes.error) return { data: null, error: linkRes.error };
      if (rpc.error) return { data: null, error: rpc.error };

      const linkedIds = new Set(((linkRes.data ?? []) as Array<{ trainer_id: string }>).map((r) => r.trainer_id));
      const trainers = ((rpc.data ?? []) as Array<{ id: string; name: string; avatar_url: string | null; role: string }>)
        .map((t) => ({ ...t, linked: linkedIds.has(t.id) }))
        .sort((a, b) => Number(b.linked) - Number(a.linked));
      return { data: trainers, error: null };
    },
    [user?.id, profile?.gym_id, demo]
  );

  const personais = data ?? [];

  return (
    <>
      <TopBar title="Personais da Casa" subtitle="Acompanhamento premium dentro do gym" />
      <div className="space-y-5 p-4">
        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] border border-brand/35 bg-gradient-to-br from-brand/15 via-card to-card p-5">
          <p className="text-sm font-bold text-foreground">Resultado mais rápido com quem faz isso por ofício</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Conheça os personais da casa e fale direto pelo chat do app.
            Sem burocracia, sem mensalidade escondida.
          </p>
        </m.div>

        {loading ? (
          <SkeletonList rows={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : personais.length === 0 ? (
          <EmptyState
            title="Nenhum personal cadastrado ainda"
            description="Quando a academia cadastrar os personais, eles aparecem aqui. Por enquanto, acompanhe seus treinos na aba Treino."
            icon={UserRoundCheck}
          />
        ) : (
          personais.map((p, i) => (
            <m.article
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.08, 0.4) }}
              whileTap={{ scale: 0.985 }}
              className="overflow-hidden rounded-[20px] border border-border bg-card/50"
            >
              <div className="flex items-center gap-4 p-4">
                <Avatar className="h-16 w-16 border-2 border-brand/40">
                  {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name} /> : null}
                  <AvatarFallback className="bg-secondary text-lg font-bold text-secondary-foreground">
                    {p.name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {p.role === "trainer" ? "Personal" : p.role === "manager" ? "Gestão da academia" : "Equipe"}
                  </p>
                  {p.linked ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand">
                      <UserRoundCheck className="h-3 w-3" /> Seu personal
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="p-4 pt-3">
                <Link
                  href="/conversas"
                  className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4711E] py-3.5 text-sm font-black text-black shadow-[0_0_20px_rgba(244,113,30,0.4)] transition-transform active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no chat
                </Link>
              </div>
            </m.article>
          ))
        )}

        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          O contato é direto pelo chat do app, sem intermediários.
        </p>
      </div>
    </>
  );
}
