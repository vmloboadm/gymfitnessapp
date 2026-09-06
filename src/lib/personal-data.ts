/**
 * Dados demo da área do Personal (radar de retenção, alunos, templates).
 * Em produção esses dados vêm do Supabase (workout_logs, checkins, profiles);
 * a estrutura já espelha o formato esperado das tabelas.
 */

export type RadarSeverity = "red" | "yellow" | "green";

export type RadarAlert = {
  id: string;
  severity: RadarSeverity;
  studentId: string;
  studentName: string;
  avatar: string | null;
  /** Frase principal do alerta */
  message: string;
  /** Contexto curto (último treino, RPE, marca) */
  detail: string;
  /** Ação de WhatsApp pré-preenchida (só com consentimento) */
  whatsapp?: { phone: string; consent: boolean; text: string; label?: string };
  /** Ação alternativa (ex: ajustar treino) */
  action?: { label: string; href: string };
};

export type PersonalStudent = {
  id: string;
  /** id na tabela profiles/leaderboard (liga o ranking aos alunos do personal) */
  profile_id?: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  /** Consentimento LGPD para contato via WhatsApp (onboarding) */
  whatsapp_consent: boolean;
  /** Dias desde o último treino (0 = treinou hoje) */
  lastTrainingDaysAgo: number;
  streak: number;
  activeWorkout: string | null;
  /** Último exercício registrado pelo aluno (para dar contexto na lista) */
  lastWorkout: string | null;
  /** Frequência semanal pactuada (agenda de hoje) */
  freq: number;
  /** Último RPE registrado, quando houver */
  lastRpe?: number;
  /** Dados de anamnese do onboarding (visíveis ao personal) */
  goal?: string | null;
  medical_risk?: boolean | null;
  medications?: string | null;
  surgery_history?: string | null;
  sex?: string | null;
  experience_level?: string | null;
  available_days?: string[] | null;
  emergency_contact?: { name: string; phone: string } | null;
  birth_date?: string | null;
  daily_intake?: string | null;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string;
  level: string;
  days: number;
  exercises: Array<{ name: string; sets: number; reps: string; rest: string }>;
};

/** Avatar: retorna null para usar AvatarFallback com iniciais (sem URLs externas). */
const AV = (_n: number) => null;

/**
 * Radar de retenção DINÂMICO: deriva os alertas do estado real
 * (dados dos alunos + treinos atribuídos hoje + penalidades). Em produção
 * vira queries sobre workout_logs, checkins e rpe com as mesmas regras.
 * Reage às ações do personal: atribuir treino, zerar streak, aprovar.
 */
export function computeRadar(
  students: PersonalStudent[],
  assignedToday: Array<{ studentId: string; createdAtIso: string }>,
): RadarAlert[] {
  const todayKey = new Date().toDateString();
  const assignedIds = new Set(
    assignedToday
      .filter((a) => new Date(a.createdAtIso).toDateString() === todayKey)
      .map((a) => a.studentId)
  );

  const alerts: RadarAlert[] = [];
  for (const st of students) {
    const first = st.name.split(" ")[0];
    // VERDE 1: plano novo atribuído hoje, aguardando execução
    if (assignedIds.has(st.id)) {
      alerts.push({
        id: `radar-new-${st.id}`,
        severity: "green",
        studentId: st.id,
        studentName: st.name,
        avatar: st.avatar,
        message: `${first} recebeu um plano novo hoje`,
        detail: "Aguardando o primeiro check-in do plano. Vale cobrir a execução.",
        whatsapp: st.whatsapp_consent && st.phone ? {
          phone: st.phone,
          consent: true,
          text: `Oi ${first}! Seu plano novo já está no app. Bora estrear hoje?`,
          label: "Cobrar execução",
        } : undefined,
      });
      continue;
    }
    // VERMELHO: sumido
    if (st.lastTrainingDaysAgo >= 3) {
      alerts.push({
        id: `radar-red-${st.id}`,
        severity: "red",
        studentId: st.id,
        studentName: st.name,
        avatar: st.avatar,
        message: `${first} não treina há ${st.lastTrainingDaysAgo} dias`,
        detail: `Última sessão registrada há ${st.lastTrainingDaysAgo} dias. Risco de evasão alto.`,
        whatsapp: st.whatsapp_consent && st.phone ? {
          phone: st.phone,
          consent: true,
          text: `Oi ${first}! Sentimos sua falta na academia. Que tal voltarmos hoje com um treino leve? Seu Personal está de olho!`,
        } : undefined,
        action: { label: "Ajustar Treino", href: `/personal/treinos?aluno=${st.id}` },
      });
      continue;
    }
    // AMARELO: fadiga
    if ((st.lastRpe ?? 0) >= 9) {
      alerts.push({
        id: `radar-yellow-${st.id}`,
        severity: "yellow",
        studentId: st.id,
        studentName: st.name,
        avatar: st.avatar,
        message: `${first} registrou RPE ${st.lastRpe} no último treino`,
        detail: "Esforço no limite. Vale reduzir carga ou trocar o foco do dia.",
        action: { label: "Ajustar Treino", href: `/personal/treinos?aluno=${st.id}` },
      });
      continue;
    }
    // VERDE 2: consistência alta
    if (st.streak >= 5 && st.lastTrainingDaysAgo === 0) {
      alerts.push({
        id: `radar-green-${st.id}`,
        severity: "green",
        studentId: st.id,
        studentName: st.name,
        avatar: st.avatar,
        message: `${first} está com ${st.streak} dias de consistência`,
        detail: "Momento ideal pra reconhecer e puxar o próximo degrau de carga.",
        whatsapp: st.whatsapp_consent && st.phone ? {
          phone: st.phone,
          consent: true,
          text: `Parabéns ${first}! ${st.streak} dias de consistência é disciplina de verdade. Rumo ao próximo degrau!`,
          label: "Dar Parabéns",
        } : undefined,
      });
    }
  }

  const order = { red: 0, yellow: 1, green: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 7);
}

export function demoPersonalStudents(): PersonalStudent[] {
  return [
    { id: "st-carlos", profile_id: "u5", name: "Carlos Mendes", avatar: AV(52), phone: "5511999990003", whatsapp_consent: true, lastTrainingDaysAgo: 0, streak: 8, activeWorkout: "Hipertrofia ABC", lastWorkout: "Supino Reto" , freq: 4 },
    { id: "st-marina", profile_id: "u2", name: "Marina Costa", avatar: AV(45), phone: "5511999990002", whatsapp_consent: true, lastTrainingDaysAgo: 0, streak: 6, activeWorkout: "Glúteos 3x Semana", lastWorkout: "Elevação Pélvica" , freq: 3 },
    { id: "st-pedro", profile_id: "u3", name: "Pedro Rocha", avatar: AV(15), phone: "5511999990004", whatsapp_consent: true, lastTrainingDaysAgo: 1, streak: 3, activeWorkout: "Full Body Iniciante", lastWorkout: "Leg Press 45°" , freq: 3 },
    { id: "st-anaj", profile_id: "u6", name: "Ana Júlia", avatar: AV(44), phone: "5511999990005", whatsapp_consent: true, lastTrainingDaysAgo: 1, streak: 5, activeWorkout: "Cutting Definição", lastWorkout: "Agachamento Smith", lastRpe: 10 , freq: 4 },
    { id: "st-ana", profile_id: "u4", name: "Ana Souza", avatar: AV(47), phone: "5511999990006", whatsapp_consent: false, lastTrainingDaysAgo: 1, streak: 4, activeWorkout: "Condicionamento", lastWorkout: "Puxada Alta" , freq: 5 },
    { id: "st-lucas", profile_id: "u1", name: "Lucas Andrade", avatar: AV(12), phone: "5511999990007", whatsapp_consent: true, lastTrainingDaysAgo: 2, streak: 2, activeWorkout: "Força Base", lastWorkout: "Terra Romeno" , freq: 3 },
    { id: "st-joao", profile_id: "u7", name: "João Silva", avatar: AV(33), phone: "5511999990001", whatsapp_consent: true, lastTrainingDaysAgo: 4, streak: 0, activeWorkout: "Hipertrofia ABC", lastWorkout: null , freq: 4 },
  ];
}

export function studentStatus(s: PersonalStudent): { label: string; tone: "green" | "red" | "amber" } {
  if (s.lastTrainingDaysAgo === 0) return { label: "Treinou hoje", tone: "green" };
  if (s.lastTrainingDaysAgo <= 2) return { label: `Ativo, ${s.lastTrainingDaysAgo}d sem treinar`, tone: "amber" };
  return { label: `Inativo, ${s.lastTrainingDaysAgo} dias`, tone: "red" };
}

export function demoTemplates(): WorkoutTemplate[] {
  return [
    {
      id: "tpl-fullbody",
      name: "Full Body Iniciante",
      description: "Corpo inteiro, 3x semana, máquinas e peso corporal.",
      level: "Iniciante",
      days: 3,
      exercises: [
        { name: "Agachamento", sets: 3, reps: "12", rest: "60s" },
        { name: "Supino Reto", sets: 3, reps: "10", rest: "60s" },
        { name: "Puxada Alta", sets: 3, reps: "12", rest: "60s" },
        { name: "Desenvolvimento Militar", sets: 2, reps: "12", rest: "45s" },
        { name: "Prancha", sets: 3, reps: "30s", rest: "30s" },
      ],
    },
    {
      id: "tpl-abc",
      name: "Hipertrofia ABC",
      description: "Divisão clássica A B C para quem já treina há meses.",
      level: "Intermediário",
      days: 6,
      exercises: [
        { name: "Supino Inclinado", sets: 4, reps: "8-10", rest: "90s" },
        { name: "Crucifixo com Halteres", sets: 3, reps: "12", rest: "60s" },
        { name: "Puxada Alta", sets: 4, reps: "8-10", rest: "90s" },
        { name: "Leg Press 45°", sets: 4, reps: "10", rest: "90s" },
        { name: "Rosca Direta", sets: 3, reps: "12", rest: "45s" },
      ],
    },
    {
      id: "tpl-casa",
      name: "Em Casa Sem Equipamento",
      description: "Zero impacto, só peso corporal. Ideal para traveling.",
      level: "Todos os níveis",
      days: 3,
      exercises: [
        { name: "Agachamento Livre", sets: 3, reps: "15", rest: "45s" },
        { name: "Flexão de Braço", sets: 3, reps: "10", rest: "45s" },
        { name: "Afundo", sets: 3, reps: "12", rest: "45s" },
        { name: "Prancha", sets: 3, reps: "40s", rest: "30s" },
      ],
    },
    {
      id: "tpl-gluteo",
      name: "Glúteos Foco",
      description: "Ativação + carga, 3x semana, baixo impacto nas articulações.",
      level: "Intermediário",
      days: 3,
      exercises: [
        { name: "Elevação Pélvica", sets: 4, reps: "10-12", rest: "90s" },
        { name: "Cadeira Abdutora", sets: 4, reps: "15", rest: "60s" },
        { name: "Stiff com Halteres", sets: 3, reps: "12", rest: "75s" },
        { name: "Coice na Polia", sets: 3, reps: "12", rest: "60s" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Séries determinísticas por aluno (histórico de treinos e evolução de peso)
// ---------------------------------------------------------------------------

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

/** Histórico de treinos com data e volume (kg movidos). */
export function mockWorkoutHistory(student: PersonalStudent): Array<{
  date: string;
  name: string;
  volume: number;
  sets: number;
}> {
  const seed = hashSeed(student.id);
  const out: Array<{ date: string; name: string; volume: number; sets: number }> = [];
  const names = student.activeWorkout ? [student.activeWorkout, "Acessórios", "Cardio"] : ["Adaptativo"];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i * 2 + (student.lastTrainingDaysAgo || 1)));
    out.push({
      date: d.toISOString(),
      name: names[i % names.length],
      volume: 4200 + ((seed * (i + 3)) % 2600),
      sets: 16 + ((seed + i * 7) % 10),
    });
  }
  return out;
}

/** Série de evolução de peso (kg), última medição mais recente. */
export function mockWeightSeries(student: PersonalStudent): number[] {
  const seed = hashSeed(student.id);
  const base = 62 + (seed % 28); // 62–89 kg
  const drift = ((seed % 5) - 2) * 0.8; // -1.6 a +3.2 kg de tendência
  return Array.from({ length: 6 }, (_, i) => {
    const wiggle = ((seed * (i + 1)) % 7) / 10 - 0.3;
    return Math.round((base + (drift * i) / 5 + wiggle) * 10) / 10;
  });
}
