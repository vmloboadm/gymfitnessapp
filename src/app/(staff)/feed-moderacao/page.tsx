"use client";

import { ShieldAlert, Flag, Check, Trash2 } from "lucide-react";
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

/**
 * Moderação do feed (gestor): visualiza posts recentes, pode remover.
 * Report/flag automático é futuro, aqui o gestor decide por análise.
 */
export default function ModerationPage() {
  const { profile } = useAuth();

  const { data, loading, error, refetch } = useAsyncQuery<PostRow[]>(
    async () => {
      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const pRes = await supabase
        .from("feed_posts")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (pRes.error) return { data: null, error: pRes.error };

      const posts = (pRes.data ?? []) as FeedPosts[];
      const ids = [...new Set(posts.map((p) => p.author_id))];
      let authors: Profiles[] = [];
      if (ids.length) {
        const aRes = await supabase.from("profiles").select("id, name, role").in("id", ids);
        if (!aRes.error) authors = (aRes.data ?? []) as Profiles[];
      }

      const postIds = posts.map((p) => p.id);
      let likesCount = 0;
      let commentsCount = 0;
      if (postIds.length) {
        const lRes = await supabase.from("feed_likes").select("id").in("post_id", postIds);
        const cRes = await supabase.from("feed_comments").select("id").in("post_id", postIds);
        likesCount = lRes.data?.length ?? 0;
        commentsCount = cRes.data?.length ?? 0;
      }

      return {
        data: posts.map((p) => ({
          ...p,
          author: authors.find((a) => a.id === p.author_id) ?? null,
          likes: likesCount,
          comments: commentsCount,
        })),
        error: null,
      };
    },
    [profile?.id]
  );

  const remove = async (postId: string) => {
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
            <p className="text-xs text-muted-foreground">Publicações recentes do gym</p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.length === 0 ? (
          <EmptyState
            title="Nenhuma publicação para moderar"
            description="Posts do feed aparecem aqui para revisão."
            icon={ShieldAlert}
          />
        ) : (
          <div className="space-y-2">
            {data?.map((p) => (
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
                      {p.type} · {formatRelative(p.created_at)} · {p.likes} curtidas · {p.comments} comentários
                    </p>
                  </div>
                  <Badge variant={p.is_pinned ? "default" : "outline"}>{p.is_pinned ? "Fixado" : "Normal"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{p.body}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Flag className="h-3 w-3" />
                    Conteúdo avaliado
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs">
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
