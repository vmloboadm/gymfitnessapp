"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { ImageCropModal } from "~/components/common/ImageCropModal";
import { apiPath } from "~/lib/api-path";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/**
 * PhotoGate — aluno sem foto de perfil não usa o app.
 *
 * O personal precisa identificar quem é cada aluno pelo rosto: quem já tem
 * cadastro e ainda não enviou foto fica com o app "fechado" até subir uma.
 * Depois que `profiles.avatar_url` existe, os filhos (todas as telas do
 * aluno) aparecem normalmente.
 */
export function PhotoGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Foto muito grande", { description: "Escolha uma de até 8 MB." });
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const onCropConfirm = async (blob: Blob) => {
    setCropOpen(false);
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
      const res = await fetch(apiPath("/api/avatar"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) throw new Error(data.error ?? "Falha no upload da foto");
      await refreshProfile();
      toast.success("Foto salva!", { description: "App liberado — bom treino." });
    } catch (e) {
      toast.error("Não foi possível enviar a foto", { description: String(e).slice(0, 80) });
    } finally {
      setSaving(false);
    }
  };

  // Carregando o perfil: mantém a tela dos filhos (sem piscar o bloqueio).
  if (loading || isDemo) return <>{children}</>;
  // Sem perfil = sem sessão/guard da rota resolve; não trava aqui.
  if (!profile || profile.avatar_url) return <>{children}</>;

  const initials = (profile.name || "A")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/40 bg-brand/10 text-brand">
          <Lock className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <h1 className="text-lg font-black text-foreground">Falta a sua foto</h1>
        <p className="max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
          Seu personal e a academia precisam te reconhecer pelo rosto. Envie uma
          foto de rosto para liberar o app — leva 10 segundos.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Adicionar foto de perfil"
          className="tactile relative"
        >
          <Avatar className="h-28 w-28 border-[3px] border-brand/50 bg-card shadow-lg shadow-brand/10">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-3xl font-black text-brand-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-brand text-brand-foreground">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
        <Button
          type="button"
          size="lg"
          className="tactile rounded-xl"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {saving ? "Enviando..." : "Escolher foto do rosto"}
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground/70">
          JPG ou PNG, até 8 MB. O recorte é automático.
        </p>
      </div>

      <ImageCropModal
        open={cropOpen}
        src={cropSrc}
        onClose={() => setCropOpen(false)}
        onConfirm={onCropConfirm}
      />
    </main>
  );
}
