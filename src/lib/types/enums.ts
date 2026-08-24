export const GYM_STATUS = ["active", "inactive"] as const;

export const USER_STATUS = ["active", "blocked", "pending_clearance"] as const;

export const SUBSCRIPTION_TYPE = ["monthly", "gympass", "totalpass"] as const;

export const SUBSCRIPTION_STATUS = ["active", "expired", "blocked", "cancelled"] as const;

export const EXERCISE_CATEGORY = [
  "peito",
  "costas",
  "ombro",
  "biceps",
  "triceps",
  "perna",
  "gluteo",
  "core",
  "cardio",
  "panturrilha",
] as const;

export const EQUIPMENT_STATUS = ["available", "in_use", "maintenance"] as const;

export const SESSION_STATUS = ["active", "completed"] as const;

export const SESSION_TYPE = ["regular", "biset", "triset"] as const;

export const FC_POST_TYPE = ["geral", "conquista", "comunicado", "desafio"] as const;

export const REQUEST_STATUS = ["pending", "approved", "rejected"] as const;

export const DAY_PASS_STATUS = ["active", "expired", "used"] as const;

export const MUSCLE_GROUP = [
  "peito",
  "costas",
  "ombro",
  "braco",
  "perna",
  "core",
  "gluteo",
  "panturrilha",
] as const;

export const TECHNIQUE_TYPE = ["normal", "dropset", "biset", "triset"] as const;

export const CHECKIN_TYPE = ["entrada", "saida"] as const;

export const NOTIFICATION_CHANNEL = ["in_app", "push", "email"] as const;

export const AI_PURPOSE = [
  "generate_workout",
  "parse_ficha",
  "edit_template",
  "plato_detection",
  "insight_student",
  "insight_trainer",
  "insight_manager",
  "register_student",
] as const;

export type GYM_STATUS = (typeof GYM_STATUS)[number];
export type USER_STATUS = (typeof USER_STATUS)[number];
export type SUBSCRIPTION_TYPE = (typeof SUBSCRIPTION_TYPE)[number];
export type SUBSCRIPTION_STATUS = (typeof SUBSCRIPTION_STATUS)[number];
export type EXERCISE_CATEGORY = (typeof EXERCISE_CATEGORY)[number];
export type EQUIPMENT_STATUS = (typeof EQUIPMENT_STATUS)[number];
export type SESSION_STATUS = (typeof SESSION_STATUS)[number];
export type SESSION_TYPE = (typeof SESSION_TYPE)[number];
export type FC_POST_TYPE = (typeof FC_POST_TYPE)[number];
export type REQUEST_STATUS = (typeof REQUEST_STATUS)[number];
export type DAY_PASS_STATUS = (typeof DAY_PASS_STATUS)[number];
export type MUSCLE_GROUP = (typeof MUSCLE_GROUP)[number];
export type TECHNIQUE_TYPE = (typeof TECHNIQUE_TYPE)[number];
export type CHECKIN_TYPE = (typeof CHECKIN_TYPE)[number];
export type NOTIFICATION_CHANNEL = (typeof NOTIFICATION_CHANNEL)[number];
export type AI_PURPOSE = (typeof AI_PURPOSE)[number];