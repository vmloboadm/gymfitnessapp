"use client";

import { useAuth } from "~/hooks/useAuth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "~/components/layout/Sidebar";
import { cn } from "~/lib/utils";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  Wallet,
  Newspaper,
  Trophy,
} from "lucide-react";

const TRAINER_NAV = [
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/biblioteca", label: "Exercícios", icon: Dumbbell },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/ranking", label: "Ranking", icon: Trophy },
];

const MANAGER_NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/personais", label: "Personais", icon: Users },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
];

/**
 * Layout das rotas compartilhadas entre personal e gestor (blueprint §3.3).
 * A sidebar muda por role; o conteúdo é o mesmo por rota.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const items = isManager ? MANAGER_NAV : TRAINER_NAV;

  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* sidebar apenas em telas grandes */}
      <div className="hidden lg:block">
        <Sidebar items={items} />
      </div>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-md px-4 pb-28 pt-4 md:px-6 lg:max-w-6xl lg:py-6">{children}</div>
      </main>

      {/* bottom nav mobile-first (igual ao app do aluno/gestor) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#081020]/95 backdrop-blur supports-[backdrop-filter]:bg-[#081020]/85 lg:hidden">
        <div className="flex">
          {items.slice(0, 6).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[9px] font-medium transition-colors active:scale-[0.94]",
                  active ? "text-brand" : "text-muted-foreground"
                )}
              >
                <span className={cn("relative flex h-7 w-9 items-center justify-center rounded-xl", active && "bg-brand/12")}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}