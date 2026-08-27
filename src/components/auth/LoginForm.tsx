"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      setLoading(false);
      return;
    }

    // Middleware redireciona para a home da role
    router.push("/");
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
    <div className="w-full rounded-[24px] border border-white/[0.08] bg-white/[0.06] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src="/images/logo-academia.png"
          alt="GymFitness"
          width={160}
          height={48}
          className="h-10 w-auto object-contain drop-shadow-[0_0_16px_rgba(244,113,30,0.35)]"
        />
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white">
            Bem-vindo de volta
          </h1>
          <p className="mt-1 text-sm text-white/60">
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
            placeholder="voce@exemplo.com"
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
    </div>
  );
}