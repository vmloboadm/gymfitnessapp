"use client";

import { useCallback } from "react";
import { useRealtime } from "~/hooks/useRealtime";

/**
 * Realtime para workout_logs: quando um aluno registra treino,
 * o home (streak/heatmap) e a lista de alunos do personal atualizam.
 * Usa o padrão re-query do useOnlineCount.
 */
export function useWorkoutLogsRealtime(
  gymId: string | undefined,
  userId: string | undefined,
  onRefetch: () => void
) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(
    `workout-logs-${gymId}`,
    { table: "workout_logs", gymId },
    handlerRef
  );
}

/**
 * Realtime para premium_requests: quando aluno solicita ou personal aprova,
 * ambas as partes veem a atualização em tempo real.
 */
export function usePremiumRequestsRealtime(
  gymId: string | undefined,
  onRefetch: () => void
) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(
    `premium-requests-${gymId}`,
    { table: "premium_requests", gymId },
    handlerRef
  );
}

/**
 * Realtime para feed: novos posts, likes e comentários aparecem live.
 */
export function useFeedRealtime(
  gymId: string | undefined,
  onRefetch: () => void
) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`feed-posts-${gymId}`, { table: "feed_posts", gymId }, handlerRef);
  useRealtime(`feed-likes-${gymId}`, { table: "feed_likes", gymId }, handlerRef);
  useRealtime(`feed-comments-${gymId}`, { table: "feed_comments", gymId }, handlerRef);
}
