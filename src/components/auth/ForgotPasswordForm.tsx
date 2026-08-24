"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
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

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = supabaseBrowser();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/forgot-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar o link", { description: error.message });
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um link para redefinir sua senha em <strong>{email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            asChild
            variant="outline"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            <Link href="/login">Voltar ao login</Link>
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recuperar senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail para receber um link de redefinição
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
        <Button type="submit" className="w-full" disabled={loading} size="lg">
          {loading ? <Loader2 className="animate-spin" /> : <Mail />}
          Enviar link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}