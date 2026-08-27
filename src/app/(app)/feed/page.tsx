"use client";

import { useMemo, useState } from "react";
import { Plus, ThumbsUp, MessageSquare, Send, GraduationCap, Pin } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { formatRelative } from "~/lib/utils/format";
import { toast } from "sonner";
import { isDemoMode, demoFeedData, demoFallback } from "~/lib/demo-bridge";
import type { FeedComments, FeedLikes, FeedPosts, Profiles } from "~/lib/types/models";

const POST_TYPE_LABEL: Record<FeedPosts["type"], string> = {
  geral: "Geral",
  conquista: "Conquista",
  comunicado: "Comunicado",
  desafio: "Desafio",
};

type CommentRow = FeedComments & { user: Profiles | null };

type PostRow = FeedPosts & {
  author: Profiles | null;
  likesCount: number;
  likedByMe: boolean;
  comments: CommentRow[];
};

/**
 * Feed social do aluno (blueprint feed): posts do gym + curtir + comentar.
 * No modo demo as interações funcionam localmente (curtir/comentar/publicar).
 */
export default function FeedPage() {
  const { user, profile } = useAuth();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [postType, setPostType] = useState<"geral" | "conquista" | "desafio">("geral");

  // estado otimista do modo demo (sem backend)
  const [demoLikes, setDemoLikes] = useState<Record<string, boolean>>({});
  const [demoComments, setDemoComments] = useState<Record<string, CommentRow[]>>({});
  const [demoPosts, setDemoPosts] = useState<PostRow[]>([]);
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<PostRow[]>(
    async () => {
      if (demo) {
        const { posts, likes, comments } = demoFeedData();
        const profiles = demoFallback("profiles") as Profiles[];
        return {
          data: posts.map(
            (p: any): PostRow => ({
              ...p,
              author: profiles.find((x) => x.id === p.author_id) ?? null,
              likesCount: likes.filter((l: any) => l.post_id === p.id).length,
              likedByMe: false,
              comments: comments
                .filter((c: any) => c.post_id === p.id)
                .map((c: any) => ({ ...c, user: profiles.find((x) => x.id === c.user_id) ?? null }))
                .sort((a: CommentRow, b: CommentRow) => (a.created_at < b.created_at ? -1 : 1)),
            })
          ),
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const postsRes = await supabase
        .from("feed_posts")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (postsRes.error) return { data: null, error: postsRes.error };

      const posts = (postsRes.data ?? []) as FeedPosts[];
      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const postIds = posts.map((p) => p.id);
      let authors: Profiles[] = [];
      let likes: FeedLikes[] = [];
      let comments: FeedComments[] = [];

      if (authorIds.length) {
        const aRes = await supabase.from("profiles").select("id, name, avatar_url, role").in("id", authorIds);
        if (aRes.error) return { data: null, error: aRes.error };
        authors = (aRes.data ?? []) as Profiles[];
      }
      if (postIds.length) {
        const lRes = await supabase.from("feed_likes").select("*").in("post_id", postIds);
        if (lRes.error) return { data: null, error: lRes.error };
        likes = (lRes.data ?? []) as FeedLikes[];

        const cRes = await supabase.from("feed_comments").select("*").in("post_id", postIds).order("created_at", { ascending: true });
        if (!cRes.error) comments = (cRes.data ?? []) as FeedComments[];
      }

      const commenterIds = [...new Set(comments.map((c) => c.user_id))];
      if (commenterIds.length > authors.filter((a) => commenterIds.includes(a.id)).length) {
        const missing = commenterIds.filter((id) => !authors.some((a) => a.id === id));
        const mRes = await supabase.from("profiles").select("id, name, avatar_url, role").in("id", missing);
        if (!mRes.error) authors = [...authors, ...(mRes.data ?? []) as Profiles[]];
      }

      return {
        data: posts.map((p) => ({
          ...p,
          author: authors.find((a) => a.id === p.author_id) ?? null,
          likesCount: likes.filter((l) => l.post_id === p.id).length,
          likedByMe: likes.some((l) => l.post_id === p.id && l.user_id === user.id),
          comments: comments
            .filter((c) => c.post_id === p.id)
            .map((c) => ({ ...c, user: authors.find((a) => a.id === c.user_id) ?? null })),
        })),
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  // fixados primeiro, depois mais recentes; posts publicados no demo entram no topo
  const sorted = useMemo(() => {
    const all = [...demoPosts, ...(data ?? [])];
    return all.sort(
      (a, b) => Number(b.is_pinned) - Number(a.is_pinned) || (a.created_at < b.created_at ? 1 : -1)
    );
  }, [data, demoPosts]);

  const publishPost = async () => {
    if (!body.trim()) return;
    if (demo) {
      const newPost: PostRow = {
        id: `local-${Date.now()}`,
        gym_id: "1",
        author_id: user?.id ?? ME_DEMO,
        type: postType,
        body: body.trim(),
        media_url: null,
        created_at: new Date().toISOString(),
        expires_at: "",
        is_pinned: false,
        author: { id: user?.id ?? ME_DEMO, name: profile?.name ?? "Você", role: "student" } as Profiles,
        likesCount: 0,
        likedByMe: false,
        comments: [],
      };
      setDemoPosts((prev) => [newPost, ...prev]);
      setBody("");
      setPostType("geral");
      navigator.vibrate?.(30);
      toast.success("Publicado no feed");
      return;
    }
    if (!user || !profile) return;
    setPosting(true);
    const { error } = await supabaseBrowser()
      .from("feed_posts")
      .insert({
        gym_id: profile.gym_id,
        author_id: user.id,
        type: postType,
        body: body.trim(),
        is_pinned: false,
      } as never);
    setPosting(false);
    if (error) {
      toast.error("Falha ao publicar", { description: error.message });
      return;
    }
    setBody("");
    setPostType("geral");
    toast.success("Publicado no feed");
    refetch();
  };

  const toggleLike = async (post: PostRow) => {
    navigator.vibrate?.(20);
    if (demo) {
      setDemoLikes((prev) => ({ ...prev, [post.id]: !prev[post.id] }));
      return;
    }
    if (!user || !profile) return;
    const supabase = supabaseBrowser();
    if (post.likedByMe) {
      await supabase.from("feed_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("feed_likes").insert({ gym_id: profile.gym_id, post_id: post.id, user_id: user.id } as never);
    }
    refetch();
  };

  const addComment = async (postId: string) => {
    if (!commentDraft.trim()) return;
    if (demo) {
      const c: CommentRow = {
        id: `lc-${Date.now()}`,
        gym_id: "1",
        post_id: postId,
        user_id: user?.id ?? ME_DEMO,
        body: commentDraft.trim(),
        created_at: new Date().toISOString(),
        user: { id: user?.id ?? ME_DEMO, name: profile?.name ?? "Você", role: "student" } as Profiles,
      };
      setDemoComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), c] }));
      setCommentDraft("");
      setCommentingId(null);
      navigator.vibrate?.(25);
      toast.success("Comentário publicado");
      return;
    }
    if (!user || !profile) return;
    const { error } = await supabaseBrowser()
      .from("feed_comments")
      .insert({ gym_id: profile.gym_id, post_id: postId, user_id: user.id, body: commentDraft.trim() } as never);
    if (error) {
      toast.error("Falha ao comentar", { description: error.message });
      return;
    }
    setCommentDraft("");
    setCommentingId(null);
    refetch();
  };

  return (
    <>
      <TopBar title="Feed" subtitle="Comunidade do gym" />
      <div className="space-y-6 p-4">
        <div className="gf-rise gf-card gf-glass !py-4">
          <div className="mb-2 flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                {(profile?.name?.[0] ?? "V").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-[13px] font-semibold text-foreground">
              Compartilhe com a turma
            </p>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="O que está acontecendo no treino?"
            rows={2}
            className="resize-none"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {(["geral", "conquista", "desafio"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPostType(t)}
                  aria-pressed={postType === t}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors",
                    postType === t
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border bg-card/60 text-muted-foreground hover:border-brand hover:text-brand"
                  )}
                >
                  {POST_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={publishPost} disabled={!body.trim() || posting}>
              {posting ? <span className="h-4 w-4 animate-pulse rounded-full bg-white/40" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Publicar
            </Button>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : sorted.length === 0 ? (
          <EmptyState
            title="Nenhuma publicação"
            description="Seja a primeira pessoa a postar no feed da academia."
            icon={Plus}
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((post, i) => {
              const liked = post.likedByMe || !!demoLikes[post.id];
              const likes = post.likesCount + (demoLikes[post.id] ? 1 : 0);
              const comments = [...post.comments, ...(demoComments[post.id] ?? [])];
              return (
                <div
                  key={post.id}
                  className="gf-rise gf-card gf-glass !py-4"
                  style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
                >
                  {post.is_pinned ? (
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                      <Pin className="h-3 w-3" /> Fixado pela academia
                    </p>
                  ) : null}

                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={cn("text-xs font-black", post.author?.role === "trainer" || post.author?.role === "manager" ? "bg-gradient-to-br from-brand to-brand-dark text-brand-foreground" : "bg-secondary text-secondary-foreground")}>
                        {(post.author?.name?.[0] ?? "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {post.author?.name ?? "Membro"}
                        {post.author?.role === "trainer" || post.author?.role === "manager" ? (
                          <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", post.author.role === "trainer" ? "bg-brand/15 text-brand" : "bg-warning/15 text-warning")}>
                            {post.author.role === "trainer" ? "Personal" : "Gestão"}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {POST_TYPE_LABEL[post.type] ?? "Geral"} · {formatRelative(post.created_at)}
                      </p>
                    </div>
                    {post.type === "conquista" ? (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-success">
                        Conquista
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-foreground">{post.body}</p>

                  <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(liked ? "text-brand" : "text-muted-foreground")}
                      onClick={() => toggleLike(post)}
                      aria-pressed={liked}
                    >
                      <ThumbsUp className={cn("mr-1.5 h-3.5 w-3.5", liked && "fill-current")} />
                      {likes}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCommentingId(commentingId === post.id ? null : post.id)}>
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      {comments.length > 0 ? comments.length : "Comentar"}
                    </Button>
                    {post.type === "conquista" && post.author?.id === user?.id ? (
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                        <GraduationCap className="h-3.5 w-3.5 text-warning" />
                        Sua meta
                      </span>
                    ) : null}
                  </div>

                  {comments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {comments.slice(-3).map((c) => (
                        <div key={c.id} className="flex items-start gap-2 rounded-xl bg-card/40 px-3 py-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                            {(c.user?.name?.[0] ?? "?").toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-foreground">
                              {c.user?.name ?? "Membro"}
                              <span className="ml-1.5 font-normal text-muted-foreground">{formatRelative(c.created_at)}</span>
                            </p>
                            <p className="text-[12px] leading-snug text-muted-foreground">{c.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {commentingId === post.id ? (
                    <div className="mt-3 flex gap-2">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Escreva um comentário..."
                        rows={1}
                        className="min-h-[36px] resize-none text-sm"
                      />
                      <Button size="sm" onClick={() => addComment(post.id)} disabled={!commentDraft.trim()}>
                        Enviar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const ME_DEMO = "00000000-0000-0000-0000-000000000099";
