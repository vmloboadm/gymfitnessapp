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

/**
 * Realtime para a frase motivacional da academia:
 * staff edita no perfil, todos os alunos veem na hora.
 */
export function useGymMotivationRealtime(
  gymId: string | undefined,
  onRefetch: () => void
) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`motivation-${gymId}`, { table: "gym_motivation", gymId }, handlerRef);
}

/**
 * Realtime para checkins: entrada/saída de alunos atualiza o dashboard
 * (presentes agora, ocupação por hora) ao vivo.
 */
export function useCheckinsRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`checkins-${gymId}`, { table: "checkins", gymId }, handlerRef);
}

/**
 * Realtime para equipment_sessions: aluno abre/fecha sessão em aparelho
 * → dashboard e lista "em uso agora" atualizam sem refresh.
 */
export function useEquipmentSessionsRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`equipment-sessions-${gymId}`, { table: "equipment_sessions", gymId }, handlerRef);
}

/**
 * Realtime para workout_sessions: aluno inicia/encerra o treino
 * → dashboard do personal mostra "em treino" ao vivo.
 */
export function useWorkoutSessionsRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`workout-sessions-${gymId}`, { table: "workout_sessions", gymId }, handlerRef);
}

/**
 * Realtime para student_workouts: quando o personal atribui um treino,
 * o aluno vê o plano na página de treinos sem precisar recarregar.
 */
export function useStudentWorkoutsRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`student-workouts-${gymId}`, { table: "student_workouts", gymId }, handlerRef);
}

/**
 * Realtime para leaderboard_adjustments: ajustes de pontos pelo gestor
 * → ranking do aluno atualiza ao vivo.
 */
export function useLeaderboardRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`leaderboard-${gymId}`, { table: "leaderboard_adjustments", gymId }, handlerRef);
}

/**
 * Realtime para profiles: quando o aluno ou personal muda avatar/nome,
 * todas as listas e cards se atualizam (dashboard, feed, ranking).
 */
export function useProfilesRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`profiles-${gymId}`, { table: "profiles", gymId }, handlerRef);
}

/**
 * Realtime para medical_clearances: aluno envia laudo médico
 * → gestor vê na fila de pendências sem refresh.
 */
export function useMedicalClearancesRealtime(gymId: string | undefined, onRefetch: () => void) {
  const handlerRef = useCallback(() => {
    if (!gymId) return;
    onRefetch();
  }, [gymId, onRefetch]);

  useRealtime(`medical-clearances-${gymId}`, { table: "medical_clearances", gymId }, handlerRef);
}
