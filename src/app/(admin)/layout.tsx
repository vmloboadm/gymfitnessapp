"use client";

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
 * Área do gestor — sidebar desktop (blueprint §3.3).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Sidebar items={NAV} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
