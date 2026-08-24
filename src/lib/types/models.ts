// Enums
export type Role = "admin" | "trainer" | "student" | "manager";
export type USER_STATUS = "active" | "inactive" | "pending_clearance" | "blocked";
export type SUBSCRIPTION_TYPE = "monthly" | "gympass" | "totalpass" | "quarterly";
export type SUBSCRIPTION_STATUS = "active" | "expired";
export type CHECKIN_TYPE = "qrcode" | "nfc" | "app";
export type DAY_PASS_STATUS = "active" | "expired";
export type EQUIPMENT_STATUS = "available" | "in_use" | "maintenance";
export type SESSION_STATUS = "active" | "completed";
export type SESSION_TYPE = "regular" | "super" | "bi" | "tri";
export type EXERCISE_CATEGORY = "cardio" | "strength" | "flexibility";
export type MUSCLE_GROUP = "chest" | "back" | "legs" | "arms" | "shoulders" | "abs";
export type TECHNIQUE_TYPE = "standard" | "advanced";
export type FC_POST_TYPE = "geral" | "conquista" | "comunicado" | "desafio";
export type AI_PURPOSE = "workout_plan" | "schedule" | "form" | "analysis";
export type REQUEST_STATUS = "pending" | "approved" | "rejected";
export type NOTIFICATION_CHANNEL = "push" | "email" | "sms";

// Models
export type Gyms = {
  id: string;
  created_at: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  status: "active" | "inactive";
};

export type Profiles = {
  id: string;
  gym_id: string;
  created_at: string;
  updated_at: string;
  role: Role;
  status: USER_STATUS;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  goal: string | null;
  medical_risk: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  lgpd_consent_at: string | null;
  daily_intake: string | null;
};

export type StudentSubscriptions = {
  id: string;
  gym_id: string;
  student_id: string;
  plan_name: string;
  type: SUBSCRIPTION_TYPE;
  status: SUBSCRIPTION_STATUS;
  price: number;
  starts_at: string;
  ends_at: string;
  payment_method: string | null;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
};

export type Checkins = {
  id: string;
  gym_id: string;
  student_id: string;
  type: CHECKIN_TYPE;
  source: "qrcode" | "nfc" | "app";
  checked_at: string;
};

export type DayPasses = {
  id: string;
  gym_id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: DAY_PASS_STATUS;
  created_at: string;
  expires_at: string;
};

export type Equipment = {
  id: string;
  gym_id: string;
  name: string;
  category: EXERCISE_CATEGORY;
  capacity: number;
  status: EQUIPMENT_STATUS;
  nfc_tag_url: string | null;
  qr_url: string | null;
  map_position: { x: number; y: number } | null;
  created_at: string;
  updated_at: string;
};

export type EquipmentVariations = {
  id: string;
  gym_id: string;
  equipment_id: string;
  exercise_id: string;
  name: string;
  default_sets: number | null;
  default_reps: number | null;
};

export type EquipmentSessions = {
  id: string;
  gym_id: string;
  equipment_id: string;
  variation_id: string | null;
  student_id: string;
  status: SESSION_STATUS;
  type: SESSION_TYPE;
  started_at: string;
  ended_at: string | null;
  meta: Record<string, unknown> | null;
};

export type EquipmentMaintenanceLogs = {
  id: string;
  gym_id: string;
  equipment_id: string;
  requested_by: string;
  reason: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

export type Exercises = {
  id: string;
  gym_id: string | null;
  name: string;
  category: EXERCISE_CATEGORY;
  muscles: MUSCLE_GROUP[];
  equipment_id: string | null;
  photo_url: string | null;
  /** Link de vídeo de execução (YouTube embed/watch). */
  video_url: string | null;
  tips: string[] | null;
  technique_default: TECHNIQUE_TYPE;
  high_impact: boolean;
  created_at: string;
};

export type WorkoutPrograms = {
  id: string;
  gym_id: string;
  trainer_id: string;
  name: string;
  objective: string | null;
  created_via: "manual" | "ia" | "foto" | "template";
  ai_model: string | null;
  ai_draft: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutDays = {
  id: string;
  gym_id: string;
  program_id: string;
  name: string;
  day_order: number;
};

export type WorkoutExercises = {
  id: string;
  gym_id: string;
  day_id: string;
  exercise_id: string;
  variation_id: string | null;
  sets: number;
  reps: string;
  rest_seconds: number;
  rpe: number | null;
  notes: string | null;
  technique: TECHNIQUE_TYPE;
  order: number;
};

export type StudentWorkouts = {
  id: string;
  gym_id: string;
  student_id: string;
  program_id: string;
  status: "active" | "paused" | "completed";
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type WorkoutLogs = {
  id: string;
  gym_id: string;
  student_id: string;
  workout_id: string | null;
  exercise_id: string;
  session_id: string | null;
  date: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  technique: TECHNIQUE_TYPE;
};

export type BodyMetrics = {
  id: string;
  gym_id: string;
  student_id: string;
  recorded_at: string;
  weight_kg: number | null;
  height_m: number | null;
  body_fat_pct: number | null;
  bmi: number | null;
  muscle_kg: number | null;
  waist_cm: number | null;
  source: "manual" | "bioimpedancia" | "doctor";
};

export type FeedPosts = {
  id: string;
  gym_id: string;
  author_id: string;
  type: FC_POST_TYPE;
  body: string;
  media_url: string | null;
  created_at: string;
  expires_at: string;
  is_pinned: boolean;
};

export type FeedLikes = {
  id: string;
  gym_id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export type FeedComments = {
  id: string;
  gym_id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type Squads = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  challenge_start: string | null;
  challenge_end: string | null;
  type: "desafio" | "grupo";
  created_at: string;
};

export type SquadMembers = {
  id: string;
  gym_id: string;
  squad_id: string;
  user_id: string;
  joined_at: string;
};

export type SquadMessages = {
  id: string;
  gym_id: string;
  squad_id: string;
  user_id: string;
  sender_type: Role;
  ai_embedding: boolean;
  body: string;
  created_at: string;
};

export type Achievements = {
  id: string;
  gym_id: string | null;
  code: string;
  name: string;
  description: string;
  badge_url: string | null;
  points: number;
};

export type StudentAchievements = {
  id: string;
  gym_id: string;
  student_id: string;
  achievement_id: string;
  earned_at: string;
};

export type Leaderboard = {
  id: string;
  gym_id: string;
  week_start: string;
  student_id: string;
  rank_type: "load" | "constancy";
  points: number;
  load_kg: number;
  sessions: number;
};

export type Notifications = {
  id: string;
  gym_id: string;
  user_id: string;
  channel: NOTIFICATION_CHANNEL;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationSettings = {
  id: string;
  gym_id: string;
  user_id: string;
  push_workouts: boolean;
  push_social: boolean;
  push_reminders: boolean;
  push_promotions: boolean;
};

export type AiGenerationLogs = {
  id: string;
  gym_id: string;
  user_id: string;
  purpose: AI_PURPOSE;
  created_via: "manual" | "ia" | "foto" | "template";
  ai_model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  estimated_cost: number | null;
  ai_draft: string | null;
  reviewed_by: string | null;
  used_sensitive_data: boolean;
  created_at: string;
};

export type PremiumRequests = {
  id: string;
  gym_id: string;
  student_id: string;
  request_type: "pdf" | "report" | "other";
  details: string | null;
  status: REQUEST_STATUS;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type MedicalClearances = {
  id: string;
  gym_id: string;
  student_id: string;
  document_url: string;
  approved: boolean;
  reviewed_by: string | null;
  created_at: string;
  approved_at: string | null;
};

export type StudentTrainers = {
  id: string;
  gym_id: string;
  student_id: string;
  trainer_id: string;
  assigned_at: string;
};