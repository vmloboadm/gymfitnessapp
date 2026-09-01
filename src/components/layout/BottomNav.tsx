"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  TrendingUp,
  Home,
  User,
  ScanLine,
  Trophy,
  Newspaper,
  Users,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";

/* Navegação completa (7 destinos) em barra com scroll horizontal -
   padrão consagrado de tabs com overflow (mesmo comportamento de apps
   com muitas seções). Equipamentos fica dentro de Check-in/Treino. */
const STUDENT_NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/treino", label: "Treino", icon: Dumbbell },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/checkin", label: "Check-in", icon: ScanLine },
  { href: "/progresso", label: "Progresso", icon: TrendingUp },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/perfil", label: "Perfil", icon: User },
];

/** Nav do personal (feed e ranking compartilhados com o aluno) */
const TRAINER_NAV = [
  { href: "/personal/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/personal/alunos", label: "Alunos", icon: Users },
  { href: "/personal/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/ranking", label: "Ranking", icon: Trophy },
];

/** Nav do gestor */
const MANAGER_NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/personal/alunos", label: "Alunos", icon: Users },
  { href: "/personal/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/personais", label: "Personais", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const role = profile?.role;
  const NAV_ITEMS =
    role === "trainer" ? TRAINER_NAV : role === "manager" || role === "admin" ? MANAGER_NAV : STUDENT_NAV;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav id="bottom-nav" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#081020]/95 backdrop-blur supports-[backdrop-filter]:bg-[#081020]/85">
      <div className="relative mx-auto max-w-md">
        {/* fades indicando que dá para rolar (affordance) */}
        <span className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-[#081020] to-transparent" aria-hidden />
        <span className="pointer-events-none absolute left-0 top-0 z-10 h-full w-4 bg-gradient-to-r from-[#081020] to-transparent" aria-hidden />
        <div className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 shrink-0 snap-start flex-col items-center justify-center gap-1 px-2 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[10px] transition-colors active:scale-[0.94]",
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative flex h-7 w-11 items-center justify-center rounded-xl transition-colors">
                  {active && (
                    <span className="absolute inset-0 rounded-xl bg-brand/12" />
                  )}
                  <Icon className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className="whitespace-nowrap font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
