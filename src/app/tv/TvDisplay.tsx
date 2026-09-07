"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Trophy, Lightbulb, BadgePercent, Heart } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

type Slide = {
  kind: "sponsor" | "tip" | "ranking" | "motivation";
  title: string;
  body: string;
  durationSec: number;
};

const DEFAULT_SLIDES: Slide[] = [
  { kind: "motivation", title: "Bom treino!", body: "Constância vence intensidade. 1% melhor a cada dia.", durationSec: 20 },
  { kind: "tip", title: "Dica do dia", body: "Beba água entre as séries — hidratação mantém a performance.", durationSec: 20 },
  { kind: "motivation", title: "GymFitness Campos", body: "Escaneie o QR das máquinas e veja todos os exercícios possíveis.", durationSec: 20 },
];

const KIND_STYLE: Record<Slide["kind"], { icon: typeof Dumbbell; label: string; ring: string }> = {
  sponsor: { icon: BadgePercent, label: "Parceiro", ring: "border-[#4ADE80]/40" },
  tip: { icon: Lightbulb, label: "Dica", ring: "border-[#FFC24D]/40" },
  ranking: { icon: Trophy, label: "Ranking", ring: "border-brand/40" },
  motivation: { icon: Heart, label: "GymFitness", ring: "border-white/15" },
};

/**
 * Display rotativo da TV da academia.
 * Busca tv_content (se a tabela existir) + patrocinadores ativos;
 * sem conteúdo, usa slides padrão. Troca automática por durationSec.
 */
export function TvDisplay() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = supabaseBrowser();
        // tv_content pode ainda não existir (Ticket 7) — falha silenciosa.
        const { data: tv } = await sb
          .from("tv_content")
          .select("type, title, body, duration_sec")
          .eq("active", true)
          .order("ord", { ascending: true })
          .limit(20);
        const { data: sponsors } = await sb
          .from("sponsors")
          .select("name, discount_text")
          .eq("active", true)
          .order("ord", { ascending: true })
          .limit(10);
        if (cancelled) return;
        const built: Slide[] = [];
        for (const row of (tv ?? []) as Array<{ type: string; title: string; body: string | null; duration_sec: number | null }>) {
          if (["sponsor", "tip", "ranking", "motivation"].includes(row.type)) {
            built.push({
              kind: row.type as Slide["kind"],
              title: row.title,
              body: row.body ?? "",
              durationSec: Math.max(10, Math.min(120, row.duration_sec ?? 30)),
            });
          }
        }
        for (const s of (sponsors ?? []) as Array<{ name: string; discount_text: string }>) {
          built.push({ kind: "sponsor", title: s.name, body: s.discount_text, durationSec: 25 });
        }
        if (built.length > 0) setSlides(built);
      } catch {
        // sem tabela / sem rede: mantém slides padrão
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ms = (slides[idx]?.durationSec ?? 20) * 1000;
    const t = setTimeout(() => setIdx((i) => (i + 1) % slides.length), ms);
    return () => clearTimeout(t);
  }, [idx, slides]);

  const slide = slides[idx % slides.length];
  const style = KIND_STYLE[slide.kind];
  const Icon = style.icon;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#05080f] p-8 text-center text-[#F4F6FB]">
      <span className={cn("mb-6 inline-flex items-center gap-2 rounded-full border bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/60", style.ring)}>
        <Icon className="h-4 w-4" /> {style.label}
      </span>
      <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">{slide.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/70 md:text-2xl">{slide.body}</p>
      <div className="mt-8 flex gap-2">
        {slides.map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 rounded-full transition-all", i === idx % slides.length ? "w-8 bg-brand" : "w-1.5 bg-white/20")}
          />
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-white/40">
        <Dumbbell className="h-3.5 w-3.5" /> GymFitness Campos · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
