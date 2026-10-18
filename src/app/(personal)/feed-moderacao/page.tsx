"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatRelative } from "~/lib/utils/format";
import { toast } from "sonner";
import type { FeedPosts, Profiles } from "~/lib/types/models";

type PostRow = FeedPosts & { author: Profiles | null; likes: number; comments: number };

const PAGE_SIZE = 30;

const TYPE_LABEL: Record<string, string> = {
  geral: "Geral",
  conquista: "Conquista",
  comunicado: "Comunicado",
  desafio: "Desafio",
};

/**
 * Moderação do feed (gestor): visualiza posts recentes, pode remover.
 * Report/flag automático é futuro, aqui o gestor decide por análise.
 */
export default function ModerationPage() {
  const { profile } = useAuth();
  const [extra, setExtra] = useState<PostRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (
    offset: number,
    limit: number
  ): Promise<{ data: { items: PostRow[]; total: number } | null; error: { message: string } | null }> => {
    const supabase = supabaseBrowser();
    if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

    const pRes = await supabase
      .from("feed_posts")
      .select("*", { count: "exact" })
      .eq("gym_id", profile.gym_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (pRes.error) return { data: null, error: pRes.error };

    const posts = (pRes.data ?? []) as FeedPosts[];
    const ids = [...new Set(posts.map((p) => p.author_id))];
    let authors: Profiles[] = [];
    if (ids.length) {
      const aRes = await supabase.from("profiles").select("id, name, role").in("id", ids);
      if (!aRes.error) authors = (aRes.data ?? []) as Profiles[];
    }

    // Contagens POR POST (group by post_id), não o total da lista
    const postIds = posts.map((p) => p.id);
    const likesByPost = new Map<string, number>();
    const commentsByPost = new Map<string, number>();
    if (postIds.length) {
      const lRes = await supabase.from("feed_likes").select("post_id").in("post_id", postIds);
      const cRes = await supabase.from("feed_comments").select("post_id").in("post_id", postIds);
      for (const r of (lRes.data ?? []) as Array<{ post_id: string }>) {
        likesByPost.set(r.post_id, (likesByPost.get(r.post_id) ?? 0) + 1);
      }
      for (const r of (cRes.data ?? []) as Array<{ post_id: string }>) {
        commentsByPost.set(r.post_id, (commentsByPost.get(r.post_id) ?? 0) + 1);
      }
    }

    return {
      data: {
        items: posts.map((p) => ({
          ...p,
          author: authors.find((a) => a.id === p.author_id) ?? null,
          likes: likesByPost.get(p.id) ?? 0,
          comments: commentsByPost.get(p.id) ?? 0,
        })),
        total: pRes.count ?? offset + posts.length,
      },
      error: null,
    };
  };

  const { data, loading, error, refetch } = useAsyncQuery(
    (): Promise<{ data: { items: PostRow[]; total: number } | null; error: { message: string } | null }> => fetchPage(0, PAGE_SIZE),
    [profile?.id]
  );

  // Refetch substitui a primeira página: o que tinha sido carregado "a mais" some junto.
  useEffect(() => { setExtra([]); }, [data]);

  const rows = [...(data?.items ?? []), ...extra];
  const total = data?.total ?? rows.length;

  const loadMore = async () => {
    if (loadingMore || !data) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(rows.length, PAGE_SIZE);
      if (page.error) throw new Error(page.error.message);
      const items = page.data?.items ?? [];
      setExtra((prev) => {
        const seen = new Set([...data.items, ...prev].map((r) => r.id));
        return [...prev, ...items.filter((r) => !seen.has(r.id))];
      });
    } catch (e) {
      toast.error("Não deu carregar mais publicações agora.", {
        description: e instanceof Error ? e.message.slice(0, 80) : undefined,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (postId: string) => {
    if (!window.confirm("Remover esta publicação do feed? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabaseBrowser().from("feed_posts").delete().eq("id", postId);
    if (error) {
      toast.error("Falha ao remover", { description: error.message });
      return;
    }
    toast.success("Publicação removida");
    refetch();
  };

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Moderação do feed</h1>
            <p className="text-xs text-muted-foreground">
              {rows.length === total ? `${total} publicações recentes` : `${rows.length} de ${total} publicações recentes`}
            </p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma publicação para moderar"
            description="Posts do feed aparecem aqui para revisão."
            icon={ShieldAlert}
          />
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                      {(p.author?.name?.[0] ?? "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.author?.name ?? "Membro"}
                      <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{p.author?.role}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {TYPE_LABEL[p.type] ?? "Geral"} · {formatRelative(p.created_at)} · {p.likes} curtidas · {p.comments} comentários
                    </p>
                  </div>
                  <Badge variant={p.is_pinned ? "default" : "outline"}>{p.is_pinned ? "Fixado" : "Normal"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{p.body}</p>
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                  <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => remove(p.id)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remover
                  </Button>
                </div>
              </div>
            ))}
            {total > rows.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Carregando..." : `Carregar mais (restam ${total - rows.length})`}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
