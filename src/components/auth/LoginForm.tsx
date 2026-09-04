"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { BUILD_LABEL } from "~/lib/build";
import { cn } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { readOnboarding } from "~/lib/profile-store";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [testRole, setTestRole] = useState<"student" | "trainer" | "manager">("student");
  const [keepSigned, setKeepSigned] = useState(true);
  const { switchDemoRole } = useAuth();
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

  const ROLE_HOME: Record<string, string> = { student: "/treino", trainer: "/personal/dashboard", manager: "/dashboard" };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Modo teste/demo: senha interna única; e-mail livre (sugestão: admin@gymfitness.com).
    if (isDemo) {
      if (password !== "gf123") {
        toast.error("Senha de teste incorreta", { description: "Use gf123 para entrar em modo teste." });
        setLoading(false);
        return;
      }
      switchDemoRole(testRole);
      // cookies de sessão: gf_test libera o app, gf_role alimenta o isolamento de rotas
      document.cookie = "gf_test=1; path=/; SameSite=Lax";
      document.cookie = `gf_role=${testRole}; path=/; SameSite=Lax`;
      // aluno no primeiro acesso: onboarding antes do dashboard
      if (testRole === "student" && !readOnboarding().onboarding_completed) {
        router.push("/onboarding");
        return;
      }
      // aluno vai pro DASHBOARD normal (/); personal e gestor têm homes próprias
      router.push(testRole === "student" ? "/" : ROLE_HOME[testRole]);
      router.refresh();
      return;
    }

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error("Não foi possível entrar", { description: error.message });
        setLoading(false);
        return;
      }

      // "Manter conectado": desmarcado → o cookie de sessão morre ao fechar o navegador
      if (!keepSigned) {
        setTimeout(() => {
          document.cookie.split(";").forEach((c) => {
            const name = c.split("=")[0].trim();
            if (name.startsWith("sb-") && name.includes("auth-token")) {
              const raw = c.slice(name.length + 1);
              document.cookie = `${name}=${raw}; path=/`;
            }
          });
        }, 600); // depois que o client ssr gravar os cookies da sessão
      }

      // Middleware redireciona para a home da role
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Falha ao conectar", { description: "Verifique sua internet e tente novamente." });
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      setLoading(false);

      if (error) {
        toast.error("Erro ao enviar o link", { description: error.message });
        return;
      }
      setMagicSent(true);
      toast.success("Link mágico enviado!", {
        description: "Verifique sua caixa de entrada.",
      });
    } catch {
      setLoading(false);
      toast.error("Falha ao conectar", { description: "Verifique sua internet e tente novamente." });
    }
  };

  if (magicSent) {
    return (
      <div className="w-full rounded-[24px] border border-white/[0.08] bg-white/[0.06] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <h2 className="font-display text-xl font-black text-white">Confira seu e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Enviamos um link mágico para <strong className="text-white">{email}</strong>. Clique nele para entrar.
        </p>
        <Button
          variant="outline"
          className="mt-6 h-11 w-full rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          onClick={() => setMagicSent(false)}
        >
          Tentar com senha
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.06] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-7">
      {/* linha de acento superior + brilho interno */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
      <span className="pointer-events-none absolute -top-16 left-1/2 h-32 w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,113,30,0.18),transparent_70%)] blur-2xl" aria-hidden />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F4711E] shadow-[0_0_8px_rgba(244,113,30,0.7)]" />
          Acesso exclusivo · GymFitness
        </span>
        <img
          src="/images/logo-academia.png"
          alt="GymFitness"
          width={280}
          height={84}
          className="h-20 w-auto object-contain drop-shadow-[0_0_28px_rgba(244,113,30,0.45)] sm:h-24"
        />
        <div>
          <h1 className="font-display text-[26px] font-black leading-tight tracking-tight text-white">
            {isDemo ? (
              <>
                Bem-vindo de volta
                <span className="mx-auto mt-2 flex items-center justify-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-warning">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" /> modo teste
                </span>
              </>
            ) : (
              "Sua evolução começa aqui"
            )}
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            Entre para continuar sua evolução
          </p>
        </div>
      </div>

      <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@gymfitness.com"
            className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus-visible:border-brand/50 focus-visible:ring-brand/30"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-white/80">
              Senha
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#FF9A5C] hover:text-white hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus-visible:border-brand/50 focus-visible:ring-brand/30"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={keepSigned}
            onChange={(e) => setKeepSigned(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#F4711E]"
          />
          Manter conectado neste dispositivo
        </label>

        <Button
          type="submit"
          className="h-[48px] w-full rounded-xl bg-[#F4711E] text-[15px] font-black tracking-tight text-black shadow-[0_8px_20px_rgba(244,113,30,0.35)] hover:bg-[#FF7A2F] focus-visible:ring-white"
          disabled={loading}
          size="lg"
        >
          {loading ? <Loader2 className="animate-spin" /> : <LogIn className="h-5 w-5" />}
          Entrar
        </Button>
      </form>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#0B1A33]/80 px-3 text-white/40 backdrop-blur">ou</span>
        </div>
      </div>

      <Button
        variant="outline"
        className="h-11 w-full rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
        onClick={handleMagicLink}
        disabled={loading}
      >
        Entrar com link mágico
      </Button>

      <p className="text-center text-sm text-white/60">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-semibold text-[#FF9A5C] hover:text-white hover:underline">
          Cadastre-se
        </Link>
      </p>

      {isDemo ? (
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-white/35">
          <span>Acesso teste:</span>
          {([["student", "Aluno"], ["trainer", "Personal"], ["manager", "Gestor"]] as const).map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => setTestRole(r)}
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold transition-colors",
                testRole === r ? "bg-brand/20 text-brand" : "text-white/40 hover:text-white/70"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="pt-2 text-center text-[10px] font-semibold tracking-wide text-white/30">{BUILD_LABEL}</p>
    </div>
  );
}