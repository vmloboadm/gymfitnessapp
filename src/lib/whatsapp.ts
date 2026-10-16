/**
 * WhatsApp oficial da academia — número único vinculado ao app.
 * Fase 1 (atual): links manuais centralizados (suporte, parcerias).
 * Fase 2 (futura): Cloud API + fila de envios (ver docs/ROADMAP-WHATSAPP.md).
 * Fase 3 (futura): CRM.
 */

/** Número oficial com DDI+DDD, só dígitos. */
export const GYM_WHATSAPP = process.env.NEXT_PUBLIC_GYM_WHATSAPP ?? "";

/** Monta link wa.me com mensagem pré-preenchida. */
export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Normaliza telefone BR para wa.me: DDI 55 + DDD + número, sem duplicar.
 * Aceita "(22) 99800-9275", "22998009275" ou "5522998009275".
 * Devolve null quando não dá para montar um número válido (sem DDD etc.).
 */
export function normalizeBRPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) return `55${d}`;
  return null;
}

/** Link wa.me para aluno com mensagem pré-preenchida. Null se número inválido. */
export function waStudentLink(phone: string | null | undefined, text: string): string | null {
  const normalized = normalizeBRPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

/** Link de suporte: falar com a academia. */
export function gymSupportLink(context?: string): string {
  if (!GYM_WHATSAPP) return "";
  const msg = context
    ? `Olá! Sou aluno GymFitness e preciso de ajuda (${context}).`
    : "Olá! Sou aluno GymFitness e preciso de ajuda.";
  return waLink(GYM_WHATSAPP, msg);
}

/** Link de parcerias (usa o número oficial se o específico não existir). */
export function partnerLink(): string {
  const specific = process.env.NEXT_PUBLIC_PARTNER_WHATSAPP ?? "";
  const phone = specific || GYM_WHATSAPP;
  if (!phone) return "mailto:contato@gymfitnesscampos.com.br?subject=" + encodeURIComponent("Quero ser parceiro · GymFitness");
  return waLink(phone, "Olá! Vim pelo QR code da academia e quero saber mais sobre as parcerias do GymFitness.");
}

/** Resumo do plano para a mensagem de WhatsApp. */
export type PlanWhatsSummary = {
  nome: string;
  dias: Array<{ nome: string; exercicios: Array<{ exercicio: string; series: number; reps: string }> }>;
};

/**
 * Mensagem completa personal → aluno pronta para o WhatsApp: treino
 * liberado no app, pedido de check-in e o resumo dos dias/exercícios.
 */
export function buildPlanWhatsMessage(opts: {
  studentName: string;
  plan: PlanWhatsSummary;
}): string {
  const first = opts.studentName.split(" ")[0];
  const totalEx = opts.plan.dias.reduce((a, d) => a + d.exercicios.length, 0);
  const lines: string[] = [
    `Oi ${first}! Seu treino novo ja esta disponivel no app.`,
    "",
    `${opts.plan.nome} · ${opts.plan.dias.length} ${opts.plan.dias.length === 1 ? "dia" : "dias"} · ${totalEx} exercicios`,
  ];
  for (const d of opts.plan.dias) {
    lines.push("");
    lines.push(`*${d.nome}*`);
    d.exercicios.forEach((e, i) => lines.push(`${i + 1}. ${e.exercicio} · ${e.series}x${e.reps}`));
  }
  lines.push("");
  lines.push("Abra o app, faca o check-in na academia e bora treinar. Qualquer duvida me chama!");
  return lines.join("\n");
}

/** Mensagem curta pronta para ações rápidas do personal sobre um aluno. */
export function buildQuickMessage(kind: string, studentName: string): string {
  const first = studentName.split(" ")[0];
  switch (kind) {
    case "sumido":
      return `Oi ${first}! Sentindo sua falta por aqui. Bora retomar os treinos essa semana? Te espero!`;
    case "vencido":
      return `Oi ${first}! Sua matricula esta vencendo. Quer renovar para nao perder o ritmo dos treinos?`;
    case "cobrar":
      return `Oi ${first}! Ja fez o treino de hoje? Registra no app que eu vejo seu progresso. Bora!`;
    case "parabens":
      return `Parabens, ${first}! Vi sua constancia no app, seu esforco esta aparecendo. Continue assim!`;
    case "incentivo":
      return `Bora, ${first}! Cada treino conta. Hoje e um otimo dia para evoluir mais um pouco.`;
    case "avaliacao":
      return `Oi ${first}! Vamos marcar sua avaliacao fisica e atualizar seus treinos? Me diz o melhor horario.`;
    case "aniversario":
      return `Feliz aniversario, ${first}! Que seja um ano de muita saude e treinos. Comemore com a gente!`;
    default:
      return `Oi ${first}! Tudo bem? Vamos falar sobre seus treinos?`;
  }
}

