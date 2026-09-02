/**
 * Cria as contas reais dos personais da GymFitness no Supabase.
 * Uso: node scripts/create-trainers.mjs
 *
 * 1. auth.admin.createUser (email confirmado, sem link de confirmação)
 * 2. descobre o gym_id real (profiles existentes → gyms → fallback mock)
 * 3. insere profiles {role: trainer, name, phone, bio}
 * Se o INSERT for bloqueado por GRANT do service_role, gera o SQL pronto
 * pro SQL Editor do Supabase em /tmp/trainers-insert.sql
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

// --- env do .env.local ---
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SRK) {
  console.error("Sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const admin = createClient(URL, SRK, { auth: { persistSession: false } });

const TRAINERS = [
  {
    name: "Claudeir Machado",
    email: "gffitness2024@gmail.com",
    password: "academiagf2026",
    phone: "5522997787186",
    bio: "Dono da GymFitness e personal trainer, hipertrofia e condicionamento",
  },
  {
    name: "Rebeca Silveira",
    email: "rebecaasilveira18@gmail.com",
    password: "academiagf2026",
    phone: "5522997475362",
    bio: "Hipertrofia feminina, glúteos e emagrecimento saudável",
  },
  {
    name: "Daiana Teodoro",
    email: "daianabw.dt@gmail.com",
    password: "academiagf2026",
    phone: "5522998732483",
    bio: "Treino para iniciante ao avançado, condicionamento e emagrecimento",
  },
];

// --- gym_id real: profiles existentes → tabela gyms → fallback ---
async function findGymId() {
  // tenta profiles existentes (usuário real vmlobo021)
  const { data: profs } = await admin
    .from("profiles")
    .select("gym_id")
    .limit(5);
  if (profs?.length && profs[0].gym_id) {
    console.log("gym_id via profiles existentes:", profs[0].gym_id);
    return profs[0].gym_id;
  }
  const { data: gyms } = await admin.from("gyms").select("id").limit(1);
  if (gyms?.length) {
    console.log("gym_id via gyms:", gyms[0].id);
    return gyms[0].id;
  }
  const fallback = "00000000-0000-0000-0000-000000000001";
  console.log("gym_id fallback (mock):", fallback);
  return fallback;
}

const sqlLines = [];

for (const t of TRAINERS) {
  console.log(`\n=== ${t.name} (${t.email}) ===`);

  // 1) cria o usuário de autenticação
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: t.email,
    password: t.password,
    email_confirm: true,
    user_metadata: { name: t.name, role: "trainer" },
  });
  if (createErr) {
    if (createErr.message?.toLowerCase().includes("already")) {
      console.log("usuário já existe, buscando id...");
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === t.email);
      if (!found) {
        console.error("✗ existe mas não achei o id");
        continue;
      }
      userId = found.id;
    } else {
      console.error("✗ criar usuário:", createErr.message);
      continue;
    }
  } else {
    userId = created.user.id;
  }
  console.log("auth user:", userId);

  // 2) insere o profile (role trainer)
  const gymId = await findGymId();
  const now = new Date().toISOString();
  const { error: profErr } = await admin.from("profiles").insert({
    id: userId,
    gym_id: gymId,
    role: "trainer",
    status: "active",
    name: t.name,
    email: t.email,
    phone: t.phone,
    onboarding_completed: true,
    onboarding_step: 5,
    lgpd_consent_at: now,
    created_at: now,
    updated_at: now,
  });
  if (profErr) {
    console.error("✗ insert profile:", profErr.message);
    sqlLines.push(
      `INSERT INTO public.profiles (id, gym_id, role, status, name, email, phone, onboarding_completed, onboarding_step, lgpd_consent_at, created_at, updated_at)\n` +
        `VALUES ('${userId}', '${gymId}', 'trainer', 'active', '${t.name}', '${t.email}', '${t.phone}', true, 5, now(), now(), now());`
    );
  } else {
    console.log("✓ profile criado");
  }
}

if (sqlLines.length) {
  const sql =
    `-- GymFitness: migração dos personais (rodar UMA vez no SQL Editor)\n` +
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;\n` +
    `GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;\n\n` +
    sqlLines.join("\n\n") +
    `\n\n-- Bios provisórias (editáveis pelo app)\n` +
    `UPDATE public.profiles SET bio = 'Dono da GymFitness e personal trainer, hipertrofia e condicionamento' WHERE email = 'gffitness2024@gmail.com';\n` +
    `UPDATE public.profiles SET bio = 'Hipertrofia feminina, glúteos e emagrecimento saudável' WHERE email = 'rebecaasilveira18@gmail.com';\n` +
    `UPDATE public.profiles SET bio = 'Treino para iniciante ao avançado, condicionamento e emagrecimento' WHERE email = 'daianabw.dt@gmail.com';`;
  writeFileSync("/tmp/trainers-insert.sql", sql);
  console.log("\n⚠ Alguns profiles não inseridos. SQL salvo em /tmp/trainers-insert.sql");
} else {
  console.log("\n✓ Todos os profiles criados direto via API");
}
