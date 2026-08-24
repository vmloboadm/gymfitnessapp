"use client";

import { Sidebar } from "~/components/layout/Sidebar";
import {
  Users,
  ClipboardList,
  Dumbbell,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: Users },
  { href: "/alunos", label: "Alunos", icon: Users },
  { href: "/biblioteca", label: "Biblioteca de exercícios", icon: Dumbbell },
  { href: "/treinos", label: "Treinos", icon: ClipboardList },
  { href: "/equipamentos", label: "Equipamentos", icon: Dumbbell },
];

/**
 * Área do personal, sidebar desktop (blueprint §3.3).
 */
export default function TrainerLayout({
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