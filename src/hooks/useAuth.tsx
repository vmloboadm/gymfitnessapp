"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "~/lib/supabase/client";
import type { Profiles } from "~/lib/types/models";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profiles | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  switchDemoRole: (role: string) => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  switchDemoRole: () => {},
});

const DEMO_ROLE_KEY = "gymfit_demo_role";

function demoProfileFor(role: string): Profiles {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    gym_id: "00000000-0000-0000-0000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: (role === "manager" || role === "admin" ? "manager" : role === "trainer" ? "trainer" : "student") as any,
    status: "active",
    name: role === "trainer" ? "Personal Demo" : role === "manager" || role === "admin" ? "Gestor Demo" : "Atleta Demo",
    email: "demo@stackgym.fit",
    phone: null,
    avatar_url: null,
    birth_date: null,
    goal: "ganho de massa",
    medical_risk: false,
    onboarding_completed: true,
    onboarding_step: 5,
    lgpd_consent_at: new Date().toISOString(),
    daily_intake: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setDemoRole] = useState<string>("student");

  const refreshProfile = useCallback(async (uid?: string) => {
    const supabase = supabaseBrowser();
    const id = uid ?? supabase.auth.getUser().then((r) => r.data.user?.id).catch(() => undefined);
    const resolvedId = await id;
    if (!resolvedId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", resolvedId)
      .maybeSingle();
    if (!error) setProfile(data as Profiles | null);
  }, []);

  useEffect(() => {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

    // Modo demo: injeta um perfil de teste para navegar pelas telas.
    if (isDemo) {
      const saved = typeof window !== "undefined" ? localStorage.getItem(DEMO_ROLE_KEY) : null;
      const role = saved ?? "student";
      setDemoRole(role);

      const demoUser = {
        id: "00000000-0000-0000-0000-000000000099",
        email: "demo@stackgym.fit",
        user_metadata: { name: "Atleta Demo" },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as unknown as User;
      setUser(demoUser);
      setProfile(demoProfileFor(role));
      setLoading(false);
      return;
    }

    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await refreshProfile(s.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        await refreshProfile(s?.user?.id);
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const switchDemoRole = useCallback((role: string) => {
    setDemoRole(role);
    if (typeof window !== "undefined") localStorage.setItem(DEMO_ROLE_KEY, role);
    setProfile(demoProfileFor(role));
  }, []);

  const value = useMemo(
    () => ({ user, session, profile, loading, refreshProfile, switchDemoRole }),
    [user, session, profile, loading, refreshProfile, switchDemoRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}