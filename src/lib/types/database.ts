import type {
  Achievements,
  AiGenerationLogs,
  BodyMetrics,
  Checkins,
  DayPasses,
  Equipment,
  EquipmentMaintenanceLogs,
  EquipmentSessions,
  EquipmentVariations,
  Exercises,
  FeedComments,
  FeedLikes,
  FeedPosts,
  Gyms,
  Leaderboard,
  MedicalClearances,
  NotificationSettings,
  Notifications,
  PremiumRequests,
  Profiles,
  SquadMembers,
  SquadMessages,
  Squads,
  StudentAchievements,
  StudentSubscriptions,
  StudentTrainers,
  StudentWorkouts,
  WorkoutDays,
  WorkoutExercises,
  WorkoutLogs,
  WorkoutPrograms,
} from "./models";

/**
 * Shape do banco utilizado pelos clientes tipados do Supabase.
 * Os nomes seguem as tabelas do schema (supabase/migrations/001_initial_schema.sql).
 *
 * ATENÇÃO: para gerar tipos exatos do banco, rode `supabase gen types typescript`
 * apontando para o projeto. Este arquivo manual é o contrato de domínio usado
 * enquanto o banco não está conectado, a estrutura espelha o schema SQL.
 */
export interface Database {
  public: {
    Tables: {
      gyms: RowTables<Gyms>;
      profiles: RowTables<Profiles>;
      student_subscriptions: RowTables<StudentSubscriptions>;
      checkins: RowTables<Checkins>;
      day_passes: RowTables<DayPasses>;
      equipment: RowTables<Equipment>;
      equipment_variations: RowTables<EquipmentVariations>;
      equipment_sessions: RowTables<EquipmentSessions>;
      equipment_maintenance_logs: RowTables<EquipmentMaintenanceLogs>;
      exercises: RowTables<Exercises>;
      workout_programs: RowTables<WorkoutPrograms>;
      workout_days: RowTables<WorkoutDays>;
      workout_exercises: RowTables<WorkoutExercises>;
      student_workouts: RowTables<StudentWorkouts>;
      workout_logs: RowTables<WorkoutLogs>;
      body_metrics: RowTables<BodyMetrics>;
      feed_posts: RowTables<FeedPosts>;
      feed_likes: RowTables<FeedLikes>;
      feed_comments: RowTables<FeedComments>;
      squads: RowTables<Squads>;
      squad_members: RowTables<SquadMembers>;
      squad_messages: RowTables<SquadMessages>;
      achievements: RowTables<Achievements>;
      student_achievements: RowTables<StudentAchievements>;
      leaderboard: RowTables<Leaderboard>;
      notifications: RowTables<Notifications>;
      notification_settings: RowTables<NotificationSettings>;
      ai_generation_logs: RowTables<AiGenerationLogs>;
      premium_requests: RowTables<PremiumRequests>;
      medical_clearances: RowTables<MedicalClearances>;
      student_trainers: RowTables<StudentTrainers>;
    };
    Views: Record<string, never>;
    Functions: {
      purchase_day_pass: {
        Args: {
          p_gym_slug: string;
          p_name: string;
          p_email?: string | null;
          p_phone?: string | null;
        };
        Returns: Array<{ id: string; code: string; expires_at: string }>;
      };
      my_day_passes: {
        Args: { p_codes: string[] };
        Returns: DayPasses[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type RowTables<T> = {
  Row: T;
  Insert: T;
  Update: Partial<T>;
  Relationships: [];
};