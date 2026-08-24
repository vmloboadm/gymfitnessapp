"use client";

import { BottomNav } from "~/components/layout/BottomNav";
import { useOfflineQueue } from "~/hooks/useOfflineQueue";
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
  const { isOnline, pendingCount } = useOfflineQueue();
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
      {children}
      <BottomNav />
    </div>
  );
}