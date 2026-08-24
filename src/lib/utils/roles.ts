export type Role = "student" | "trainer" | "manager" | "admin";

export const ROLE_ORDER: Role[] = ["student", "trainer", "manager", "admin"];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Aluno",
  trainer: "Personal",
  manager: "Gestor",
  admin: "Admin",
};

/** Grupo de layout do App Router para cada role. */
export const ROLE_GROUP: Record<Role, string> = {
  student: "(app)",
  trainer: "(trainer)",
  manager: "(admin)",
  admin: "(admin)",
};

/** Home path por role, usado no middleware p/ redirect pós-login. */
export const ROLE_HOME: Record<Role, string> = {
  student: "/treino",
  trainer: "/alunos",
  manager: "/dashboard",
  admin: "/dashboard",
};

export function hasRole(current: Role | null | undefined, required: Role): boolean {
  if (!current) return false;
  return ROLE_ORDER.indexOf(current) >= ROLE_ORDER.indexOf(required);
}