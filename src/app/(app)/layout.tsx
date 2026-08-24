"use client";

import { BottomNav } from "~/components/layout/BottomNav";

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
  return (
    <div
      className="min-h-[100dvh] pb-24 md:mx-auto md:max-w-md"
      style={{ overscrollBehaviorY: "contain" }}
    >
      {children}
      <BottomNav />
    </div>
  );
}