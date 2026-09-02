/**
 * Fila de Hoje do personal: ações concretas derivadas do estado real,
 * cada uma com execução imediata (abrir aprovações, WhatsApp, ajustar
 * treino, validar no ranking). Em produção as fontes são as mesmas
 * tabelas (approvals, workout_logs, checkins) — as regras não mudam.
 */

import type { PersonalStudent } from "~/lib/personal-data";

export type QueueItemTone = "red" | "amber" | "green";

export type QueueAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "whatsapp"; label: string; phone: string; text: string }
  | { kind: "student"; label: string; studentId: string };

export type QueueItem = {
  id: string;
  tone: QueueItemTone;
  text: string;
  detail: string;
  action: QueueAction;
};

/** wa.me com o número salvo no perfil (55 + DDD + número). */
function wa(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Monta a fila priorizada (vermelho → amarelo → verde), no máximo 7 itens.
 * Um aluno só entra uma vez na fila (o alerta mais grave dele).
 */
export function computeQueue(
  students: PersonalStudent[],
  approvalsPending: number,
  assignedTodayStudentIds: Set<string>,
): QueueItem[] {
  const items: QueueItem[] = [];

  // 1. Aprovações: primeiro da fila, resolve em 2 toques
  if (approvalsPending > 0) {
    items.push({
      id: "queue-approvals",
      tone: "amber",
      text:
        approvalsPending === 1
          ? "1 solicitação de aluno esperando sua decisão"
          : `${approvalsPending} solicitações de alunos esperando sua decisão`,
      detail: "Desbloqueio premium ou ajuste de carga.",
      action: { kind: "link", label: "Ver agora", href: "/personal/aprovacoes" },
    });
  }

  // 2. Alunos: o alerta mais grave de cada um
  for (const st of students) {
    const first = st.name.split(" ")[0];
    const waNumber = wa(st.phone);

    if (st.lastTrainingDaysAgo >= 3) {
      if (assignedTodayStudentIds.has(st.id)) {
        items.push({
          id: `queue-new-${st.id}`,
          tone: "green",
          text: `${first} recebeu um plano novo hoje`,
          detail: "Cobre a execução do primeiro treino do plano.",
          action: waNumber && st.whatsapp_consent
            ? {
                kind: "whatsapp",
                label: "Cobrar execução",
                phone: waNumber,
                text: `Oi ${first}! Seu plano novo já está no app. Bora estrear hoje?`,
              }
            : { kind: "student", label: "Ver ficha", studentId: st.id },
        });
      } else {
        items.push({
          id: `queue-red-${st.id}`,
          tone: "red",
          text: `${first} está há ${st.lastTrainingDaysAgo} dias sem treinar`,
          detail: "Maior risco de evasão da turma. Chame hoje, antes que esfrie.",
          action: waNumber && st.whatsapp_consent
            ? {
                kind: "whatsapp",
                label: "WhatsApp",
                phone: waNumber,
                text: `Oi ${first}! Sentimos sua falta na academia. Que tal voltarmos hoje com um treino leve? Seu Personal está de olho!`,
              }
            : { kind: "student", label: "Ver ficha", studentId: st.id },
        });
      }
      continue;
    }

    if ((st.lastRpe ?? 0) >= 9) {
      items.push({
        id: `queue-yellow-${st.id}`,
        tone: "amber",
        text: `${first} registrou RPE ${st.lastRpe} no último treino`,
        detail: "Fadiga no limite. Reduza a carga ou troque o foco do dia.",
        action: { kind: "link", label: "Ajustar Treino", href: `/personal/treinos?aluno=${st.id}` },
      });
      continue;
    }

    if (st.streak >= 5 && st.lastTrainingDaysAgo === 0) {
      items.push({
        id: `queue-green-${st.id}`,
        tone: "green",
        text: `${first} completou ${st.streak} dias de consistência`,
        detail: "Momento de reconhecer e validar a evolução no ranking.",
        action: waNumber && st.whatsapp_consent
          ? {
              kind: "whatsapp",
              label: "Dar Parabéns",
              phone: waNumber,
              text: `Parabéns ${first}! ${st.streak} dias de consistência é disciplina de verdade. Rumo ao próximo degrau!`,
            }
          : { kind: "link", label: "Validar no Ranking", href: "/personal/ranking" },
      });
    }
  }

  // 3. Fecho: conquistas a validar
  items.push({
    id: "queue-ranking",
    tone: "green",
    text: "Conquistas da semana esperando validação",
    detail: "Confirme RP e metas batidas pra pontuação cair no ranking.",
    action: { kind: "link", label: "Abrir Ranking", href: "/personal/ranking" },
  });

  const order: Record<QueueItemTone, number> = { red: 0, amber: 1, green: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 7);
}
