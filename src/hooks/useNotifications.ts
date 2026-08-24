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
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW indisponível (dev/sem https) — não quebra o app
    });
  }
}

/** Central de notificações in-app (blueprint §5.4 — canal por usuário). */
export function useNotifications(userId?: string) {
  const [items, setItems] = useState<Notifications[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabaseBrowser()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled || error) return;
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
    await supabaseBrowser()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setUnread(0);
  };

  return { items, unread, loading, markAllRead };
}