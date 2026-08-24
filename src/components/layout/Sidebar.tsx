"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { GymLogo } from "~/components/layout/GymLogo";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { supabaseBrowser } from "~/lib/supabase/client";
import { ROLE_LABELS } from "~/lib/utils/roles";

type SidebarProps = {
  items: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }>;
  activePrefixes?: string[];
};

/**
 * Sidebar desktop (padrão personal/admin, blueprint §3.3).
 * Navbar responsiva navy + marca orange.
 */
export function Sidebar({ items, activePrefixes = [] }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  const handleLogout = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  };

  const isActive = (href: string) =>
    pathname === href || activePrefixes.some((p) => pathname.startsWith(p)) ||
    (href !== "/" && pathname.startsWith(href));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-[#081020] lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <GymLogo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/15 text-brand"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {(profile?.name?.[0] ?? "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile?.name}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {ROLE_LABELS[profile?.role ?? "student"]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-1">
          <button
            onClick={handleLogout}
            className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}

