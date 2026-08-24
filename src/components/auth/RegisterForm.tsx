"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LgpdConsent } from "~/components/auth/LgpdConsent";
import { GymLogo } from "~/components/layout/GymLogo";
import { toast } from "sonner";

/**
 * Cadastro com LGPD handshake (blueprint §3.1).
 * Após criar o auth user, cria o profile no corpo do onboarding
 * (salvo incrementalmente na rota /onboarding/step-1).
 */
export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [lgpdError, setLgpdError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgpd) {
      setLgpdError("É necessário aceitar os termos para continuar.");
      return;
    }
    setLgpdError("");
    setLoading(true);

    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    setLoading(false);

    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }

    if (data.user) {
      toast.success("Conta criada!");
      // Cria o profile + gym padrão do onboarding
      router.push("/onboarding");
      router.refresh();
    } else {
      toast.info("Verifique seu e-mail para confirmar o cadastro");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <GymLogo />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Criar conta
          </h1>
          <p className="text-sm text-muted-foreground">
            Comece seu treino hoje mesmo
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome completo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <LgpdConsent
          checked={lgpd}
          onChange={setLgpd}
          error={lgpdError}
        />

        <Button type="submit" className="w-full" disabled={loading} size="lg">
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}