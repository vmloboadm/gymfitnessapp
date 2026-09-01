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
  avatar: string;
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
  name: string;
  avatar: string;
  phone: string | null;
  /** Consentimento LGPD para contato via WhatsApp (onboarding) */
  whatsapp_consent: boolean;
  /** Dias desde o último treino (0 = treinou hoje) */
  lastTrainingDaysAgo: number;
  streak: number;
  activeWorkout: string | null;
  /** Último exercício registrado pelo aluno (para dar contexto na lista) */
  lastWorkout: string | null;
  /** Último RPE registrado, quando houver */
  lastRpe?: number;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string;
  level: string;
  days: number;
  exercises: Array<{ name: string; sets: number; reps: string; rest: string }>;
};

const AV = (n: number) => `https://i.pravatar.cc/80?img=${n}`;

export function demoRadarAlerts(): RadarAlert[] {
  return [
    {
      id: "radar-1",
      severity: "red",
      studentId: "st-joao",
      studentName: "João Silva",
      avatar: AV(33),
      message: "João Silva não treina há 4 dias",
      detail: "Último treino sexta passada. Risco de evasão alto.",
      whatsapp: {
        phone: "5511999990001",
        consent: true,
        text: "Oi João! Sentimos sua falta na academia. Que tal voltarmos hoje com um treino leve? Seu Personal está de olho!",
      },
    },
    {
      id: "radar-2",
      severity: "yellow",
      studentId: "st-anaj",
      studentName: "Ana Júlia",
      avatar: AV(44),
      message: "Ana Júlia registrou RPE 10 ontem",
      detail: "Esforço no limite. Vale reduzir carga ou trocar o foco do dia.",
      action: { label: "Ajustar Treino", href: "/personal/treinos" },
    },
    {
      id: "radar-3",
      severity: "green",
      studentId: "st-carlos",
      studentName: "Carlos",
      avatar: AV(52),
      message: "Carlos bateu RP no Supino",
      detail: "120 kg x 3, superando a marca anterior em 5 kg.",
      whatsapp: {
        phone: "5511999990003",
        consent: true,
        text: "Parabéns Carlos! RP no Supino com execução limpa é outro nível. Rumo aos 130 kg!",
        label: "Dar Parabéns",
      },
    },
  ];
}

export function demoPersonalStudents(): PersonalStudent[] {
  return [
    { id: "st-carlos", name: "Carlos Mendes", avatar: AV(52), phone: "5511999990003", whatsapp_consent: true, lastTrainingDaysAgo: 0, streak: 8, activeWorkout: "Hipertrofia ABC", lastWorkout: "Supino Reto" },
    { id: "st-marina", name: "Marina Costa", avatar: AV(45), phone: "5511999990002", whatsapp_consent: true, lastTrainingDaysAgo: 0, streak: 6, activeWorkout: "Glúteos 3x Semana", lastWorkout: "Elevação Pélvica" },
    { id: "st-pedro", name: "Pedro Rocha", avatar: AV(15), phone: "5511999990004", whatsapp_consent: true, lastTrainingDaysAgo: 1, streak: 3, activeWorkout: "Full Body Iniciante", lastWorkout: "Leg Press 45°" },
    { id: "st-anaj", name: "Ana Júlia", avatar: AV(44), phone: "5511999990005", whatsapp_consent: true, lastTrainingDaysAgo: 1, streak: 5, activeWorkout: "Cutting Definição", lastWorkout: "Agachamento Smith", lastRpe: 10 },
    { id: "st-ana", name: "Ana Souza", avatar: AV(47), phone: "5511999990006", whatsapp_consent: false, lastTrainingDaysAgo: 1, streak: 4, activeWorkout: "Condicionamento", lastWorkout: "Puxada Alta" },
    { id: "st-lucas", name: "Lucas Andrade", avatar: AV(12), phone: "5511999990007", whatsapp_consent: true, lastTrainingDaysAgo: 2, streak: 2, activeWorkout: "Força Base", lastWorkout: "Terra Romeno" },
    { id: "st-joao", name: "João Silva", avatar: AV(33), phone: "5511999990001", whatsapp_consent: true, lastTrainingDaysAgo: 4, streak: 0, activeWorkout: "Hipertrofia ABC", lastWorkout: null },
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
