/**
 * BANCO DE EXERCÍCIOS — fonte curada com vídeo de execução.
 * Regra da URL: busca YouTube com canal de referência (à prova de link morto).
 */

export type ExerciseEntry = {
  id: string;
  name: string;
  muscleGroup: string;
  thumbUrl: string;
  /** Busca YouTube curada — sempre encontra o melhor tutorial disponível. */
  youtubeUrl: string;
};

const yt = (q: string) =>
  `https://www.youtube.com/results?search_query=Jeff+Nippard+${encodeURIComponent(q)}+form`;

const uns = (id: string) => `https://images.unsplash.com/${id}?w=300&h=300&fit=crop&q=70`;

export const EXERCISES_DATABASE: ExerciseEntry[] = [
  { id: "db-01", name: "Supino Reto", muscleGroup: "peito", thumbUrl: uns("photo-1574680096145-d05b474e2155"), youtubeUrl: yt("Supino Reto") },
  { id: "db-02", name: "Agachamento Livre", muscleGroup: "perna", thumbUrl: uns("photo-1571731956672-f2b94d7dd0cb"), youtubeUrl: yt("Agachamento Livre") },
  { id: "db-03", name: "Levantamento Terra", muscleGroup: "costas", thumbUrl: uns("photo-1517963879433-6ad2b056d712"), youtubeUrl: yt("Levantamento Terra") },
  { id: "db-04", name: "Desenvolvimento Militar", muscleGroup: "ombro", thumbUrl: uns("photo-1583454110551-21f2fa2afe61"), youtubeUrl: yt("Desenvolvimento Militar") },
  { id: "db-05", name: "Rosca Direta", muscleGroup: "biceps", thumbUrl: uns("photo-1541534741688-6078c6bfb5c5"), youtubeUrl: yt("Rosca Direta") },
  { id: "db-06", name: "Tríceps Corda", muscleGroup: "triceps", thumbUrl: uns("photo-1591940765155-0604248f8da7"), youtubeUrl: yt("Triceps Pushdown") },
  { id: "db-07", name: "Puxada Alta", muscleGroup: "costas", thumbUrl: uns("photo-1541534741688-6078c6bfb5c5"), youtubeUrl: yt("Lat Pulldown") },
  { id: "db-08", name: "Remada Curvada", muscleGroup: "costas", thumbUrl: uns("photo-1598971639058-fab3c3109a00"), youtubeUrl: yt("Barbell Row") },
  { id: "db-09", name: "Leg Press 45°", muscleGroup: "perna", thumbUrl: uns("photo-1434682881908-b43d0467b798"), youtubeUrl: yt("Leg Press") },
  { id: "db-10", name: "Crucifixo Máquina", muscleGroup: "peito", thumbUrl: uns("photo-1558611848-73f7eb4001a1"), youtubeUrl: yt("Chest Fly") },
  { id: "db-11", name: "Elevação Lateral", muscleGroup: "ombro", thumbUrl: uns("photo-1581009146145-b5ef050c2e1e"), youtubeUrl: yt("Lateral Raise") },
  { id: "db-12", name: "Cadeira Extensora", muscleGroup: "quadriceps", thumbUrl: uns("photo-1517838277536-f5f99be501cd"), youtubeUrl: yt("Leg Extension") },
  { id: "db-13", name: "Mesa Flexora", muscleGroup: "posterior", thumbUrl: uns("photo-1526506118085-60ce8714f8c5"), youtubeUrl: yt("Leg Curl") },
  { id: "db-14", name: "Panturrilha em Pé", muscleGroup: "panturrilha", thumbUrl: uns("photo-1546483875-ad9014c88eba"), youtubeUrl: yt("Calf Raise") },
  { id: "db-15", name: "Prancha Abdominal", muscleGroup: "core", thumbUrl: uns("photo-1571388208497-71bedc66e932"), youtubeUrl: yt("Plank Form") },
];

/** Busca no banco por nome aproximado (usado pelas fichas). */
export function findInDatabase(name: string): ExerciseEntry | null {
  const n = name.toLowerCase();
  return (
    EXERCISES_DATABASE.find((e) => n.includes(e.name.toLowerCase())) ??
    EXERCISES_DATABASE.find((e) => e.name.toLowerCase().split(" ").some((w) => w.length > 3 && n.includes(w))) ??
    null
  );
}

/** URL curada pra qualquer exercício fora do banco. */
export function curatedSearch(name: string): string {
  return yt(name);
}
