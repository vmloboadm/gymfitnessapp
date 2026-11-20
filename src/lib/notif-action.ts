/**
 * Ação explícita de cada aviso do sininho: o aluno vê o que fazer e para onde vai.
 * Puro (sem rede), testado em tests/unit.
 */
export type NotifAction = { label: string; href: string };

const RULES: Array<{ test: RegExp; action: NotifAction }> = [
  { test: /^(Novo treino liberado|Novo treino disponível)/, action: { label: "Ver meu treino", href: "/treino?start=1" } },
  { test: /^(Sequência|Meta da semana)/, action: { label: "Fazer check-in", href: "/checkin" } },
  { test: /^Você ganhou pontos/, action: { label: "Ver ranking", href: "/ranking" } },
  { test: /^(Curtiram|Comentaram) sua publicação/, action: { label: "Ver publicação", href: "/feed" } },
  { test: /^(Conquista liberada|2 conquistas liberadas)/, action: { label: "Ver conquista", href: "/conquistas" } },
  { test: /^(Força no desafio|Você está no)/, action: { label: "Ver desafio", href: "/ranking" } },
  { test: /^Novo recorde/, action: { label: "Ver progresso", href: "/progresso" } },
];

/** Sem regra específica, usa o destino padrão da tela (fallbackHref) e um rótulo genérico. */
export function actionFor(title: string, fallbackHref: string): NotifAction {
  for (const r of RULES) if (r.test.test(title)) return r.action;
  return { label: "Abrir", href: fallbackHref };
}
