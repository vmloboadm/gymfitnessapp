import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync("/root/gymfitnessapp/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const GYM = "00000000-0000-0000-0000-000000000001";
const JOYCE = "45662419-6349-46c0-a850-1acdeb50a160";
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = "joycecheck-e2e@teste.com";
const old = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
if (old) { await admin.from("notifications").delete().eq("user_id", old.id); await admin.from("student_trainers").delete().or(`student_id.eq.${old.id},trainer_id.eq.${old.id}`); await admin.auth.admin.deleteUser(old.id).catch(() => {}); await new Promise((r) => setTimeout(r, 2000)); }
const { data: c } = await admin.auth.admin.createUser({ email, password: "E2e#Joy123", email_confirm: true, user_metadata: { name: "Check E2E" } });
await admin.from("profiles").update({ name: "Check E2E", role: "trainer", gym_id: GYM, approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", c.user.id);
// vincula o trainer de teste à Joyce DE VERDADE (temporário)
await admin.from("student_trainers").insert({ gym_id: GYM, student_id: JOYCE, trainer_id: c.user.id });
const { data: s } = await anon.auth.signInWithPassword({ email, password: "E2e#Joy123" });
const tr = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + s.session.access_token } } });
const seen = await tr.from("progress_photos").select("id, angle, phase, visibility").eq("student_id", JOYCE);
console.log("personal vinculado vê fotos REAIS da Joyce:", (seen.data ?? []).length === 2 ? `OK (${(seen.data ?? []).map((r) => r.phase + "/" + r.angle).join(", ")})` : `FALHA (${(seen.data ?? []).length}) ${seen.error?.message ?? ""}`);
await admin.from("student_trainers").delete().eq("student_id", JOYCE).eq("trainer_id", c.user.id);
const gone = await tr.from("progress_photos").select("id").eq("student_id", JOYCE);
console.log("sem vínculo some:", (gone.data ?? []).length === 0 ? "OK" : "FALHA");
await admin.from("notifications").delete().eq("user_id", c.user.id);
await admin.auth.admin.deleteUser(c.user.id);
console.log("cleanup ok");
process.exit(0);
