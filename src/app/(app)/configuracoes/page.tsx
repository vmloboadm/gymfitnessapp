"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Bell,
  ChevronRight,
  Info,
  LogOut,
  Save,
  Scale,
  Target,
  User,
} from "lucide-react";
import { TopBar } from "~/components/layout/TopBar";
import { BUILD_LABEL } from "~/lib/build";
import { getProfileEdits, saveProfileEdits, type ProfileEdits } from "~/lib/profile-store";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useAuth } from "~/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { ImageCropModal } from "~/components/common/ImageCropModal";

const OBJETIVOS: Array<{ id: NonNullable<ProfileEdits["objetivo"]>; label: string }> = [
  { id: "hipertrofia", label: "Hipertrofia" },
  { id: "emagrecimento", label: "Emagrecimento" },
  { id: "condicionamento", label: "Condicionamento" },
  { id: "saude", label: "Saúde" },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [edits, setEdits] = useState<ProfileEdits>({});
  const [bio, setBio] = useState("");
  const [objetivo, setObjetivo] = useState<ProfileEdits["objetivo"]>("hipertrofia");
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifs, setNotifs] = useState({ treino: true, conquistas: true, Ranking: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    const e = getProfileEdits();
    setEdits(e);
    setNome(e.name ?? "");
    setBio(e.bio ?? "");
    setObjetivo(e.objetivo ?? "hipertrofia");
  }, []);

  const avatarSrc = useMemo(() => edits.avatar_url ?? null, [edits.avatar_url]);

  const handleFoto = (file: File) => {
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
  };

  const onCropConfirm = async (blob: Blob) => {
    setCropOpen(false);
    try {
      setSaving(true);
      // Usa a API route que salva no Supabase (Storage + profiles.avatar_url)
      const { data: sess } = await supabaseBrowser().auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Faça login para trocar a foto.");
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) throw new Error(data.error ?? "Falha no upload");
      // Salva localmente também
      const next = saveProfileEdits({ avatar_url: data.url });
      setEdits(next);
      toast.success("Foto atualizada!");
    } catch (e) {
      toast.error("Não foi possível enviar a foto", { description: String(e).slice(0, 80) });
    } finally {
      setSaving(false);
    }
  };

  const salvar = async () => {
    setSaving(true);
    // Salva localmente (demo/cache)
    const next = saveProfileEdits({ name: nome.trim(), bio: bio.trim(), objetivo });
    setEdits(next);
    // Salva no Supabase via RPC
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc("update_student_profile", {
        p_name: nome.trim() || null,
        p_bio: bio.trim() || null,
        p_goal: null,
        p_objetivo: objetivo || null,
      });
      if (error) throw error;
      // Atualiza o profile no contexto global para refletir mudanças imediatamente
      await refreshProfile();
      toast.success("Perfil salvo!");
    } catch (e) {
      toast.error("Falha ao salvar no servidor", { description: String(e).slice(0, 80) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Configurações" subtitle="Personalize sua conta" />
      <div className="mx-auto max-w-md space-y-5 p-4 pb-24">
        {/* PERFIL */}
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Perfil
          </p>

          {/* foto */}
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted"
              aria-label="Trocar foto de perfil"
            >
              {avatarSrc ? (
                <Image src={avatarSrc} alt="Sua foto" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl">📷</span>
              )}
              {saving ? <span className="absolute inset-0 bg-black/50" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Foto de perfil</p>
              <p className="text-[11px] text-muted-foreground">Toque pra trocar (recorte automático antes de enviar)</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFoto(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* nome */}
          <label className="mt-4 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>

          {/* bio */}
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              maxLength={140}
              placeholder="Uma frase sobre você (até 140 caracteres)"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>

          {/* objetivo */}
          <span className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Target className="h-3 w-3" /> Objetivo
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {OBJETIVOS.map((o) => (
              <button
                key={o.id}
                onClick={() => setObjetivo(o.id)}
                aria-pressed={objetivo === o.id}
                className={cn(
                  "gf-touch rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors",
                  objetivo === o.id
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={salvar}
            disabled={saving}
            className="gf-touch mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </section>

        {/* PESO SUPERVISIONADO · atalho */}
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> Peso & métricas
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Alterações de peso contam pro ranking quando <span className="font-bold text-foreground">comprovadas</span>: anexe a foto do visor da balança e o personal valida.
          </p>
          <button
            onClick={() => router.push("/metricas")}
            className="gf-touch mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm font-semibold text-foreground"
          >
            Registrar nova medida <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </section>

        {/* NOTIFICAÇÕES */}
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> Notificações
          </p>
          <div className="mt-2 space-y-1">
            {[
              { key: "treino" as const, label: "Lembretes de treino" },
              { key: "conquistas" as const, label: "Conquistas e recompensas" },
              { key: "Ranking" as const, label: "Mudanças no ranking" },
            ].map((n) => (
              <button
                key={n.key}
                onClick={() => setNotifs((v) => ({ ...v, [n.key]: !v[n.key] }))}
                className="flex w-full items-center justify-between rounded-xl px-1 py-2.5"
              >
                <span className="text-sm text-foreground">{n.label}</span>
                <span
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    notifs[n.key] ? "bg-brand" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                      notifs[n.key] ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* CONTA */}
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conta</p>
          <button
            onClick={() => toast("Em produção: encerra a sessão no Supabase Auth")}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm font-bold text-danger"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        </section>

        {/* SOBRE */}
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Sobre
          </p>
          <p className="mt-2 text-[10px] font-semibold tracking-wide text-muted-foreground/70">{BUILD_LABEL}</p>
        </section>
      </div>

      <ImageCropModal
        open={cropOpen}
        src={cropSrc}
        onClose={() => { setCropOpen(false); setCropSrc(null); }}
        onConfirm={onCropConfirm}
      />
    </>
  );
}
