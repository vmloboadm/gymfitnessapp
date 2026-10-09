"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";
import type { Notifications } from "~/lib/types/models";

/**
 * Registra o Service Worker (PWA + push) uma única vez.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if ("serviceWorker" in navigator) {
    // basePath-aware: public/ é servido sob /app no deploy
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
      // SW indisponível (dev/sem https), não quebra o app
    });
  }
}

/** Central de notificações in-app (blueprint §5.4, canal por usuário). */
export function useNotifications(userId?: string) {
  const [items, setItems] = useState<Notifications[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabaseBrowser()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        setItems(data as Notifications[]);
        setUnread(data?.filter((n) => !n.read_at).length ?? 0);
        setLoading(false);
      });

    // Realtime canal por usuário
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notifications;
          setItems((prev) => [n, ...prev].slice(0, 30));
          setUnread((u) => u + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    await supabaseBrowser()
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  };

  const refetch = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabaseBrowser()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setError(error.message);
    } else {
      setItems((data ?? []) as Notifications[]);
      setUnread((data ?? []).filter((n) => !n.read_at).length ?? 0);
    }
    setLoading(false);
  };

  return { items, unread, loading, error, markAllRead, refetch };
}