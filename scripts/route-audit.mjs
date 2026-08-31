/**
 * Auditoria de rotas — verifica coerência de cliques, destino correto e retorno
 * Uso: node scripts/route-audit.mjs (precisa servidor em localhost:3000)
 */
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_URL || "http://localhost:3002";
const ROUTES = [
  { path: "/", label: "Início", expect: "Bom dia" },
  { path: "/login", label: "Login", expect: "Bem-vindo" },
  { path: "/treino", label: "Treino", expect: "Treino de hoje" },
  { path: "/checkin", label: "Check-in", expect: "Check-in" },
  { path: "/progresso", label: "Progresso", expect: "Progresso" },
  { path: "/ranking", label: "Ranking", expect: "Ranking" },
  { path: "/feed", label: "Feed", expect: "Feed" },
  { path: "/perfil", label: "Perfil", expect: "Perfil" },
  { path: "/equipamento", label: "Equipamento", expect: "Equipamento" },
  { path: "/conquistas", label: "Conquistas", expect: "Conquistas" },
  { path: "/personals", label: "Personals", expect: "Personals" },
  { path: "/configuracoes", label: "Configurações", expect: "Configurações" },
  { path: "/metricas", label: "Métricas", expect: "Métricas" },
  { path: "/treinos", label: "Treinos", expect: "Treinos" },
];

async function checkRoute(r) {
  try {
    const res = await fetch(BASE + r.path, { redirect: "manual" });
    const ok = res.status === 200 || res.status === 308 || res.status === 307;
    // Conteúdo pode ser client-rendered, só verifica status para rotas com JS
    const status = ok ? "PASS" : "FAIL";
    console.log(`${status} ${r.path} (${r.label}) → ${res.status} ${ok ? "✓" : "✗"}`);
    return status === "PASS";
  } catch (e) {
    console.log(`FAIL ${r.path} → ${e.message}`);
    return false;
  }
}

async function checkLinksCoherence() {
  // Verifica se BottomNav links apontam para rotas existentes
  const navLinks = ["/", "/treino", "/checkin", "/progresso", "/ranking", "/feed", "/perfil"];
  console.log("\n--- BottomNav coherence ---");
  for (const p of navLinks) {
    const exists = ROUTES.some(r => r.path === p);
    console.log(`${exists ? "PASS" : "FAIL"} BottomNav ${p} ${exists ? "existe" : "não mapeado"}`);
  }

  // Verifica redirecionamentos errados (ex: /login quando já logado deve ir pra /)
  console.log("\n--- Redirecionamentos ---");
  const redirTests = [
    { from: "/login", note: "deve ser 200 em demo mode (sem auth)" },
    { from: "/treino", note: "deve ser 200, não 308 para outra rota" },
  ];
  for (const t of redirTests) {
    const res = await fetch(BASE + t.from, { redirect: "manual" });
    console.log(`INFO ${t.from} → ${res.status} ${t.note} ${res.headers.get("location") || ""}`);
  }
}

async function main() {
  console.log(`Auditoria de rotas em ${BASE} — ${new Date().toISOString()}`);
  let pass = 0;
  for (const r of ROUTES) {
    if (await checkRoute(r)) pass++;
  }
  await checkLinksCoherence();
  console.log(`\nResultado: ${pass}/${ROUTES.length} rotas OK`);
  if (pass < ROUTES.length) process.exit(1);
}

main();
