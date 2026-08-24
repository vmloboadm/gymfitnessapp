"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, User, Dumbbell, BarChart3, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";

const ROLE_OPTIONS = [
  { role: "student", label: "Aluno", icon: User, home: "/treino" },
  { role: "trainer", label: "Personal", icon: Dumbbell, home: "/alunos" },
  { role: "manager", label: "Gestor", icon: BarChart3, home: "/dashboard" },
];

/**
 * Seletor de papel (somente modo demo), navega entre os 3 painéis
 * sem precisar fazer login real.
 */
export function DemoRoleSwitcher({ className }: { className?: string }) {
  const { profile, switchDemoRole } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = ROLE_OPTIONS.find((r) => r.role === profile?.role) ?? ROLE_OPTIONS[0];
  const Icon = current.icon;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand/40"
        aria-label="Trocar papel demo"
      >
        <Icon className="h-3.5 w-3.5 text-brand" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Painel demo
          </p>
          {ROLE_OPTIONS.map(({ role, label, icon: OptIcon, home }) => (
            <button
              key={role}
              onClick={() => {
                switchDemoRole(role);
                setOpen(false);
                if (home) router.push(home);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                profile?.role === role ? "font-bold text-foreground" : "text-muted-foreground"
              )}
            >
              <OptIcon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {profile?.role === role && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}