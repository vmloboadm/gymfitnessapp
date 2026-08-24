export const LEAGUES = [
  { id: "bronze", label: "Bronze", icon: "🥉", min: 0, color: "text-orange-600" },
  { id: "prata", label: "Prata", icon: "🥈", min: 800, color: "text-slate-300" },
  { id: "ouro", label: "Ouro", icon: "🥇", min: 1600, color: "text-yellow-400" },
  { id: "platina", label: "Platina", icon: "💎", min: 2600, color: "text-cyan-400" },
  { id: "diamante", label: "Diamante", icon: "👑", min: 4000, color: "text-brand" },
] as const;

export type League = (typeof LEAGUES)[number];

export function leagueFor(points: number): League {
  return [...LEAGUES].reverse().find((l) => points >= l.min) ?? LEAGUES[0];
}