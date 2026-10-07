"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ImageCropModal } from "~/components/common/ImageCropModal";
import { apiPath } from "~/lib/api-path";
import { supabaseBrowser } from "~/lib/supabase/client";
import type { Profiles } from "~/lib/types/models";
import { cn } from "~/lib/utils";

type Trainer = { id: string; name: string; avatar_url: string | null; role: string };

/**
 * STEP 7 — Final do onboarding: foto de perfil (importante para o cliente)
 * e escolha do personal que vai acompanhar (Rebeca, Claudeir, Daiana...).
 * "Pular" existe, mas é discreto: a foto é o caminho esperado.
 */
export function FinalStepForm({
  profile,
  onFinish,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
  onFinish: () => Promise<void>;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabaseBrowser().rpc("list_my_gym_trainers");
        if (error) throw error;
        if (!cancelled) setTrainers((data ?? []) as Trainer[]);
      } catch {
        if (!cancelled) setTrainers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

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

  const onCropConfirm = (blob: Blob) => {
    setCropOpen(false);
    setPendingBlob(blob);
    setAvatarUrl(URL.createObjectURL(blob));
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!pendingBlob) return avatarUrl;
    const supabase = supabaseBrowser();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    const fd = new FormData();
    fd.append("file", new File([pendingBlob], "avatar.webp", { type: "image/webp" }));
    const res = await fetch(apiPath("/api/avatar"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!data.ok || !data.url) throw new Error(data.error ?? "Falha no upload da foto");
    return data.url;
  };

  const finish = async (withExtras: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      if (withExtras && !isDemo) {
        const hasSavedPhoto = !!profile.avatar_url;
        // Foto de perfil é obrigatória: o personal precisa reconhecer o aluno pelo rosto.
        if (!pendingBlob && !hasSavedPhoto) {
          toast.error("A foto de perfil é obrigatória", {
            description: "Escolha uma foto do seu rosto para concluir o cadastro.",
          });
          setSaving(false);
          return;
        }
        if (pendingBlob) {
          try {
            await uploadPhoto();
          } catch (e) {
            toast.error("Não consegui enviar a foto", {
              description: String(e).slice(0, 80),
            });
            setSaving(false);
            return;
          }
        }
        if (chosen) {
          const { error } = await supabaseBrowser().rpc("choose_personal", {
            p_trainer_id: chosen,
          });
          if (error) throw new Error(error.message);
        }
      }
      await onFinish();
    } catch (e) {
      toast.error("Não deu para concluir agora", { description: String(e).slice(0, 80) });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const chosenTrainer = trainers.find((t) => t.id === chosen);
  const initials = (profile.name || "A").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      {/* FOTO — pedida com destaque; pular é pequeno e discreto */}
      <section className="space-y-3 text-center">
        <div>
          <h2 className="text-base font-black text-foreground">Sua foto de perfil</h2>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-muted-foreground">
            Seu personal e a academia reconhecem você pelo rosto. É assim que você aparece no app.
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
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-3xl font-black text-brand-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-brand text-brand-foreground">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pickPhoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tactile text-[12px] font-bold text-brand"
          >
            {avatarUrl ? "Trocar foto" : "Escolher foto"}
          </button>
          {pendingBlob ? (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> Foto pronta para o cadastro
            </p>
          ) : null}
        </div>
      </section>

      {/* PERSONAL — quem vai acompanhar */}
      <section className="space-y-2">
        <div>
          <h2 className="text-base font-black text-foreground">Quem vai te acompanhar?</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Escolha seu personal para treinar com direção. Dá para deixar para depois.
          </p>
        </div>

        {trainers.length === 0 && !isDemo ? (
          <div className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-center text-[12px] text-muted-foreground">
            Carregando equipe da academia...
          </div>
        ) : (
          <div className="space-y-2">
            {(isDemo
              ? ([
                  { id: "t1", name: "Daiana Teodoro", avatar_url: null, role: "trainer" },
                  { id: "t2", name: "Rebeca Silveira", avatar_url: null, role: "manager" },
                  { id: "t3", name: "Claudeir Machado", avatar_url: null, role: "manager" },
                ] as Trainer[])
              : trainers
            ).map((t) => {
              const active = chosen === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChosen(active ? null : t.id)}
                  aria-pressed={active}
                  className={cn(
                    "tactile flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    active
                      ? "border-brand bg-brand/10"
                      : "border-white/[0.06] bg-white/[0.03]"
                  )}
                >
                  <Avatar className="h-11 w-11 border border-white/[0.08]">
                    {t.avatar_url ? <AvatarImage src={t.avatar_url} alt="" /> : null}
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                      {t.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">{t.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.role === "trainer" ? "Personal" : "Gestor"}
                    </p>
                  </div>
                  {active ? (
                    <Check className="h-5 w-5 shrink-0 text-brand" strokeWidth={3} />
                  ) : (
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {chosenTrainer ? (
          <p className="rounded-xl bg-brand/10 px-3 py-2 text-center text-[11px] font-semibold text-brand">
            {chosenTrainer.name.split(" ")[0]} vai receber você quando o cadastro for aprovado.
          </p>
        ) : null}
      </section>

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={saving}
          onClick={() => finish(true)}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Check strokeWidth={3} />}
          Finalizar cadastro
        </Button>
        <p className="text-center text-[11px] leading-snug text-muted-foreground/70">
          A foto é obrigatória — é assim que seu personal e a academia te reconhecem.
        </p>
      </div>

      <ImageCropModal
        open={cropOpen}
        src={cropSrc}
        onClose={() => setCropOpen(false)}
        onConfirm={onCropConfirm}
      />
    </div>
  );
}
