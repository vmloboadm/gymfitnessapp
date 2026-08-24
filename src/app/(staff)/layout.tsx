"use client";

import { useAuth } from "~/hooks/useAuth";
import { Sidebar } from "~/components/layout/Sidebar";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  Wallet,
  BarChart3,
  ScanLine,
  ShieldAlert,
} from "lucide-react";

const TRAINER_NAV = [
  { href: "/", label: "Dashboard", icon: Users },
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/biblioteca", label: "Biblioteca de exercícios", icon: Dumbbell },
  { href: "/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/equipamentos", label: "Equipamentos", icon: Dumbbell },
];

const MANAGER_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/personais", label: "Personais", icon: Users },
  { href: "/equipamentos", label: "Equipamentos", icon: Dumbbell },
  { href: "/matriculas", label: "Matrículas", icon: ClipboardList },
  { href: "/checkin", label: "Check-in", icon: ScanLine },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/day-pass", label: "Day-pass", icon: ShieldAlert },
];

/**
 * Layout das rotas compartilhadas entre personal e gestor (blueprint §3.3).
 * A sidebar muda por role; o conteúdo é o mesmo por rota.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const items = isManager ? MANAGER_NAV : TRAINER_NAV;

  return (
    <div className="min-h-[100dvh] bg-background">
      <Sidebar items={items} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}