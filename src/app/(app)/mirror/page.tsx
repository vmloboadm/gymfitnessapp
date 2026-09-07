"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Share2, Copy, Check, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList } from "~/components/common/AsyncStates";

const HASHTAG = "#GymFitnessCampos";

const MOTIVATION = [
  "Disciplina é o que separa o sonho do resultado.",
  "O treino de hoje é o shape de amanhã.",
  "Quem treina em dupla com a constância nunca perde.",
  "Suor de hoje, orgulho de amanhã.",
  "Feito é melhor que perfeito. Bora pro próximo!",
];

/**
 * Cartão compartilhável do espelho (/mirror).
 * Sem câmera: mostra os stats reais do aluno (treinos na semana,
 * tempo de hoje) num cartão estilo post + compartilhar nativo.
 * O QR colado no espelho físico abre esta página.
 */
export default function MirrorPage() {
  const { user, profile } = useAuth();
  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [todayMin, setTodayMin] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const sb = supabaseBrowser();
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [week, todayRows] = await Promise.all([
          sb.from("workout_sessions").select("id", { count: "exact" })
            .eq("student_id", user.id).eq("status", "completed").gte("started_at", weekAgo),
          sb.from("workout_sessions").select("started_at, ended_at, meta")
            .eq("student_id", user.id).eq("status", "completed").gte("started_at", today.toISOString()),
        ]);
        if (!alive) return;
        setWeekCount(week.count ?? 0);
        let mins = 0;
        for (const s of (todayRows.data ?? []) as Array<{ started_at: string; ended_at: string | null; meta: { duration_min?: number } | null }>) {
          if (typeof s.meta?.duration_min === "number") mins += s.meta.duration_min;
          else if (s.ended_at) mins += Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000));
        }
        setTodayMin(mins);
      } catch {
        if (alive) { setWeekCount(0); setTodayMin(0); }
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const name = profile?.name?.split(" ")[0] ?? "Você";
  const kcal = useMemo(() => (todayMin ? Math.round(todayMin * 6) : 0), [todayMin]);

  const shareText = useMemo(() => {
    const parts = [`🔥 Treino concluído na GymFitness!`];
    if ((weekCount ?? 0) > 0) parts.push(`${weekCount}x esta semana — rumo à meta`);
    if ((todayMin ?? 0) > 0) parts.push(`${todayMin} min · ~${kcal} kcal`);
    parts.push(HASHTAG);
    return parts.join("\n");
  }, [weekCount, todayMin, kcal]);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "GymFitness Campos", text: shareText });
        return;
      } catch { /* usuário cancelou — sem erro */ }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Texto copiado! Cole no Instagram/WhatsApp.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não deu copiar. Tente novamente.");
    }
  };

  const loading = weekCount === null || todayMin === null;
  const quote = useMemo(() => MOTIVATION[new Date().getDate() % MOTIVATION.length], []);

  return (
    <>
      <TopBar title="Espelho GymFitness" subtitle="Seu cartão pra compartilhar" />
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        {loading ? (
          <SkeletonList rows={2} />
        ) : (
          <div className="gf-card gf-glass relative overflow-hidden !p-0 text-center">
            <div className="bg-gradient-to-br from-brand via-[#FF8A3D] to-[#FFC24D] px-5 pb-5 pt-6" aria-hidden={false}>
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-black/60">
                <Dumbbell className="h-3.5 w-3.5" /> GymFitness Campos
              </p>
              <p className="mt-2 text-4xl font-black leading-none text-black">🔥</p>
              <p className="mt-1 text-2xl font-black leading-tight text-black">TREINO<br />CONCLUÍDO</p>
              <p className="mt-2 text-[14px] font-bold text-black/80">{name}, {(weekCount ?? 0) > 0 ? `${weekCount}x esta semana. Segue o plano!` : "primeiro passo dado. Amanhã tem mais!"}</p>
            </div>
            <div className="flex items-center justify-center gap-6 px-5 py-4">
              <div>
                <p className="text-xl font-black text-foreground">{todayMin ?? 0}<span className="text-[11px] font-bold text-muted-foreground"> min</span></p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">hoje</p>
              </div>
              <div className="h-8 w-px bg-white/10" aria-hidden />
              <div>
                <p className="text-xl font-black text-foreground">~{kcal}<span className="text-[11px] font-bold text-muted-foreground"> kcal</span></p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">queimadas*</p>
              </div>
              <div className="h-8 w-px bg-white/10" aria-hidden />
              <div>
                <p className="text-xl font-black text-brand">{weekCount ?? 0}x</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">na semana</p>
              </div>
            </div>
            <p className="px-5 pb-1 text-[12px] italic text-muted-foreground">“{quote}”</p>
            <p className="px-5 pb-4 text-[12px] font-black text-brand">{HASHTAG}</p>
          </div>
        )}

        <button
          onClick={share}
          className="tactile flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-3.5 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
        >
          <Share2 className="h-4 w-4" strokeWidth={3} /> Compartilhar
        </button>
        <button
          onClick={copy}
          className="tactile flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[13px] font-bold text-foreground"
        >
          {copied ? <Check className="h-4 w-4 text-[#4ADE80]" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado!" : "Copiar texto"}
        </button>

        <p className="flex items-start gap-1.5 rounded-2xl border border-brand/25 bg-brand/[0.07] p-3 text-[11px] leading-relaxed text-foreground">
          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          Poste sua foto marcando a GymFitness e apareça na TV do salão! 📺
        </p>
      </div>
    </>
  );
}
