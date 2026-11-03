"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, HandHeart, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { PersonalChooser } from "~/components/student/PersonalSupportBox";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";
import { GYM_WHATSAPP } from "~/lib/whatsapp";
import { cn } from "~/lib/utils";

/**
 * Cards de campanha da Home (migration 079): desafio com progresso e
 * ranking, ofertas (Black Friday…) com contagem regressiva. A academia
 * controla o que aparece e até quando (promo_campaigns).
 */

type Campaign = {
  id: string;
  kind: "oferta" | "desafio";
  badge: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_type: "whatsapp_gym" | "personal" | "challenge" | "link";
  cta_value: string | null;
  challenge_id: string | null;
  theme: "black" | "verao" | "brand";
  ends_at: string;
};

type BoardRow = { id: string; name: string; avatar_url: string | null; days: number; rank: number; me: boolean };
type Board = { participants: number; joined: boolean; rows: BoardRow[] };
type Challenge = { id: string; title: string; goal_days: number; ends_on: string; prize_text: string | null };

const THEME: Record<Campaign["theme"], { box: string; badge: string; cta: string }> = {
  black: {
    box: "border-white/15 bg-gradient-to-br from-black via-[#111] to-[#1a1a1a]",
    badge: "bg-white text-black",
    cta: "bg-white text-black",
  },
  verao: {
    box: "border-[#FFC24D]/50 bg-gradient-to-br from-[#FF6F16]/30 via-[#FFC24D]/10 to-card",
    badge: "bg-[#FFC24D] text-black",
    cta: "bg-[#FFC24D] text-black",
  },
  brand: {
    box: "border-brand/50 bg-gradient-to-br from-brand/25 via-card to-card",
    badge: "bg-brand text-brand-foreground",
    cta: "bg-brand text-brand-foreground",
  },
};

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "encerrado";
  const d = Math.floor(ms / 86_400_000);
  if (d >= 2) return `faltam ${d} dias`;
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `faltam ${h}h` : "últimas horas";
}

export function CampaignCards() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});
  const [ranking, setRanking] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cheered, setCheered] = useState<Set<string>>(new Set());

  const cheer = async (challengeId: string, to: BoardRow) => {
    setCheered((s) => new Set(s).add(to.id));
    const { data, error } = await supabaseBrowser().rpc("challenge_cheer" as never, { p_challenge: challengeId, p_to: to.id } as never);
    const r = data as unknown as { ok: boolean; reason?: string } | null;
    if (error) {
      logger.error("challenge.cheer", error);
      return toast.error("Não foi possível agora.");
    }
    if (r?.ok) toast.success(`Você deu força para ${to.name} 💪`);
    else if (r?.reason === "ja_deu_hoje") toast.message(`Você já deu força para ${to.name} hoje.`);
  };

  const loadBoard = useCallback(async (challengeId: string) => {
    const { data } = await supabaseBrowser().rpc("challenge_board" as never, { p_challenge: challengeId } as never);
    if (data) setBoards((b) => ({ ...b, [challengeId]: data as unknown as Board }));
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("promo_campaigns" as never)
        .select("id, kind, badge, title, subtitle, cta_label, cta_type, cta_value, challenge_id, theme, ends_at")
        .order("sort");
      if (!alive || error) return;
      const list = ((data as unknown as Campaign[]) ?? []).filter((c) => new Date(c.ends_at).getTime() > Date.now());
      setItems(list);
      const ids = list.map((c) => c.challenge_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: ch } = await sb.from("challenges" as never).select("id, title, goal_days, ends_on, prize_text").in("id", ids);
        if (alive) setChallenges(Object.fromEntries(((ch as unknown as Challenge[]) ?? []).map((c) => [c.id, c])));
        for (const id of ids) void loadBoard(id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadBoard]);

  if (profile?.role !== "student" || items.length === 0) return null;

  const act = async (c: Campaign) => {
    if (c.cta_type === "challenge" && c.challenge_id) {
      if (boards[c.challenge_id]?.joined) return setRanking(c.challenge_id);
      setBusy(c.id);
      const { data, error } = await supabaseBrowser().rpc("join_challenge" as never, { p_challenge: c.challenge_id } as never);
      setBusy(null);
      if (error) {
        logger.error("challenge.join", error);
        return toast.error("Não foi possível entrar agora.");
      }
      const r = data as unknown as { ok: boolean; reason?: string };
      if (r.ok || r.reason === "ja_participa") {
        toast.success("Você está no desafio! 🔥 Cada dia de treino conta.");
        await loadBoard(c.challenge_id);
        setRanking(c.challenge_id);
      } else toast.message(r.reason === "encerrado" ? "Esse desafio já terminou." : "Desafio indisponível.");
      return;
    }
    if (c.cta_type === "personal") return setCoach(true);
    if (c.cta_type === "whatsapp_gym" && GYM_WHATSAPP) {
      window.open(`https://wa.me/${GYM_WHATSAPP}?text=${encodeURIComponent(c.cta_value ?? c.title)}`, "_blank", "noopener");
      return;
    }
    if (c.cta_type === "link" && c.cta_value) window.location.href = c.cta_value;
  };

  const rankingBoard = ranking ? boards[ranking] : null;
  const rankingChallenge = ranking ? challenges[ranking] : null;

  return (
    <div className="space-y-3">
      {items.map((c) => {
        const t = THEME[c.theme] ?? THEME.brand;
        const board = c.challenge_id ? boards[c.challenge_id] : null;
        const ch = c.challenge_id ? challenges[c.challenge_id] : null;
        const mine = board?.rows.find((r) => r.me);
        const pct = ch && mine ? Math.min(100, Math.round((mine.days / ch.goal_days) * 100)) : 0;
        return (
          <article key={c.id} className={cn("gf-rise overflow-hidden rounded-2xl border p-4", t.box)}>
            <div className="flex items-center justify-between gap-2">
              {c.badge ? (
                <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider", t.badge)}>{c.badge}</span>
              ) : <span />}
              <span className="flex items-center gap-1 text-[11px] font-bold text-white/80">
                <Timer className="h-3.5 w-3.5" /> {timeLeft(c.ends_at)}
              </span>
            </div>
            <h3 className="mt-2 text-[18px] font-black leading-tight text-white">{c.title}</h3>
            {c.subtitle ? <p className="mt-1 text-[12.5px] leading-snug text-white/75">{c.subtitle}</p> : null}

            {board ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {board.rows.slice(0, 5).map((r) => (
                      <Avatar key={r.id} className="h-7 w-7 border-2 border-black/40">
                        {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                        <AvatarFallback className="bg-white/15 text-[10px] font-black text-white">{r.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold text-white/80">
                    <Users className="h-3.5 w-3.5" />
                    {board.participants === 0 ? "Seja o primeiro a entrar" : `${board.participants} no desafio`}
                  </span>
                </div>
                {board.joined && ch && mine ? (
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-white/85">
                      <span><Flame className="mr-1 inline h-3.5 w-3.5 text-[#FFC24D]" />{mine.days} de {ch.goal_days} dias</span>
                      <span>{mine.rank}º lugar</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-[#FFC24D] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void act(c)}
              disabled={busy === c.id}
              className={cn("tactile mt-3 w-full rounded-xl py-3 text-[14px] font-black disabled:opacity-60", t.cta)}
            >
              {busy === c.id ? "Entrando…" : board?.joined ? "Ver ranking" : c.cta_label ?? "Quero"}
            </button>
          </article>
        );
      })}

      <BottomSheet open={ranking !== null} onClose={() => setRanking(null)}>
        {rankingBoard && rankingChallenge ? (
          <div className="max-h-[75dvh] space-y-3 overflow-y-auto p-1 pb-4">
            <h2 className="pr-10 text-lg font-black text-foreground">{rankingChallenge.title}</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Meta: {rankingChallenge.goal_days} dias de treino até{" "}
              {new Date(`${rankingChallenge.ends_on}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}.
              Conta treino registrado ou check-in, um por dia. Dê força para a galera: eles recebem um aviso 💪
            </p>
            {rankingChallenge.prize_text ? (
              <p className="flex items-start gap-1.5 rounded-xl border border-[#FFC24D]/40 bg-[#FFC24D]/10 p-3 text-[12.5px] font-semibold text-foreground">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC24D]" /> {rankingChallenge.prize_text}
              </p>
            ) : null}
            <ol className="space-y-1.5">
              {rankingBoard.rows.map((r) => (
                <li key={r.id} className={cn("flex items-center gap-3 rounded-xl border p-2.5", r.me ? "border-brand/60 bg-brand/10" : "border-border")}>
                  <span className={cn("w-7 text-center text-[13px] font-black", r.rank <= 3 ? "text-[#FFC24D]" : "text-muted-foreground")}>{r.rank}º</span>
                  <Avatar className="h-8 w-8">
                    {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                    <AvatarFallback className="bg-white/10 text-[11px] font-black">{r.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{r.me ? `${r.name} (você)` : r.name}</span>
                  <span className="text-[12.5px] font-black text-foreground">{r.days} {r.days === 1 ? "dia" : "dias"}</span>
                  {!r.me && rankingBoard.joined ? (
                    <button
                      type="button"
                      onClick={() => void cheer(ranking!, r)}
                      disabled={cheered.has(r.id)}
                      aria-label={`Dar força para ${r.name}`}
                      className="tactile flex shrink-0 items-center gap-1 rounded-full border border-[#FFC24D]/50 px-2 py-1 text-[10.5px] font-black text-[#FFC24D] disabled:opacity-40"
                    >
                      <HandHeart className="h-3.5 w-3.5" /> {cheered.has(r.id) ? "Feito" : "Força"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={coach} onClose={() => setCoach(false)}>
        {coach ? (
          <PersonalChooser
            studentName={profile?.name ?? ""}
            goal={(profile as { objetivo?: string | null } | null)?.objetivo ?? profile?.goal ?? null}
            onSent={() => {}}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}
