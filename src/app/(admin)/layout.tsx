"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "~/components/layout/Sidebar";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  Wallet,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { cn } from "~/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/personais", label: "Personais", icon: Users },
  { href: "/equipamentos", label: "Equipamentos", icon: Dumbbell },
  { href: "/matriculas", label: "Matrículas", icon: ClipboardList },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/day-pass", label: "Day-pass", icon: ShieldAlert },
];

/**
 * Área do gestor — MOBILE-FIRST: bottom nav no celular (igual ao app do
 * aluno), sidebar só aparece a partir de lg. Nada de sidebar fixa no mobile.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* sidebar apenas em telas grandes */}
      <div className="hidden lg:block">
        <Sidebar items={NAV} />
      </div>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 lg:py-6">{children}</div>
      </main>

      {/* bottom nav mobile-first */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#081020]/95 backdrop-blur supports-[backdrop-filter]:bg-[#081020]/85 lg:hidden">
        <div className="scrollbar-hide flex overflow-x-auto">
          {NAV.slice(0, 6).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1 px-2 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[10px] transition-colors active:scale-[0.94]",
                  active ? "text-brand" : "text-muted-foreground"
                )}
              >
                <span className={cn("relative flex h-7 w-11 items-center justify-center rounded-xl", active && "bg-brand/12")}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className="whitespace-nowrap font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
