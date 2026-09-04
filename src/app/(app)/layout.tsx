"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "~/components/layout/BottomNav";
import { LiveWorkoutBar } from "~/components/layout/LiveWorkoutBar";
import { useOfflineQueue } from "~/hooks/useOfflineQueue";
import { useAuth } from "~/hooks/useAuth";
import { CloudOff } from "lucide-react";

/**
 * Área do aluno, mobile-first PWA (BottomNav + TopBar por página).
 * Parceiros saíram do layout universal: agora vivem no "Ver mais" da home,
 * reduzindo densidade e JS montado em todas as telas.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOnline, pendingCount } = useOfflineQueue();

  // Guard client-side: em cache hits do CDN o middleware não roda
  // (comportamento do Vercel) — sem sessão, volta pro login.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  return (
    <div
      className="min-h-[100dvh] pb-24 md:mx-auto md:max-w-md"
      style={{ overscrollBehaviorY: "contain" }}
    >
      {!isOnline ? (
        <div className="sticky top-[56px] z-30 flex items-center justify-center gap-2 bg-warning py-1.5 text-[11px] font-bold text-black">
          <CloudOff className="h-3.5 w-3.5" />
          Sem internet{pendingCount > 0 ? ` · ${pendingCount} ação(ões) sincroniza(m) quando voltar` : " · dados salvos no aparelho"}
        </div>
      ) : null}
      <main>{children}</main>
      <LiveWorkoutBar />
      <BottomNav />
    </div>
  );
}