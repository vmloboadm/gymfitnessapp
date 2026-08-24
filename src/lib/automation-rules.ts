/**
 * INTERFACE das regras de automação de relacionamento (Fase B).
 * Nada roda ainda — estrutura pronta para plugar Evolution API / Resend
 * sem mexer nas telas. Credenciais ficarão em /configuracoes (gestor).
 */

export type AutomationKind =
  | "followup_48h" // aluno 2 dias sem treinar
  | "feedback_post" // pós-treino sem avaliação
  | "aniversario"
  | "resumo_semanal";

export type AutomationChannel = "whatsapp" | "email" | "inapp";

export type AutomationRule = {
  id: string;
  kind: AutomationKind;
  channel: AutomationChannel;
  enabled: boolean;
  /** Config livre por canal (ex: template da mensagem, horário de envio). */
  config?: Record<string, string>;
};

/** Regras padrão propostas — todas desligadas até credenciais configuradas. */
export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  { id: "r1", kind: "followup_48h", channel: "whatsapp", enabled: false, config: { mensagem: "Oi {nome}! Sentimos sua falta hoje. Bora amanhã? — GymFitness" } },
  { id: "r2", kind: "feedback_post", channel: "whatsapp", enabled: false, config: { mensagem: "Como foi o treino de hoje, {nome}? 0 a 10?" } },
  { id: "r3", kind: "aniversario", channel: "inapp", enabled: false },
  { id: "r4", kind: "resumo_semanal", channel: "email", enabled: false },
];
