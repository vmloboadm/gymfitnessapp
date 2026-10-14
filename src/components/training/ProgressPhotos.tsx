"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { apiPath } from "~/lib/api-path";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { cn } from "~/lib/utils";

type Photo = {
  id: string;
  url: string;
  angle: string;
  phase: string;
  visibility: string;
  taken_at: string;
};

const ANGLES = [
  { id: "frente", label: "Frente" },
  { id: "lado", label: "Lado" },
  { id: "costas", label: "Costas" },
] as const;

const PHASES = [
  { id: "antes", label: "Antes" },
  { id: "depois", label: "Depois" },
] as const;

/**
 * Fotos de evolução do aluno (antes/depois, frente/lado/costas).
 * Privacidade: só o aluno vê por padrão; ele pode liberar para o personal.
 */
export function ProgressPhotos() {
  const { user, profile, loading: authLoading } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [angle, setAngle] = useState("frente");
  const [phase, setPhase] = useState("antes");
  const [uploading, setUploading] = useState(false);

  // personal vinculado (para mostrar para quem a liberação vale).
  // Sem vínculo, ninguém além do aluno vê mesmo liberando: oferece escolher aqui.
  const { data: trainerInfo, refetch: refetchTrainer } = useAsyncQuery<{
    linkedId: string | null;
    linkedName: string | null;
    trainers: Array<{ id: string; name: string; avatar_url: string | null }>;
  }>(
    async () => {
      if (!user || !profile?.gym_id) return { data: null, error: null };
      const supabase = supabaseBrowser();
      const { data: link } = await supabase
        .from("student_trainers")
        .select("trainer_id")
        .eq("student_id", user.id)
        .limit(1)
        .maybeSingle();
      const tid = (link as { trainer_id?: string } | null)?.trainer_id ?? null;
      const rpc = await supabase.rpc("list_my_gym_trainers");
      const trainers = (!rpc.error && Array.isArray(rpc.data)
        ? (rpc.data as Array<{ id: string; name: string; avatar_url: string | null }>)
        : []);
      const found = trainers.find((m) => m.id === tid);
      return {
        data: {
          linkedId: tid,
          linkedName: found?.name?.split(" ")[0] ?? (tid ? "Personal" : null),
          trainers,
        },
        error: null,
      };
    },
    [user?.id, profile?.gym_id],
    { enabled: !authLoading && !!user }
  );
  const linkedName = trainerInfo?.linkedName ?? null;

  const [choosing, setChoosing] = useState(false);
  const chooseTrainer = async (trainerId: string) => {
    setChoosing(true);
    try {
      const { error } = await supabaseBrowser().rpc("choose_personal", {
        p_trainer_id: trainerId,
      });
      if (error) throw new Error(error.message);
      toast.success("Personal vinculado", {
        description: "Suas fotos liberadas agora chegam até ele.",
      });
      refetchTrainer();
    } catch (e) {
      toast.error("Não deu vincular agora", {
        description: String(e instanceof Error ? e.message : e).slice(0, 80),
      });
    } finally {
      setChoosing(false);
    }
  };

  const { data, loading, error, refetch } = useAsyncQuery<Photo[]>(
    async () => {
      if (!user) return { data: null, error: { message: "Sessão indisponível" } };
      const { data: rows, error } = await supabaseBrowser()
        .from("progress_photos")
        .select("id, url, angle, phase, visibility, taken_at")
        .eq("student_id", user.id)
        .order("taken_at", { ascending: false })
        .limit(30);
      if (error) return { data: null, error };
      return { data: (rows ?? []) as Photo[], error: null };
    },
    [user?.id],
    { enabled: !authLoading && !!user }
  );

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    let ready = file;
    try {
      const { ensureUploadableImage } = await import("~/lib/image-upload");
      ready = await ensureUploadableImage(file);
    } catch {
      toast.error("Foto inválida", { description: "Escolha um JPG ou PNG da galeria." });
      return;
    }
    if (ready.size > 8 * 1024 * 1024) {
      toast.error("Foto muito grande", { description: "Escolha uma de até 8 MB." });
      return;
    }
    void upload(ready);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("angle", angle);
      fd.append("phase", phase);
      fd.append("visibility", "self");
      const res = await fetch(apiPath("/api/progress-photo"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `Falha no envio (HTTP ${res.status}). Tente de novo.`);
      }
      toast.success("Foto salva na sua evolução");
      refetch();
    } catch (e) {
      toast.error("Não foi possível enviar a foto", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    } finally {
      setUploading(false);
    }
  };

  const setVisibility = async (photo: Photo, visibility: string) => {
    try {
      const { error } = await supabaseBrowser()
        .from("progress_photos")
        .update({ visibility } as never)
        .eq("id", photo.id);
      if (error) throw new Error(error.message);
      toast.success(visibility === "trainer" ? "Personal pode ver" : "Só você vê");
      refetch();
    } catch (e) {
      toast.error("Não deu alterar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    }
  };

  const remove = async (photo: Photo) => {
    try {
      const { error } = await supabaseBrowser().from("progress_photos").delete().eq("id", photo.id);
      if (error) throw new Error(error.message);
      toast.success("Foto apagada");
      refetch();
    } catch (e) {
      toast.error("Não deu apagar agora", { description: String(e instanceof Error ? e.message : e).slice(0, 80) });
    }
  };

  const photos = data ?? [];
  const firstAntes = [...photos].reverse().find((p) => p.phase === "antes") ?? null;
  const lastDepois = photos.find((p) => p.phase === "depois") ?? null;

  return (
    <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "270ms" }}>
      <p className="gf-section">Fotos de evolução</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Antes e depois, só suas por padrão.{" "}
        {linkedName ? (
          <>Liberando, <strong className="text-foreground">{linkedName}</strong> pode ver.</>
        ) : (
          <>Sem personal vinculado: escolha um para a liberação valer.</>
        )}
      </p>

      {!linkedName && (trainerInfo?.trainers ?? []).length > 0 ? (
        <div className="mt-2.5 space-y-1.5 rounded-2xl border border-brand/30 bg-brand/[0.05] p-3">
          <p className="text-[11px] font-bold text-foreground">Quem acompanha sua evolução?</p>
          {(trainerInfo?.trainers ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTrainer(t.id)}
              disabled={choosing}
              className="tactile flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2 text-left disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black text-brand-foreground">
                {(t.name?.[0] ?? "?").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-foreground">
                {t.name}
              </span>
              <span className="shrink-0 text-[10.5px] font-black text-brand">
                {choosing ? "..." : "Escolher"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3"><SkeletonList rows={2} /></div>
      ) : error ? (
        <div className="mt-3"><ErrorState message={error} onRetry={refetch} /></div>
      ) : (
        <>
          {firstAntes && lastDepois ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { p: firstAntes, label: "Antes" },
                { p: lastDepois, label: "Depois" },
              ].map(({ p, label }) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-white/[0.07]">
                  <img src={p.url} alt={`${label} · ${p.angle}`} className="aspect-[4/5] w-full object-cover" loading="lazy" />
                  <figcaption className="bg-white/[0.03] px-2 py-1.5 text-center text-[10px] font-bold text-muted-foreground">
                    {label} · {p.angle}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Sem fotos ainda" description="Envie a primeira foto de frente para começar o comparativo." />
            </div>
          ) : null}

          {photos.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {photos.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                  <img src={p.url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-bold capitalize text-foreground">
                      {p.phase} · {p.angle}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(p.taken_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisibility(p, p.visibility === "trainer" ? "self" : "trainer")}
                    aria-pressed={p.visibility === "trainer"}
                    title={p.visibility === "trainer" ? "Personal pode ver. Toque para privar." : "Só você vê. Toque para liberar ao personal."}
                    className={cn(
                      "tactile flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold",
                      p.visibility === "trainer"
                        ? "border-brand/50 bg-brand/10 text-brand"
                        : "border-white/[0.08] text-muted-foreground"
                    )}
                  >
                    {p.visibility === "trainer" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {p.visibility === "trainer" ? "Personal" : "Só eu"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    aria-label="Apagar foto"
                    className="tactile rounded-lg p-1.5 text-muted-foreground hover:text-[#F87171]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Ângulo da foto">
        {ANGLES.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAngle(a.id)}
            aria-pressed={angle === a.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-bold",
              angle === a.id ? "border-brand bg-brand/15 text-brand" : "border-white/[0.08] text-muted-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
        <span className="mx-0.5 self-center text-muted-foreground">·</span>
        {PHASES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setPhase(f.id)}
            aria-pressed={phase === f.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-bold",
              phase === f.id ? "border-brand bg-brand/15 text-brand" : "border-white/[0.08] text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="tactile mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[12.5px] font-black text-brand-foreground disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {uploading ? "Enviando..." : `Enviar foto (${phase}, ${angle})`}
      </button>
    </div>
  );
}
