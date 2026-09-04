/**
 * Gera migration SQL de exercises a partir do demoLib + expanded library.
 * Execute: npx tsx scripts/gen-exercises-migration.ts
 * Output: supabase/migrations/008_seed_all_exercises.sql
 */
import { writeFileSync } from "node:fs";

// Re-implementa o evkEx para ler os dados
const evkEx = (idNum: string, name: string, equip: string | null, info: string) => ({
  id: `evk-${idNum}`,
  name,
  equipment: equip,
  info,
});

// Mapeamento de categorias do demoLib para o schema SQL
const CAT_MAP: Record<string, string> = {
  peito: "peito",
  costas: "costas",
  ombro: "ombro",
  biceps: "biceps",
  triceps: "triceps",
  antebraco: "panturrilha", // approx
  inferiores: "perna",
  abdomen: "core",
  cardio: "cardio",
  alongamento: "core", // approx
};

// Mapeamento de músculos baseado na categoria
const MUSCLES_MAP: Record<string, string[]> = {
  peito: ["peito", "triceps", "ombro"],
  costas: ["costas", "biceps"],
  ombro: ["ombro"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  antebraco: ["biceps"],
  inferiores: ["perna", "gluteo"],
  abdomen: ["core"],
  cardio: ["cardio"],
  alongamento: ["core"],
};

type Exercise = {
  name: string;
  category: string;
  muscles: string[];
  tips: string[];
  highImpact: boolean;
};

function sanitize(val: string): string {
  return val.replace(/'/g, "''");
}

function arrToSql(arr: string[]): string {
  return `array[${arr.map((s) => `'${sanitize(s)}'`).join(",")}]`;
}

// Base library exercises (from demoLib)
const BASE_EXERCISES: Exercise[] = [
  // Peito
  { name: "Supino Reto", category: "peito", muscles: ["peito", "triceps", "ombro"], tips: ["Mantenha escápulas retraídas", "Barra na linha do mamilo"], highImpact: true },
  { name: "Supino Inclinado", category: "peito", muscles: ["peito", "ombro"], tips: ["Banco a 30-45°", "Foco na porção clavicular"], highImpact: false },
  { name: "Supino Declinado", category: "peito", muscles: ["peito"], tips: ["Banco declinado", "Foco na porção esternal"], highImpact: false },
  { name: "Supino com Halteres", category: "peito", muscles: ["peito", "triceps"], tips: ["Maior amplitude", "Estabilizadores ativos"], highImpact: false },
  { name: "Crucifixo com Halteres", category: "peito", muscles: ["peito"], tips: ["Movimento em arco", "Contração no topo"], highImpact: false },
  { name: "Crucifixo na Polia Baixa", category: "peito", muscles: ["peito"], tips: ["Cruze os braços à frente", "Leve flexão de cotovelo"], highImpact: false },
  { name: "Voador (Peck Deck)", category: "peito", muscles: ["peito"], tips: ["Escápulas encostadas", "Aproxime os braços"], highImpact: false },
  { name: "Flexão de Braço", category: "peito", muscles: ["peito", "core", "triceps"], tips: ["Corpo reto", "Cotovelos a 45°"], highImpact: true },
  { name: "Fundos (Paralelas)", category: "peito", muscles: ["peito", "triceps"], tips: ["Corpo vertical", "Desça até 90°"], highImpact: true },
  // Costas
  { name: "Puxada Alta Aberta", category: "costas", muscles: ["costas", "biceps"], tips: ["Puxe até a clavícula", "Cotovelos para baixo"], highImpact: false },
  { name: "Puxada Alta Fechada", category: "costas", muscles: ["costas", "biceps"], tips: ["Maior ênfase no meio", "Bíceps auxilia"], highImpact: false },
  { name: "Pulldown Supinado", category: "costas", muscles: ["costas", "biceps"], tips: ["Empunhadura invertida", "Foco na parte baixa"], highImpact: false },
  { name: "Puxada com Triângulo", category: "costas", muscles: ["costas", "biceps"], tips: ["Cotovelos junto ao corpo", "Puxe até o esterno"], highImpact: false },
  { name: "Barra Fixa", category: "costas", muscles: ["costas", "biceps"], tips: ["Queixo acima da barra", "Negativa se precisar"], highImpact: true },
  { name: "Barra Fixa Pronada", category: "costas", muscles: ["costas", "biceps"], tips: ["Maior ênfase no dorsal", "Meio das costas"], highImpact: true },
  { name: "Barra Fixa Supinada", category: "costas", muscles: ["costas", "biceps"], tips: ["Maior ativação de bíceps", "Dorsal junto"], highImpact: true },
  { name: "Remada Curvada", category: "costas", muscles: ["costas", "biceps"], tips: ["Tronco a 45°", "Puxe ao abdômen"], highImpact: false },
  { name: "Remada Baixa (Cabo)", category: "costas", muscles: ["costas", "biceps"], tips: ["Sentado", "Escápulas juntas"], highImpact: false },
  { name: "Remada Unilateral", category: "costas", muscles: ["costas", "biceps"], tips: ["Apoio no banco", "Puxe ao quadril"], highImpact: false },
  { name: "Remada Cavalinho", category: "costas", muscles: ["costas", "biceps"], tips: ["Apoio no banco inclinado", "Halters ao abdômen"], highImpact: false },
  { name: "Remada na Polia Baixa", category: "costas", muscles: ["costas", "biceps"], tips: ["Puxe ao abdômen", "Cotovelos perto do corpo"], highImpact: false },
  { name: "Shrugg", category: "costas", muscles: ["costas"], tips: ["Eleve os ombros", "Segure no topo"], highImpact: false },
  // Ombro
  { name: "Desenvolvimento Militar", category: "ombro", muscles: ["ombro", "triceps"], tips: ["Core firme", "Sem arco lombar"], highImpact: true },
  { name: "Desenvolvimento com Halteres", category: "ombro", muscles: ["ombro", "triceps"], tips: ["Maior amplitude", "Controle cada lado"], highImpact: false },
  { name: "Desenvolvimento Arnold", category: "ombro", muscles: ["ombro", "triceps"], tips: ["Rotação dos punhos", "Subida completa"], highImpact: false },
  { name: "Elevação Lateral", category: "ombro", muscles: ["ombro"], tips: ["Até a linha dos ombros", "Cotovelos leves"], highImpact: false },
  { name: "Elevação Frontal", category: "ombro", muscles: ["ombro"], tips: ["Um braço de cada vez", "Até a altura dos olhos"], highImpact: false },
  { name: "Elevação Lateral na Polia", category: "ombro", muscles: ["ombro"], tips: ["Cotovelo flexionado", "Abra lateralmente"], highImpact: false },
  { name: "Desenvolvimento na Máquina", category: "ombro", muscles: ["ombro", "triceps"], tips: ["Movimento guiado", "Bom para iniciantes"], highImpact: false },
  // Bíceps
  { name: "Rosca Direta", category: "biceps", muscles: ["biceps"], tips: ["Cotovelos fixos", "Sem balanço"], highImpact: false },
  { name: "Rosca Alternada", category: "biceps", muscles: ["biceps"], tips: ["Um braço de cada vez", "Controle a descida"], highImpact: false },
  { name: "Rosca Scott", category: "biceps", muscles: ["biceps"], tips: ["Braços apoiados", "Amplitude sem travar"], highImpact: false },
  { name: "Rosca Concentrada", category: "biceps", muscles: ["biceps"], tips: ["Coxa apoiando cotovelo", "Controle total"], highImpact: false },
  { name: "Rosca Martelo", category: "biceps", muscles: ["biceps", "antebraco"], tips: ["Empunhadura neutra", "Braquial e antebraço"], highImpact: false },
  { name: "Rosca na Polia Baixa", category: "biceps", muscles: ["biceps"], tips: ["Cotovelos fixos", "Puxe a barra para cima"], highImpact: false },
  { name: "Rosca 21", category: "biceps", muscles: ["biceps"], tips: ["7+7+7 repetições", "Metade inferior, superior, completa"], highImpact: false },
  // Tríceps
  { name: "Tríceps Pulley", category: "triceps", muscles: ["triceps"], tips: ["Cotovelos fixos", "Estenda totalmente"], highImpact: false },
  { name: "Tríceps Testa", category: "triceps", muscles: ["triceps"], tips: ["Deite no banco", "Flexione atrás da cabeça"], highImpact: false },
  { name: "Tríceps Corda", category: "triceps", muscles: ["triceps"], tips: ["Abra as pontas ao final", "Cabo com corda"], highImpact: false },
  { name: "Tríceps Francês", category: "triceps", muscles: ["triceps"], tips: ["Acima da cabeça", "Desça atrás da nuca"], highImpact: false },
  { name: "Tríceps Máquina", category: "triceps", muscles: ["triceps"], tips: ["Movimento guiado", "Isolar tríceps"], highImpact: false },
  { name: "Mergulho (Paralelas)", category: "triceps", muscles: ["triceps", "peito"], tips: ["Corpo reto", "Cotovelos para trás"], highImpact: true },
  // Antebraço
  { name: "Rosca de Punho", category: "biceps", muscles: ["biceps"], tips: ["Antebraços apoiados", "Flexione o punho"], highImpact: false },
  { name: "Rosca Inversa", category: "biceps", muscles: ["biceps"], tips: ["Empunhadura pronada", "Movimente os punhos"], highImpact: false },
  { name: "Extensão de Punho", category: "biceps", muscles: ["biceps"], tips: ["Antebraços apoiados", "Estenda os punhos"], highImpact: false },
  { name: "Farmer Walk", category: "perna", muscles: ["perna", "biceps"], tips: ["Halteres pesados", "Postura firme"], highImpact: false },
  // Perna / Quadríceps
  { name: "Agachamento no Smith", category: "perna", muscles: ["perna", "gluteo"], tips: ["Pés à frente", "Coxa paralela"], highImpact: false },
  { name: "Agachamento Livre", category: "perna", muscles: ["perna", "gluteo", "core"], tips: ["Barra nas costas", "Desça com controle"], highImpact: true },
  { name: "Agachamento Frontal", category: "perna", muscles: ["perna", "gluteo"], tips: ["Barra nos ombros frontais", "Core firme"], highImpact: true },
  { name: "Agachamento Sumô", category: "perna", muscles: ["perna", "gluteo"], tips: ["Pés abertos", "Ative glúteo e adutores"], highImpact: false },
  { name: "Agachamento Búlgaro", category: "perna", muscles: ["perna", "gluteo"], tips: ["Um pé atrás", "Desça com o da frente"], highImpact: false },
  { name: "Leg Press 45°", category: "perna", muscles: ["perna", "gluteo"], tips: ["Pés na largura dos ombros", "Lombar colada"], highImpact: false },
  { name: "Leg Press Pés Altos", category: "perna", muscles: ["perna", "gluteo"], tips: ["Maior ênfase posterior", "Glúteo ativo"], highImpact: false },
  { name: "Leg Press Unilateral", category: "perna", muscles: ["perna", "gluteo"], tips: ["Uma perna por vez", "Corrigir desequilíbrios"], highImpact: false },
  { name: "Cadeira Extensora", category: "perna", muscles: ["perna"], tips: ["Estenda até travar", "Sem soltar o peso"], highImpact: false },
  { name: "Afundo", category: "perna", muscles: ["perna", "gluteo"], tips: ["Passo à frente", "Joelho traseiro quase no chão"], highImpact: true },
  // Posterior / Glúteo
  { name: "Mesa Flexora", category: "perna", muscles: ["perna", "gluteo"], tips: ["Flexione as pernas", "Calcanhar ao glúteo"], highImpact: false },
  { name: "Cadeira Flexora", category: "perna", muscles: ["perna", "gluteo"], tips: ["Movimento guiado", "Controle excêntrica"], highImpact: false },
  { name: "Stiff", category: "perna", muscles: ["perna", "gluteo", "costas"], tips: ["Quadril para trás", "Posterior trabalhando"], highImpact: false },
  { name: "Bom Dia", category: "perna", muscles: ["perna", "gluteo", "costas"], tips: ["Barra nas costas", "Coluna neutra"], highImpact: false },
  { name: "Hiperextensão Lombar", category: "perna", muscles: ["perna", "costas"], tips: ["Estenda o tronco", "Controle no movimento"], highImpact: false },
  { name: "Cadeira Abdutora", category: "perna", muscles: ["perna", "gluteo"], tips: ["Afaste as pernas", "Controle a volta"], highImpact: false },
  { name: "Elevação Pélvica", category: "gluteo", muscles: ["gluteo"], tips: ["Deite de costas", "Suba o quadril"], highImpact: false },
  { name: "Hip Thrust", category: "gluteo", muscles: ["gluteo"], tips: ["Costas no banco", "Empurre com glúteos"], highImpact: false },
  { name: "Passada", category: "perna", muscles: ["perna", "gluteo"], tips: ["Passo longo", "Empurre pelo calcanhar"], highImpact: false },
  { name: "Kickback", category: "gluteo", muscles: ["gluteo"], tips: ["Apoie mãos e joelho", "Estenda a perna"], highImpact: false },
  // Panturrilha
  { name: "Panturrilha em Pé", category: "panturrilha", muscles: ["panturrilha"], tips: ["Suba na ponta", "Segure 1s no topo"], highImpact: false },
  { name: "Panturrilha no Leg Press", category: "panturrilha", muscles: ["panturrilha"], tips: ["Pés na ponta", "Eleve calcanhares"], highImpact: false },
  { name: "Panturrilha Sentado", category: "panturrilha", muscles: ["panturrilha"], tips: ["Joelhos a 90°", "Eleve calcanhares"], highImpact: false },
  { name: "Panturrilha em Pé Unilateral", category: "panturrilha", muscles: ["panturrilha"], tips: ["Um pé por vez", "Maior amplitude"], highImpact: false },
  // Core
  { name: "Abdominal na Máquina", category: "core", muscles: ["core"], tips: ["Encoste na almofada", "Sem puxar a cabeça"], highImpact: false },
  { name: "Crunch no Solo", category: "core", muscles: ["core"], tips: ["Lombar colada", "Olhe para o teto"], highImpact: false },
  { name: "Crunch na Polia Alta", category: "core", muscles: ["core"], tips: ["Puxe a corda", "Flexione o tronco"], highImpact: false },
  { name: "Prancha Isométrica", category: "core", muscles: ["core"], tips: ["Corpo reto", "Ative o core"], highImpact: false },
  { name: "Prancha com Elevação de Perna", category: "core", muscles: ["core"], tips: ["Mantenha a prancha", "Eleve uma perna"], highImpact: false },
  { name: "Elevação de Perna (Infra)", category: "core", muscles: ["core"], tips: ["Pendure-se", "Eleve as pernas"], highImpact: false },
  { name: "Prancha Lateral", category: "core", muscles: ["core", "ombro"], tips: ["Apoie o cotovelo", "Quadril alinhado"], highImpact: false },
  { name: "Russian Twist", category: "core", muscles: ["core"], tips: ["Rotação do tronco", "Com halter ou peso corporal"], highImpact: false },
  { name: "Bicicleta no Solo", category: "core", muscles: ["core"], tips: ["Rotação alternada", "Cotovelo e joelho oposto"], highImpact: false },
  { name: "Mountain Climber", category: "core", muscles: ["core"], tips: ["Posição de prancha", "Joelhos ao peito"], highImpact: true },
  // Cardio
  { name: "Esteira", category: "cardio", muscles: ["cardio"], tips: ["Aqueça 5 min", "Progressão gradual"], highImpact: false },
  { name: "Bicicleta Ergométrica", category: "cardio", muscles: ["cardio"], tips: ["Cadência constante", "Posição confortável"], highImpact: false },
  { name: "Elíptico", category: "cardio", muscles: ["cardio"], tips: ["Movimento fluido", "Resistência progressiva"], highImpact: false },
  { name: "Remador", category: "cardio", muscles: ["cardio", "costas"], tips: ["Empurre com pernas", "Sequência puxar-acabar"], highImpact: false },
  { name: "Burpee", category: "cardio", muscles: ["cardio"], tips: ["Flexão → impulso → salto", "Mãos acima da cabeça"], highImpact: true },
  { name: "Pular Corda", category: "cardio", muscles: ["cardio"], tips: ["Pulos rápidos", "Aterrisse suave"], highImpact: true },
  { name: "Swing de Kettlebell", category: "cardio", muscles: ["cardio", "gluteo"], tips: ["Balanço pélvico", "Até a altura do peito"], highImpact: false },
  { name: "Box Jump", category: "cardio", muscles: ["cardio", "perna"], tips: ["Salto no box", "Amortecimento suave"], highImpact: true },
  { name: "Sprint na Esteira", category: "cardio", muscles: ["cardio"], tips: ["Corridas curtas", "Intervalo de recuperação"], highImpact: true },
  // Alongamento
  { name: "Alongamento de Posterior", category: "core", muscles: ["perna"], tips: ["Sentado", "Alcance os pés"], highImpact: false },
  { name: "Quadril (Borboleta)", category: "core", muscles: ["perna", "gluteo"], tips: ["Plantas juntas", "Puxe calcanhares"], highImpact: false },
  { name: "Mobilidade de Ombro", category: "ombro", muscles: ["ombro"], tips: ["Gire os braços", "Aumente amplitude"], highImpact: false },
  { name: "Alongamento de Peito", category: "peito", muscles: ["peito"], tips: ["Apoie braço na parede", "Rotacione o tronco"], highImpact: false },
  { name: "Gato e Vaca", category: "core", muscles: ["core"], tips: ["Flexão e extensão lombar", "Quadrupedia"], highImpact: false },
];

// Expanded library exercises (from demo-library-expanded.ts)
const EXPANDED_EXERCISES: Exercise[] = [
  // Abdomen acervo
  { name: "Abdominal Draw In", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Bicicleta Air Bike", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Ab Rollout com Barra", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Ab Rollout de Joelhos com Barra", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação de Quadril com Joelhos Dobrados", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal Cruzado", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal com Pés na Bola", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal Declinado", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal Oblíquo Declinado", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flexão Lateral com Halter", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal na Bola", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Abdominal com Bola", category: "core", muscles: ["core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  // Bíceps acervo
  { name: "Rosca Inclinada Alternada com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Inclinada com Barra", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Martelo na Corda", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Scott no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Close Grip Rosca Direta com Barra W", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Martelo Cruzada com Halter", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Drag", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Direta com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Prone Incline Rosca Direta com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Direta com Barra W", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Martelo com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Inclinada Flexora com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Alta no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Incline Inner Rosca Direta com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Deitado no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Deitada Pegada Fechada no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca no Banco Alto com Barra", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Lying Supine Rosca Direta com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Scott na Máquina", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Scott Unilateral com Halter", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Acima da Cabeça no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Scott Martelo com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Inversa com Anilha", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Concentrada Pegada Fechada", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Sentado com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Spider com Barra", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Standing Inner Rosca Direta com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Unilateral no Cabo", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Unilateral no Banco Inclinado", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Scott com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Direta Pegada Aberta", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Zottman com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Zottman Scott com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca na Máquina", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Unilateral com Barra Olímpica", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Sentado na Bola com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca no Agachamento com Halter", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "One Arm Bicep Concentration na Stability Ball", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca com Levantamento Terra", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca com Extensão na Bola", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo com Rosca", category: "biceps", muscles: ["biceps", "perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca na Bola com Perna Elevada", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo Frontal com Rosca", category: "biceps", muscles: ["biceps", "perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca com Medicine Ball na Bola", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca Equilíbrio Unipodal com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rosca em V no Bosu com Halteres", category: "biceps", muscles: ["biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  // Costas acervo
  { name: "Barra Fixa Pegada Aberta Supinada", category: "costas", muscles: ["costas", "biceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: true },
  { name: "Pullover (Dorsal)", category: "costas", muscles: ["costas"], tips: ["Braços quase estendidos", "Foque no dorsal"], highImpact: false },
  { name: "Pulldown Braços Estendidos", category: "costas", muscles: ["costas"], tips: ["Braços estendidos", "Puxe com o dorsal"], highImpact: false },
  { name: "Levantamento Terra com Barra", category: "costas", muscles: ["costas", "gluteo", "perna"], tips: ["Coluna neutra", "Suba com quadris"], highImpact: true },
  { name: "Superman (Costas)", category: "costas", muscles: ["costas"], tips: ["Isometria 2-3s no topo", "Peso corporal"], highImpact: false },
  { name: "Remada Invertida", category: "costas", muscles: ["costas", "biceps"], tips: ["Corpo alinhado", "Puxe peito até barra"], highImpact: false },
  { name: "Remada Alta com Barra", category: "costas", muscles: ["costas", "ombro"], tips: ["Cotovelos altos", "Barra junto ao corpo"], highImpact: false },
  { name: "Levantamento Terra com Halteres", category: "costas", muscles: ["costas", "gluteo"], tips: ["Coluna neutra", "Quadril para trás"], highImpact: true },
  { name: "Pullover Cotovelos Flexionados com Halteres", category: "costas", muscles: ["costas"], tips: ["Arco completo", "Foque no dorsal"], highImpact: false },
  { name: "Pullover Braços Estendidos com Halteres", category: "costas", muscles: ["costas"], tips: ["Braços quase estendidos", "Arco amplo"], highImpact: false },
  { name: "Pullover na Bola com Carga", category: "costas", muscles: ["costas", "core"], tips: ["Estabilize o core", "Arco completo"], highImpact: false },
  // Inferiores acervo
  { name: "Elevação de Pernas no Solo", category: "perna", muscles: ["perna", "core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo com Halteres", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flutter Kicks", category: "perna", muscles: ["perna", "core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flexora em Pé", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Hack na Máquina", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Hack com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Hack no Smith", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo Traseiro com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo Traseiro com Halteres", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento com Halteres", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Lateral com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento no Banco com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Step Up com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Adução de Quadril", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento no Banco com Halteres", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Step Up com Halteres", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Frontal no Banco", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Iron Cross com Dumbbells", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Jefferson Squats com Barbell", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Leg Press Pegada Fechada", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Deitado", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Hack Pegada Fechada", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Fechado com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Unilateral com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Arranco Unilateral com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Levantamento Terra Unilateral com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Acima da Cabeça com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Velocidade com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Cadeira Adutora", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Sissy com Anilha", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Pegada Larga com Barra", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Agachamento Zecher", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Afundo Lateral com Rosca", category: "perna", muscles: ["perna", "gluteo"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Círculos com o Tornozelo", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha Burro", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha Sentado Unilateral com Halter", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Círculos com o Joelho", category: "perna", muscles: ["perna"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha em Pé com Barra", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha Sentado na Máquina", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha Reversa no Smith", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Panturrilha em Pé na Máquina", category: "panturrilha", muscles: ["panturrilha"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  // Ombro acervo
  { name: "Elevação Frontal no Cabo", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Alta no Smith", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Alta com Barra", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Alta no Cabo", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Alta com Halteres", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Círculos na Parede com Bola", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Posterior no Smith", category: "ombro", muscles: ["ombro", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação Posterior Deitado", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Posterior com Barra", category: "ombro", muscles: ["ombro", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação Posterior com Cabeça no Banco", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Rotação Interna no Cabo", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação Posterior no Cabo", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação Posterior Unilateral", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Alta Unilateral", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Smith Máquina Encolhimento de Ombros", category: "ombro", muscles: ["ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Barra Fixa Pegada Neutra", category: "ombro", muscles: ["ombro", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: true },
  { name: "Pullover na Bola com Carga (Ombro)", category: "ombro", muscles: ["ombro", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  // Peito acervo
  { name: "Pullover com Cotovelos Flexionados", category: "peito", muscles: ["peito", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Dumbbell Pullover com Cotovelos Flexionados", category: "peito", muscles: ["peito", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Close Grip Barbell Supino Reto", category: "peito", muscles: ["peito", "triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Decline Dumbbell Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Decline Crucifixo com Halteres", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Elevação Frontal com Pullover", category: "peito", muscles: ["peito", "ombro"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Hammer Grip Incline Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Crucifixo Inclinado no Cabo", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Dumbbell Incline Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Incline Crucifixo com Halteres", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Crucifixo Inclinado com Rotação", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Pullover Declinado Pegada Aberta", category: "peito", muscles: ["peito", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Máquina Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "One Arm Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flexão no Bosu", category: "peito", muscles: ["peito", "core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Supino Solo Unilateral", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Crucifixo Unilateral com Halteres", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flexão Unilateral", category: "peito", muscles: ["peito", "core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Flexão com Pés na Bola", category: "peito", muscles: ["peito", "core"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Pullover Braços Estendidos", category: "peito", muscles: ["peito", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Supino Inclinado com Halteres (Acervo)", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Smith Máquina Incline Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Wide Grip Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Wide Grip Decline Supino Reto", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Supino Declinado na Máquina", category: "peito", muscles: ["peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Remada Invertida (Peito)", category: "peito", muscles: ["peito", "costas"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  // Tríceps acervo
  { name: "Press Tate (Tríceps)", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Fundos no Banco", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Pushdown Inclinado", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês Inclinado no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Testa no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Unilateral no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Supino Fechado para Tríceps Testa", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês Declinado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês Declinado com Barra W", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Mergulho na Máquina", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Unilateral com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês Inclinado com Barra", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "JM Press (Tríceps)", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Concentrado de Joelhos no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão de Joelhos no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Baixa no Cabo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Supino Pegada Fechada com Barra", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Deitado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Testa com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Supino Fechado com Barra", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Extensão Reversa Clássica", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Pronada com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Supinada com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Close Triceps Pushup", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Pulley Supinado", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Reverse Triceps Supino Reto com Barbell", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Seated Tríceps Extensão Unilateral com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Sentado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Press Sentado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Smith Máquina Close Grip Supino Reto", category: "triceps", muscles: ["triceps", "peito"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Bent-Over Tríceps Extensão Unilateral com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Inclinado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão em Pé", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão Unilateral na Polia Baixa", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês em Pé com Barra", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Extensão em Pé com Towel", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Press Tate com Dumbbell", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Kickback com Halter", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Pulley Triângulo", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
  { name: "Tríceps Francês Inclinado com Halteres", category: "triceps", muscles: ["triceps"], tips: ["Execução controlada", "Descida em 2-3s"], highImpact: false },
];

function generateSql(): string {
  const all = [...BASE_EXERCISES, ...EXPANDED_EXERCISES];

  // Deduplicate by name (keep first)
  const seen = new Set<string>();
  const unique = all.filter((e) => {
    const key = e.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const lines = unique.map((e) => {
    const cat = CAT_MAP[e.category] ?? e.category;
    const muscles = e.muscles.map((m) => CAT_MAP[m] ?? m);
    const tips = e.tips.map((t) => sanitize(t));
    const name = sanitize(e.name);
    return `(null, '${name}', '${cat}', ${arrToSql(muscles)}, 'normal', ${e.highImpact}, ${arrToSql(tips)})`;
  });

  return `-- =====================================================================
-- 008_seed_all_exercises.sql
-- Seed completo: ${unique.length} exercícios da biblioteca (base + acervo)
-- gym_id = NULL (global do produto). Academias podem adicionar próprios.
-- Gerado automaticamente por scripts/gen-exercises-migration.ts
-- =====================================================================

-- Limpar seeds anteriores (se re-executar)
DELETE FROM public.exercises WHERE gym_id IS NULL;

INSERT INTO public.exercises (gym_id, name, category, muscles, technique_default, high_impact, tips) VALUES
${lines.join(",\n")};
`;
}

// Output
const sql = generateSql();
writeFileSync("supabase/migrations/008_seed_all_exercises.sql", sql);
console.log(`Generated migration with ${BASE_EXERCISES.length + EXPANDED_EXERCISES.length} exercises (deduped in SQL)`);
