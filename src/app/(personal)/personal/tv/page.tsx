"use client";

import { useEffect, useState } from "react";
import { Tv, Plus, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList } from "~/components/common/AsyncStates";
import { cn } from "~/lib/utils";

type TvRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  duration_sec: number;
  ord: number;
  active: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  sponsor: "Parceiro",
  tip: "Dica",
  ranking: "Ranking",
  promo: "Promoção",
  motivation: "Motivação",
};

/**
 * Gerenciamento da TV da academia (personal/manager).
 * Lista slides, ativa/desativa, cria novos e exclui.
 * Preview abre /tv em nova aba.
 */
export default function PersonalTvPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<TvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("motivation");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("tv_content")
        .select("id, type, title, body, duration_sec, ord, active")
        .eq("gym_id", profile.gym_id)
        .order("ord", { ascending: true });
      if (error) throw new Error(error.message);
      setRows((data ?? []) as TvRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu carregar a TV.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.gym_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (row: TvRow) => {
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from("tv_content").update({ active: !row.active } as never).eq("id", row.id);
      if (error) throw new Error(error.message);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu atualizar.");
    }
  };

  const remove = async (row: TvRow) => {
    if (!confirm(`Excluir "${row.title}" da TV?`)) return;
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from("tv_content").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      toast.success("Slide excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu excluir.");
    }
  };

  const create = async () => {
    if (!title.trim() || !profile?.gym_id || saving) return;
    setSaving(true);
    try {
      const sb = supabaseBrowser();
      const maxOrd = rows.reduce((m, r) => Math.max(m, r.ord), 0);
      const { data, error } = await sb
        .from("tv_content")
        .insert({
          gym_id: profile.gym_id,
          type,
          title: title.trim().slice(0, 80),
          body: body.trim().slice(0, 220) || null,
          duration_sec: 20,
          ord: maxOrd + 1,
          active: true,
        } as never)
        .select("id, type, title, body, duration_sec, ord, active")
        .single();
      if (error) throw new Error(error.message);
      setRows((rs) => [...rs, data as TvRow]);
      setTitle("");
      setBody("");
      toast.success("Slide adicionado à TV!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="TV da academia" subtitle="Slides exibidos na TV do salão" />
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <Link
          href="/tv"
          target="_blank"
          className="tactile flex items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-brand/10 py-3 text-[13px] font-black text-brand"
        >
          <ExternalLink className="h-4 w-4" /> Abrir preview da TV
        </Link>

        {/* novo slide */}
        <div className="gf-card gf-glass !p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-black text-foreground">
            <Plus className="h-4 w-4 text-brand" /> Novo slide
          </p>
          <div className="flex gap-2">
            {(["motivation", "tip", "promo", "ranking", "sponsor"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "tactile rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                  type === t ? "bg-brand text-brand-foreground" : "bg-white/[0.06] text-muted-foreground"
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Título (ex. Promoção da semana)"
            aria-label="Título do slide"
            className="mt-2 h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 220))}
            placeholder="Texto (opcional)"
            rows={2}
            aria-label="Texto do slide"
            className="mt-2 w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.05] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
          <button
            onClick={create}
            disabled={saving || !title.trim()}
            className="tactile mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground disabled:opacity-40"
          >
            <Tv className="h-4 w-4" /> {saving ? "Salvando..." : "Adicionar à TV"}
          </button>
        </div>

        {/* lista */}
        {loading ? (
          <SkeletonList rows={3} />
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[11.5px] text-muted-foreground">
            Nenhum slide. Adicione o primeiro acima.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3",
                  !r.active && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{r.title}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[r.type] ?? r.type} · {r.duration_sec}s
                  </p>
                </div>
                <button onClick={() => toggle(r)} aria-label={r.active ? "Desativar" : "Ativar"}
                  className="tactile rounded-xl bg-white/[0.06] p-2 text-muted-foreground hover:text-foreground">
                  {r.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(r)} aria-label="Excluir"
                  className="tactile rounded-xl bg-white/[0.06] p-2 text-muted-foreground hover:text-[#F87171]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
