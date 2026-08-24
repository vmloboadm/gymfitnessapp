"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "~/hooks/useAuth";
import type { Role } from "~/lib/utils/roles";
import { ROLE_HOME, hasRole } from "~/lib/utils/roles";
import { AuthSkeleton } from "~/components/common/AuthSkeleton";

/**
 * Protege uma rota:
 * - sem sessão → redireciona para /login
 * - backToLogin se role exigida não satisfeita → redireciona para a home da role
 */
export function AuthGuard({
  children,
  requiredRole,
  redirectTo,
}: {
  children: React.ReactNode;
  requiredRole?: Role;
  redirectTo?: string;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(redirectTo ?? "/login");
      return;
    }
    if (requiredRole && profile && !hasRole(profile.role, requiredRole)) {
      router.replace(ROLE_HOME[profile.role] ?? "/login");
    }
  }, [loading, user, profile, requiredRole, redirectTo, router]);

  if (loading) return <AuthSkeleton />;
  if (!user) return null;
  if (requiredRole && profile && !hasRole(profile.role, requiredRole)) return null;

  return <>{children}</>;
}