"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { pendingApprovalCount, TRAINER_APPROVALS_EVENT } from "~/lib/trainer-store";
import { cn } from "~/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Inbox,
  UserRound,
} from "lucide-react";

/** Nav do personal: 5 itens fixos, Aprovações com badge de pendentes. */
const TRAINER_NAV = [
  { href: "/personal/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/personal/alunos", label: "Alunos", icon: Users },
  { href: "/personal/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/personal/aprovacoes", label: "Aprovações", icon: Inbox, badge: true },
  { href: "/personal/perfil", label: "Perfil", icon: UserRound },
] as const;

/** Nav do gestor (mesma estética, rotas de gestão). */
const MANAGER_NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/personal/alunos", label: "Alunos", icon: Users },
  { href: "/personal/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/personal/aprovacoes", label: "Aprovações", icon: Inbox, badge: true },
  { href: "/personais", label: "Personais", icon: Users },
] as const;

/**
 * Layout da área de staff (personal + gestor): 100% MOBILE-FIRST.
 * Sem sidebar em nenhuma resolução; navegação exclusiva por bottom nav,
 * herdando o design system do app do aluno.
 */
export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const items = isManager ? MANAGER_NAV : TRAINER_NAV;
  const pathname = usePathname();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    const hydrate = () => setPendingApprovals(pendingApprovalCount());
    hydrate();
    window.addEventListener(TRAINER_APPROVALS_EVENT, hydrate);
    window.addEventListener("storage", hydrate);
    return () => {
      window.removeEventListener(TRAINER_APPROVALS_EVENT, hydrate);
      window.removeEventListener("storage", hydrate);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</div>

      <nav
        aria-label="Navegação do staff"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#081020]/95 backdrop-blur supports-[backdrop-filter]:bg-[#081020]/85"
      >
        <div className="mx-auto flex max-w-md">
          {items.map(({ href, label, icon: Icon, ...rest }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const showBadge = "badge" in rest && rest.badge && pendingApprovals > 0;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-px py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[9px] font-medium transition-colors active:scale-[0.94]",
                  active ? "text-brand" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "relative flex h-6 w-8 items-center justify-center rounded-lg",
                    active && "bg-brand/12"
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.3 : 1.8} />
                  {showBadge ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[8px] font-black text-brand-foreground">
                      {pendingApprovals}
                    </span>
                  ) : null}
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
