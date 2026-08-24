"use client";

import { Play, Pause, Music2, Heart, Clock, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { TopBar } from "~/components/layout/TopBar";
import { cn } from "~/lib/utils";

/**
 * Playlist / Música (plano §8): trilha da academia.
 * Primeira versão usa playlist curada própria (fallback sem dependência
 * externa); integração Spotify entra em avaliação de API.
 */

const TRACKS = [
  { id: "t1", title: "Eye of the Tiger", artist: "Survivor", bpm: 109, dur: "4:04", emoji: "🐯", tag: "Aquecimento" },
  { id: "t2", title: "Stronger", artist: "Kanye West", bpm: 104, dur: "5:12", emoji: "🔥", tag: "Acelera" },
  { id: "t3", title: "Till I Collapse", artist: "Eminem", bpm: 171, dur: "4:57", emoji: "🥊", tag: "Supino" },
  { id: "t4", title: "Thunderstruck", artist: "AC/DC", bpm: 133, dur: "4:52", emoji: "⚡", tag: "Cardio" },
  { id: "t5", title: "Believer", artist: "Imagine Dragons", bpm: 125, dur: "3:24", emoji: "🙌", tag: "Perna" },
  { id: "t6", title: "Run the World (Girls)", artist: "Beyoncé", bpm: 127, dur: "3:56", emoji: "👑", tag: "HIIT" },
  { id: "t7", title: "Can't Stop", artist: "Red Hot Chili Peppers", bpm: 121, dur: "4:29", emoji: "🎸", tag: "Cooldown" },
  { id: "t8", title: "Sair das Trevas", artist: "GymFitness · Curated", bpm: 90, dur: "3:02", emoji: "🧘", tag: "Alongamento" },
];

const TAGS = ["Todas", ...new Set(TRACKS.map((t) => t.tag))];

/* energia visual pelo BPM: 90-120 = verde leve, 120-140 = brand, 140+ = quente */
function bpmTone(bpm: number): string {
  if (bpm < 110) return "text-success";
  if (bpm <= 135) return "text-brand";
  return "text-warning";
}

export default function PlaylistPage() {
  const [playing, setPlaying] = useState<string | null>("t1");
  const [liked, setLiked] = useState<Set<string>>(new Set(["t3"]));
  const [tag, setTag] = useState<string>("Todas");

  const filtered = useMemo(() => (tag === "Todas" ? TRACKS : TRACKS.filter((t) => t.tag === tag)), [tag]);

  const toggle = (id: string) => {
    navigator.vibrate?.(20);
    setPlaying((p) => (p === id ? null : id));
  };

  const toggleLike = (id: string) => {
    navigator.vibrate?.(15);
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const current = TRACKS.find((t) => t.id === playing);

  return (
    <>
      <TopBar title="Playlist" subtitle="Trilha da academia · like no seu treino" />
      <div className="space-y-6 p-4">
        {/* Agora tocando na academia */}
        <div className="gf-rise relative overflow-hidden rounded-[20px] border border-brand/40 bg-gradient-to-br from-brand/25 via-card to-card p-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "radial-gradient(90% 90% at 15% -10%, var(--brand-soft), transparent 55%)" }}
          />
          <div className="relative flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-card text-3xl shadow-inner">
              {current?.emoji ?? "🎧"}
              {playing ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                  <span className="absolute h-4 w-4 animate-ping rounded-full bg-success opacity-50" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-success" />
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="gf-section flex items-center gap-1 text-success">
                <Radio className="h-3 w-3" /> Agora na academia
              </p>
              <p className="mt-1 truncate text-base font-bold text-foreground">
                {current?.title ?? "Nada tocando"}
              </p>
              <p className="gf-hero-num text-xs text-muted-foreground">
                {current ? `${current.artist} · ${current.bpm} BPM` : "Aperte play abaixo"}
              </p>
            </div>
            {playing ? (
              <button
                onClick={() => toggle(playing)}
                className="gf-touch flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/30"
                aria-label="Pausar"
              >
                <Pause className="h-5 w-5 fill-current" />
              </button>
            ) : null}
          </div>

          {/* progresso da faixa (simulado, CSS puro) */}
          {playing && current ? (
            <div className="relative mt-4">
              <div className="h-1 overflow-hidden rounded-full bg-card/60">
                <div className="track-progress h-full rounded-full bg-gradient-to-r from-brand to-warning" />
              </div>
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                <span>0:00</span>
                <span>{current.dur}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Filtro por momento do treino */}
        <div className="gf-rise scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" style={{ animationDelay: "60ms" }}>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => {
                navigator.vibrate?.(10);
                setTag(t);
              }}
              aria-pressed={tag === t}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
                tag === t
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Faixas */}
        <div className="gf-rise gf-card gf-glass !p-0" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="gf-section">Trilha do treino</p>
            <span className="text-[10px] text-muted-foreground">{filtered.length} faixas · curadoria própria</span>
          </div>
          <div className="p-2">
            {filtered.map((t) => {
              const isPlaying = playing === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors",
                    isPlaying ? "bg-brand-soft/30" : "hover:bg-card/40"
                  )}
                >
                  <button
                    onClick={() => toggle(t.id)}
                    className="gf-touch flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-xl"
                    aria-label={`Reproduzir ${t.title}`}
                  >
                    {isPlaying ? <Pause className="h-4 w-4 text-brand" fill="currentColor" /> : <Play className="h-4 w-4 text-muted-foreground" fill="currentColor" />}
                  </button>
                  <button onClick={() => toggle(t.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] font-semibold text-foreground">{t.title}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn("gf-hero-num !text-[11px]", bpmTone(t.bpm))}>{t.bpm}</span>
                      BPM
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {t.dur}
                      </span>
                      <span className="rounded bg-card px-1 py-0.5 text-[9px] font-semibold text-brand">{t.tag}</span>
                    </p>
                  </button>
                  <button
                    onClick={() => toggleLike(t.id)}
                    className="gf-touch flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                    aria-label={`Curtir ${t.title}`}
                    aria-pressed={liked.has(t.id)}
                  >
                    <Heart className={cn("h-4 w-4", liked.has(t.id) && "fill-success text-success")} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nota de integração futuro */}
        <div className="gf-rise flex items-start gap-2 rounded-xl border border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground" style={{ animationDelay: "180ms" }}>
          <Music2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1DB954]" />
          <span>
            Versão 1 usa trilha curada própria, sem dependência externa. Integração com Spotify
            (ver &quot;o que está tocando agora&quot;) está em avaliação de viabilidade de API.
          </span>
        </div>
      </div>
    </>
  );
}
