/**
 * Para onde leva e em que categoria cai cada aviso do sininho quando vira
 * push. Puro (sem rede) para ser testado em tests/unit.
 */

export type PushCategory = "social" | "workouts" | "reminders" | "promotions";

export type PushRoute = {
  category: PushCategory;
  /** caminho dentro do app (sem o /app) */
  path: string;
  /** agrupa avisos do mesmo tipo no celular (um substitui o outro) */
  tag: string;
};

const RULES: Array<{ test: RegExp; route: PushRoute }> = [
  { test: /^Curtiram sua publicação/, route: { category: "social", path: "/feed", tag: "feed-like" } },
  { test: /^Comentaram sua publicação/, route: { category: "social", path: "/feed", tag: "feed-comment" } },
  { test: /^Conquista liberada/, route: { category: "social", path: "/feed", tag: "achievement" } },
  { test: /^Novo recorde/, route: { category: "social", path: "/feed", tag: "record" } },
  { test: /^Recado da academia/, route: { category: "promotions", path: "/feed", tag: "broadcast" } },
  { test: /^Treino inicial aplicado/, route: { category: "workouts", path: "/personal/alunos", tag: "starter" } },
  { test: /^(Novo treino|Treino)/, route: { category: "workouts", path: "/treino", tag: "workout" } },
  { test: /^(Sequência|Meta da semana)/, route: { category: "workouts", path: "/progresso", tag: "streak" } },
  { test: /^Você ganhou pontos/, route: { category: "social", path: "/ranking", tag: "points" } },
];

export function routePush(title: string): PushRoute {
  for (const r of RULES) if (r.test.test(title)) return r.route;
  return { category: "reminders", path: "/notificacoes", tag: "geral" };
}

type Settings = Partial<Record<`push_${PushCategory}`, boolean | null>> | null | undefined;

/** Sem preferência gravada = pode mandar (padrão ligado). */
export function pushAllowed(category: PushCategory, settings: Settings): boolean {
  const v = settings?.[`push_${category}`];
  return v !== false;
}
