"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Check, Users, BarChart3, TrendingUp, ClipboardList, UserRound, Camera, KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import { supabaseBrowser } from "~/lib/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/hooks/useAuth";
import { demoPersonalStudents, studentStatus } from "~/lib/personal-data";
import { listAssignedWorkouts, streakOverride } from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const TABS = [
  { id: "alunos", label: "Meus Alunos", icon: Users },
  { id: "stats", label: "Estatísticas", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Perfil profissional do personal: apresentação, alunos e estatísticas. */
export default function PersonalPerfilPage() {
  const { profile } = useAuth();
  const students = useMemo(() => demoPersonalStudents(), []);
  const [tab, setTab] = useState<TabId>("alunos");
  const [demoAvatar, setDemoAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState(
    "C Parish treinando há 8 anos. Especialista em hipertrofia e recomposição corporal. Acredito em execução limpa antes de carga."
  );
  const [editingBio, setEditingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assigned, setAssigned] = useState<Awaited<ReturnType<typeof listAssignedWorkouts>>>([]);

  useEffect(() => {
    setAssigned(listAssignedWorkouts());
    const bump = () => setAssigned(listAssignedWorkouts());
    window.addEventListener("gymfit-trainer-workouts", bump);
    return () => window.removeEventListener("gymfit-trainer-workouts", bump);
  }, []);

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

  /** Foto: /api/avatar faz o smart crop (rosto centrado) e salva no perfil. */
  const onPickPhoto = async (file: File | null) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      if (isDemo) {
        // demo sem Supabase: preview local
        const url = URL.createObjectURL(file);
        toast.success("Foto carregada (modo teste, não salva no servidor)");
        setDemoAvatar(url);
      } else {
        const { data: sess } = await supabaseBrowser().auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Faça login para trocar a foto.");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/avatar", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!data.ok || !data.url) throw new Error(data.error ?? "Falha no upload");
        await supabaseBrowser().auth.updateUser({ data: { avatar_url: data.url } });
        toast.success("Foto atualizada com o rosto no centro!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const changePassword = async () => {
    if (savingPw) return;
    if (pw1.length < 6) {
      toast.error("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (pw1 !== pw2) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (isDemo) {
      toast.info("Troca de senha disponível no login real da academia.");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password: pw1 });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setPwOpen(false);
      setPw1("");
      setPw2("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu trocar a senha agora.");
    } finally {
      setSavingPw(false);
    }
  };

  const monthKey = new Date().getMonth();
  const monthWorkouts = assigned.filter((w) => new Date(w.created_at).getMonth() === monthKey).length;
  const activeCount = students.filter((s) => s.lastTrainingDaysAgo <= 2).length;
  const retention = Math.round((activeCount / students.length) * 100);
  const avgStreak =
    Math.round(
      students.reduce((acc, s) => acc + (streakOverride(s.id) ?? s.streak), 0) / students.length
    ) || 0;

  return (
    <div className="space-y-5">
      {/* apresentação profissional */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="gf-card gf-glass !p-5"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Trocar foto de perfil"
            className="group relative shrink-0 rounded-full bg-brand p-[2px] shadow-[0_0_18px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.96]"
          >
            <Avatar className="h-16 w-16 border-2 border-background">
              <AvatarImage src={demoAvatar ?? profile?.avatar_url ?? undefined} alt={profile?.name ?? "Personal"} />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-lg font-black text-brand-foreground">
                {(profile?.name?.[0] ?? "P").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-card text-muted-foreground group-hover:text-brand">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-foreground">{profile?.name ?? "Personal"}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand">
              Personal Trainer · CREF 000000 G/SP
            </p>
            <p className="mt-0.5 inline-flex rounded-full bg-brand/15 px-2 py-0.5 text-[9.5px] font-bold text-brand">
              Especialidade: Hipertrofia e Recomposição
            </p>
          </div>
        </div>

        {/* bio editável */}
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <UserRound className="h-3 w-3" /> Bio
          </p>
          {editingBio ? (
            <div className="flex gap-2">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                aria-label="Editar bio"
                className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.05] p-2.5 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              />
              <button
                onClick={() => {
                  setEditingBio(false);
                  toast.success("Bio atualizada");
                }}
                aria-label="Salvar bio"
                className="tactile flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-brand text-brand-foreground transition-transform active:scale-[0.96]"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="group relative">
              <p className="pr-8 text-[12.5px] leading-snug text-muted-foreground">{bio}</p>
              <button
                onClick={() => setEditingBio(true)}
                aria-label="Editar bio"
                className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-muted-foreground transition-colors hover:text-brand"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </motion.header>

      {/* Sair da conta */}
      <button
        onClick={async () => {
          const { error } = await supabaseBrowser().auth.signOut();
          if (error) {
            toast.error("Não deu sair agora. Tente novamente.");
            return;
          }
          try { localStorage.clear(); } catch {}
          toast.success("Você saiu da conta.");
          window.location.href = "/login";
        }}
        className="tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-[#F87171]/25 bg-[#F87171]/[0.06] py-3.5 text-[13px] font-bold text-[#F87171] transition-transform active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>

      {/* Segurança: alterar senha */}
      <section className="gf-card gf-glass !p-4" aria-labelledby="seg-title">
        <div className="flex items-center justify-between gap-2">
          <p id="seg-title" className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
            <KeyRound className="h-4 w-4 text-brand" />
            Segurança
          </p>
          <button
            onClick={() => setPwOpen((v) => !v)}
            className="tactile rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-bold text-muted-foreground transition-colors hover:text-brand"
          >
            {pwOpen ? "Cancelar" : "Alterar senha"}
          </button>
        </div>
        {pwOpen ? (
          <div className="mt-3 space-y-2">
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="Nova senha (mínimo 6 caracteres)"
              aria-label="Nova senha"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Confirmar nova senha"
              aria-label="Confirmar nova senha"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            />
            <Button
              onClick={changePassword}
              disabled={savingPw || !pw1 || !pw2}
              size="sm"
              className="h-10 w-full rounded-xl text-[12px] font-bold"
            >
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar nova senha
            </Button>
          </div>
        ) : null}
      </section>

      {/* abas */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-colors",
                tab === t.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "alunos" ? (
        <div className="grid grid-cols-3 gap-2.5">
          {students.map((s) => {
            const st = studentStatus(s);
            return (
              <div key={s.id} className="gf-card gf-glass !rounded-2xl !p-3 text-center">
                <div className="relative mx-auto w-fit">
                  <Avatar className="h-14 w-14 border-2 border-white/[0.08]">
                    <AvatarImage src={s.avatar} alt={s.name} />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
                      {s.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0B1220]",
                      st.tone === "green" ? "bg-[#4ADE80]" : st.tone === "amber" ? "bg-[#FFC24D]" : "bg-[#F87171]"
                    )}
                    aria-hidden
                  />
                </div>
                <p className="mt-2 truncate text-[11px] font-bold text-foreground">
                  {s.name.split(" ")[0]}
                </p>
                <p className="truncate text-[9px] text-muted-foreground">{s.activeWorkout ?? "Sem treino"}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="gf-card gf-glass !rounded-2xl !p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                <ClipboardList className="h-4 w-4 text-brand" />
              </span>
              <p className="mt-2 font-display text-2xl font-black text-foreground">{monthWorkouts}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">Treinos prescritos no mês</p>
            </div>
            <div className="gf-card gf-glass !rounded-2xl !p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#4ADE80]/25 bg-[#4ADE80]/10">
                <TrendingUp className="h-4 w-4 text-[#4ADE80]" />
              </span>
              <p className="mt-2 font-display text-2xl font-black text-foreground">{retention}%</p>
              <p className="text-[10px] font-semibold text-muted-foreground">
                Taxa de retenção ({activeCount}/{students.length} ativos)
              </p>
            </div>
          </div>
          <div className="gf-card gf-glass !rounded-2xl !p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Streak médio da turma</p>
            <p className="mt-1 font-display text-xl font-black text-foreground">{avgStreak} dias</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (avgStreak / 10) * 100)}%` }}
                transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-brand to-[#FF8A3C]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
