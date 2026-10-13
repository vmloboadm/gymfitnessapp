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
const email = "matrix-e2e@teste.com";
const old = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
if (old) { await admin.from("notifications").delete().eq("user_id", old.id); await admin.auth.admin.deleteUser(old.id).catch(() => {}); await new Promise((r) => setTimeout(r, 2000)); }
const { data: c } = await admin.auth.admin.createUser({ email, password: "E2e#Mtx123", email_confirm: true, user_metadata: { name: "Matrix E2E" } });
await admin.from("profiles").update({ name: "Matrix E2E", role: "manager", gym_id: "00000000-0000-0000-0000-000000000001", approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", c.user.id);
const { data: s } = await anon.auth.signInWithPassword({ email, password: "E2e#Mtx123" });
const cookie = `sb-jeixbpucnxrhizqpapyv-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString("base64")}`;
const { data: ex } = await admin.from("exercises").select("name").limit(200);
const lib = ex.map((e) => e.name).join(" | ");
const call = async (label, body) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/assistente`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  let info = "";
  if (j.text) { try { const p = JSON.parse(j.text.slice(j.text.indexOf("{"), j.text.lastIndexOf("}") + 1)); info = `${p.dias?.length ?? 0}d/${(p.dias ?? []).reduce((a, d) => a + (d.exercicios?.length ?? 0), 0)}ex`; } catch { info = "JSON-ruim"; } }
  console.log(`${label}:`, r.ok && j.ok ? `OK ${t}s ${j.model}${j.repaired ? " reparado" : ""} ${info}` : `FALHA ${r.status} ${(j.error ?? "").slice(0, 70)}`);
  return j.text ?? null;
};
const t1 = await call("A) ABC 3d simples", { message: "Aluno: T. Objetivo: Hipertrofia. Nível: Intermediário. Frequência: 3 dias. Pedido: Plano ABC em rotação, foco Corpo inteiro.", context: "personal", extras: { "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": lib, "Quantidade exata de dias do plano": "3" } });
const t2 = await call("B) ABCDE 5d multi-objetivo", { message: "Aluno: T. Objetivo: Hipertrofia. Nível: Intermediário. Frequência: 5 dias. Pedido: Plano Intermediário. Objetivo: Hipertrofia, Condicionamento. Foco: Braços, Ombros. Divisão ABCDE em rotação: 5 treinos (slots A, B, C, D, E).", context: "personal", extras: { "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": lib, "Quantidade exata de dias do plano": "5" } });
if (t1) {
  const plan = JSON.parse(t1.slice(t1.indexOf("{"), t1.lastIndexOf("}") + 1));
  await call("C) editar v2 (trocar 1 ex)", { message: `Pedido do personal: trocar o primeiro exercício do dia A por Supino reto com barra.\nPlano atual em JSON (devolva COMPLETO, mudando somente o pedido):\n${JSON.stringify(plan)}`, context: "edit", extras: { "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": lib } });
}
await admin.from("notifications").delete().eq("user_id", c.user.id);
await admin.auth.admin.deleteUser(c.user.id);
console.log("cleanup ok");
process.exit(0);
