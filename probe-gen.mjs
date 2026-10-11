import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync("/root/gymfitnessapp/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const BASE = "https://gymfitnesscampos.com.br/app";
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = "gen-e2e@teste.com";
const old = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
if (old) { await admin.from("notifications").delete().eq("user_id", old.id); await admin.auth.admin.deleteUser(old.id).catch(() => {}); await new Promise((r) => setTimeout(r, 2000)); }
const { data: c } = await admin.auth.admin.createUser({ email, password: "E2e#Gen123", email_confirm: true, user_metadata: { name: "Gen E2E" } });
await admin.from("profiles").update({ name: "Gen E2E", role: "trainer", gym_id: "00000000-0000-0000-0000-000000000001", approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", c.user.id);
const { data: s } = await anon.auth.signInWithPassword({ email, password: "E2e#Gen123" });
const cookie = `sb-jeixbpucnxrhizqpapyv-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString("base64")}`;
const { data: ex } = await admin.from("exercises").select("name").limit(66);
for (let i = 1; i <= 2; i++) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/assistente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      message: "Aluno: Teste. Objetivo: Hipertrofia. Nível: Intermediário. Frequência: 3 dias. Pedido: Plano ABC em rotação, foco Corpo inteiro.",
      context: "personal",
      extras: {
        "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": ex.map((e) => e.name).join(" | "),
        "Quantidade exata de dias do plano": "3",
      },
    }),
  });
  const j = await r.json().catch(() => ({}));
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  let dias = "?";
  try { const p = JSON.parse(j.text.slice(j.text.indexOf("{"), j.text.lastIndexOf("}") + 1)); dias = (p.dias?.length ?? 0) + " dias"; } catch { dias = "JSON-ruim"; }
  console.log(`tentativa ${i}:`, r.ok && j.ok ? `OK ${t}s modelo=${j.model} ${dias}` : `FALHA ${r.status} ${(j.error ?? "").slice(0, 60)}`);
}
await admin.from("notifications").delete().eq("user_id", c.user.id);
await admin.auth.admin.deleteUser(c.user.id);
console.log("cleanup ok");
process.exit(0);
