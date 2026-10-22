"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { ImageCropModal } from "~/components/common/ImageCropModal";
import { ensureUploadableImage } from "~/lib/image-upload";
import { apiPath } from "~/lib/api-path";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/**
 * PhotoGate — lembrete de foto, não bloqueio.
 *
 * Antes o app ficava fechado até o aluno enviar foto. Isso travava alunos
 * (inclusive quem já tinha treino) e escondia o plano. Agora o app abre
 * normalmente e um aviso discreto pede a foto, que pode ser dispensado.
 */
export function PhotoGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let ready = file;
    try {
      ready = await ensureUploadableImage(file);
    } catch {
      toast.error("Foto inválida", { description: "Escolha um JPG ou PNG da galeria." });
      return;
    }
    if (ready.size > 8 * 1024 * 1024) {
      toast.error("Foto muito grande", { description: "Escolha uma de até 8 MB." });
      return;
    }
    setCropSrc(URL.createObjectURL(ready));
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
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.url) {
        throw new Error(data?.error ?? `Falha no upload da foto (HTTP ${res.status}). Tente de novo.`);
      }
      await refreshProfile();
      toast.success("Foto salva!", { description: "App liberado. Bom treino." });
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
    <>
      {children}
      {!dismissed ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+70px)] z-40 mx-auto max-w-md px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-[#0B111C]/95 p-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Adicionar foto de perfil"
              className="tactile relative shrink-0"
            >
              <Avatar className="h-10 w-10 border border-brand/40 bg-card">
                <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-brand text-brand-foreground">
                <Camera className="h-2.5 w-2.5" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-bold text-foreground">Adicione sua foto</p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Seu personal e a galera do ranking te reconhecem pelo rosto.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className="tactile shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[10.5px] font-black text-brand-foreground disabled:opacity-50"
            >
              {saving ? "Enviando..." : "Enviar"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dispensar aviso de foto"
              className="tactile shrink-0 rounded-lg px-1.5 py-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
        </div>
      ) : null}

      <ImageCropModal
        open={cropOpen}
        src={cropSrc}
        onClose={() => setCropOpen(false)}
        onConfirm={onCropConfirm}
      />
    </>
  );
}
