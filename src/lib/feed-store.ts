/**
 * Persistência local do feed em modo demo (teste multiárea).
 * Posts, curtidas e comentários criados no demo ficam no localStorage e são
 * compartilhados entre aluno, personal e gestor no mesmo navegador — o feed
 * "persiste" entre as 3 áreas. Em produção esses dados moram no Supabase
 * (feed_posts / feed_likes / feed_comments) e este módulo não é usado.
 */

import type { Profiles } from "~/lib/types/models";

export type FeedCommentLocal = {
  id: string;
  gym_id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: Profiles;
};

export type FeedPostLocal = {
  id: string;
  gym_id: string;
  author_id: string;
  type: string;
  body: string;
  media_url: string | null;
  created_at: string;
  expires_at: string;
  is_pinned: boolean;
  author: Profiles;
  likesCount: number;
  likedByMe: boolean;
  comments: FeedCommentLocal[];
};

type FeedLocal = {
  posts: FeedPostLocal[];
  likes: Record<string, boolean>;
  comments: Record<string, FeedCommentLocal[]>;
};

const KEY = "gymfit_feed_local_v1";

function readStore(): FeedLocal {
  if (typeof window === "undefined") return { posts: [], likes: {}, comments: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { posts: [], likes: {}, comments: {} };
    const parsed = JSON.parse(raw) as Partial<FeedLocal>;
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      likes: parsed.likes ?? {},
      comments: parsed.comments ?? {},
    };
  } catch {
    return { posts: [], likes: {}, comments: {} };
  }
}

function writeStore(data: FeedLocal) {
  if (typeof window === "undefined") return;
  try {
    // mantém no máximo 50 posts locais para não estourar o localStorage
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...data, posts: data.posts.slice(0, 50) })
    );
    window.dispatchEvent(new Event("gymfit-feed-local"));
  } catch {
    // storage cheio ou indisponível: segue sem persistir
  }
}

export function feedLocalSnapshot(): FeedLocal {
  return readStore();
}

export function feedLocalAddPost(post: FeedPostLocal) {
  const data = readStore();
  writeStore({ ...data, posts: [post, ...data.posts] });
}

export function feedLocalToggleLike(postId: string) {
  const data = readStore();
  const likes = { ...data.likes, [postId]: !data.likes[postId] };
  const posts = data.posts.map((p) =>
    p.id === postId ? { ...p, likedByMe: likes[postId], likesCount: p.likesCount + (likes[postId] ? 1 : -1) } : p
  );
  writeStore({ posts, likes, comments: data.comments });
}

export function feedLocalAddComment(postId: string, comment: FeedCommentLocal) {
  const data = readStore();
  const comments = { ...data.comments, [postId]: [...(data.comments[postId] ?? []), comment] };
  const posts = data.posts.map((p) =>
    p.id === postId ? { ...p, comments: comments[postId] } : p
  );
  writeStore({ posts, likes: data.likes, comments });
}

export const FEED_LOCAL_EVENT = "gymfit-feed-local";
