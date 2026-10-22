"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, KeyRound, CheckCircle2, ShieldAlert } from "lucide-react";
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
import { GymLogo } from "~/components/layout/GymLogo";
import { toast } from "sonner";

/**
 * Tela de definição de nova senha.
 *
 * O link do e-mail de recuperação volta para cá com um `code` (fluxo PKCE)
 * ou com os tokens no hash (fluxo implícito). Sem esta tela o aluno caía de
 * volta no formulário de "pedir link" e a senha nunca era trocada.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabaseBrowser();
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      // Link gerado pelo staff: token_hash + type=recovery → verifyOtp.
      if (tokenHash && type === "recovery") {
        const { error } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error && alive) {
          setValid(false);
          setChecking(false);
          return;
        }
      }

      // PKCE: troca o code por sessão. Implícito: o cliente já leu o hash.
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error && alive) {
          setValid(false);
          setChecking(false);
          return;
        }
      }

      const { data } = await sb.auth.getSession();
      if (!alive) return;
      setValid(!!data.session);
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [params]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw1.length < 6) {
      toast.error("Senha curta", { description: "Use pelo menos 6 caracteres." });
      return;
    }
    if (pw1 !== pw2) {
      toast.error("As senhas não conferem", { description: "Digite a mesma senha nos dois campos." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password: pw1 });
      if (error) throw new Error(error.message);
      setDone(true);
      toast.success("Senha alterada!", { description: "Agora entre com a senha nova." });
      setTimeout(() => router.replace("/login"), 1600);
    } catch (err) {
      toast.error("Não deu para salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Validando o link…
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Senha alterada
          </CardTitle>
          <CardDescription>Redirecionando para o login…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" /> Link inválido ou expirado
          </CardTitle>
          <CardDescription>
            O link de recuperação já foi usado ou venceu. Peça um novo abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Pedir novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <GymLogo />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nova senha</h1>
          <p className="text-sm text-muted-foreground">Escolha a senha que você vai usar para entrar</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw1">Nova senha</Label>
              <Input
                id="pw1"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                placeholder="mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="repita a senha"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
