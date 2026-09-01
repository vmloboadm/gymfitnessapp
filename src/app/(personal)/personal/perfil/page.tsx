"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Check, Users, BarChart3, TrendingUp, ClipboardList, UserRound } from "lucide-react";
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
  const [bio, setBio] = useState(
    "C Parish treinando há 8 anos. Especialista em hipertrofia e recomposição corporal. Acredito em execução limpa antes de carga."
  );
  const [editingBio, setEditingBio] = useState(false);
  const [assigned, setAssigned] = useState<Awaited<ReturnType<typeof listAssignedWorkouts>>>([]);

  useEffect(() => {
    setAssigned(listAssignedWorkouts());
    const bump = () => setAssigned(listAssignedWorkouts());
    window.addEventListener("gymfit-trainer-workouts", bump);
    return () => window.removeEventListener("gymfit-trainer-workouts", bump);
  }, []);

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
          <span className="relative shrink-0 rounded-full bg-brand p-[2px] shadow-[0_0_18px_rgba(244,113,30,0.35)]">
            <Avatar className="h-16 w-16 border-2 border-background">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? "Personal"} />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-lg font-black text-brand-foreground">
                {(profile?.name?.[0] ?? "P").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </span>
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
