/**
 * Canais Realtime do Supabase por tabela.
 * Formato: nome do canal + tabela + filtro (sempre por gym_id).
 */
export const REALTIME_CHANNELS = {
  equipmentStatus: (gymId: string) => `equipment-${gymId}`,
  onlineCount: (gymId: string) => `online-${gymId}`,
  feed: (gymId: string) => `feed-${gymId}`,
  notifications: (userId: string) => `notifications-${userId}`,
  squad: (squadId: string) => `squad-${squadId}`,
} as const;

export const REALTIME_EVENTS = {
  checkout: "postgres_changes",
  presence: "presence",
} as const;

/** Filtro Postgres para o evento de postgres_changes (sempre multi-tenant). */
export function gymFilter(gymId: string) {
  return {
    event: "*" as const,
    schema: "public",
    table: "equipment_sessions",
    filter: `gym_id=eq.${gymId}`,
  };
}