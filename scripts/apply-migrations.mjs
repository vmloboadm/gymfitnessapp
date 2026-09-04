/**
 * Aplica migrations SQL ao Supabase via Management API.
 * Uso: node scripts/apply-migrations.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// env
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!URL || !SRK || !PROJECT_REF) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Supabase PAT — set via env SUPABASE_PAT or paste here
const PAT = process.env.SUPABASE_PAT || "YOUR_SUPABASE_PAT_HERE";

const MIGRATIONS = [
  "supabase/migrations/007_profile_security_and_rpcs.sql",
  "supabase/migrations/008_seed_all_exercises.sql",
  "supabase/migrations/009_ai_audit_and_validation.sql",
];

async function applyMigration(filePath) {
  const sql = readFileSync(filePath, "utf8");
  console.log(`\n▶ Applying: ${filePath}`);
  console.log(`  SQL size: ${sql.length} chars`);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error(`  ✗ FAILED (${res.status}):`, JSON.stringify(data).slice(0, 500));
    return false;
  }

  // Check for errors in the response
  if (data.error) {
    console.error(`  ✗ SQL ERROR:`, data.error.message ?? JSON.stringify(data.error).slice(0, 500));
    return false;
  }

  console.log(`  ✓ OK`);
  if (data.execution_time) console.log(`  ⏱ ${data.execution_time}ms`);
  return true;
}

async function main() {
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`URL: ${URL}`);

  let allOk = true;
  for (const m of MIGRATIONS) {
    const ok = await applyMigration(m);
    if (!ok) allOk = false;
  }

  console.log(`\n${allOk ? "✓ All migrations applied" : "✗ Some migrations failed"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
