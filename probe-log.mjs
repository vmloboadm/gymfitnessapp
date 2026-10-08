import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = "log-probe-e2e@teste.com";
const old = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
if (old) await admin.auth.admin.deleteUser(old.id);
const { data: created } = await admin.auth.admin.createUser({ email, password: "E2e#Log123", email_confirm: true });
const GYM = "00000000-0000-0000-0000-000000000001";
await admin.from("profiles").update({ name: "Log Probe", role: "student", gym_id: GYM, approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", created.user.id);
const { data: sess, error: loginErr } = await anon.auth.signInWithPassword({ email, password: "E2e#Log123" });
if (loginErr) throw loginErr;
const stu = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + sess.session.access_token } } });
// 1) ilike de resolução de nomes (igual ao conclude)
const r1 = await stu.from("exercises").select("id, name").or("name.ilike.%Supino%,name.ilike.%Rosca%").limit(6);
console.log("1) ilike exercises como aluno:", r1.error ? "ERRO " + r1.error.message : `OK ${r1.data.length} linhas`);
// 2) insert direto em workout_logs (igual ao conclude)
const exId = (await admin.from("exercises").select("id").limit(1)).data[0].id;
const r2 = await stu.from("workout_logs").insert({ gym_id: GYM, student_id: created.user.id, workout_id: null, exercise_id: exId, date: new Date().toISOString(), reps: 10, rpe: 8 });
console.log("2) insert workout_logs como aluno:", r2.error ? "ERRO " + r2.error.message + " [" + r2.error.code + "]" : "OK");
// 3) leitura de volta (igual à home)
const r3 = await stu.from("workout_logs").select("date, weight_kg, reps").eq("student_id", created.user.id).order("date", { ascending: false }).limit(60);
console.log("3) select workout_logs como aluno:", r3.error ? "ERRO " + r3.error.message : `OK ${r3.data.length} linhas`);
await admin.from("workout_logs").delete().eq("student_id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("cleanup ok");
process.exit(0);
