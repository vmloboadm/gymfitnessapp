import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync("/root/gymfitnessapp/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const BASE = "https://gymfitnesscampos.com.br/app";
const GYM = "00000000-0000-0000-0000-000000000001";
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const mk = async (email, name, role) => {
  const old = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
  if (old) {
    const pid = old.id;
    await admin.from("notifications").delete().eq("user_id", pid);
    await admin.from("student_trainers").delete().or(`student_id.eq.${pid},trainer_id.eq.${pid}`);
    await admin.from("workout_logs").delete().eq("student_id", pid);
    await admin.from("leaderboard").delete().eq("student_id", pid);
    await admin.from("student_achievements").delete().eq("student_id", pid);
    await admin.from("feed_posts").delete().eq("author_id", pid);
    const sw = await admin.from("student_workouts").select("program_id").eq("student_id", pid);
    for (const r of sw.data ?? []) {
      const dd = await admin.from("workout_days").select("id").eq("program_id", r.program_id);
      const ids = (dd.data ?? []).map((d) => d.id);
      if (ids.length) { await admin.from("workout_exercises").delete().in("day_id", ids); await admin.from("workout_days").delete().in("id", ids); }
      await admin.from("student_workouts").delete().eq("program_id", r.program_id);
      await admin.from("workout_programs").delete().eq("id", r.program_id);
    }
    await admin.auth.admin.deleteUser(pid).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }
  const { data: c } = await admin.auth.admin.createUser({ email, password: "E2e#Edit12", email_confirm: true, user_metadata: { name } });
  if (!c?.user) throw new Error("criar " + email);
  await admin.from("profiles").update({ name, role, gym_id: GYM, approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", c.user.id);
  return c.user.id;
};
const mid = await mk("edit-mgr-e2e@teste.com", "Manager E2E Edit", "manager");
const sid = await mk("edit-stu-e2e@teste.com", "Student E2E Edit", "student");
const { data: ms } = await anon.auth.signInWithPassword({ email: "edit-mgr-e2e@teste.com", password: "E2e#Edit12" });
const cookie = `sb-jeixbpucnxrhizqpapyv-auth-token=base64-${Buffer.from(JSON.stringify(ms.session)).toString("base64")}`;
const mg = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + ms.session.access_token } } });
const { data: ex } = await admin.from("exercises").select("name").limit(200);
const extras = {
  "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": ex.map((e) => e.name).slice(0, 200).join(" | "),
  "Quantidade exata de dias do plano": "3",
};
// 1) gera base
let t0 = Date.now();
let gen = await fetch(`${BASE}/api/assistente`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ message: "Aluno: Student E2E Edit. Objetivo: Hipertrofia. Nível: Intermediário. Frequência: 3 dias. Pedido: Plano ABC em rotação, foco Corpo inteiro.", context: "personal", extras }) });
let gj = await gen.json().catch(() => ({}));
console.log(`1) gera base:`, gen.ok && gj.ok ? `OK (${((Date.now() - t0) / 1000).toFixed(1)}s, ${gj.model})` : `FALHA ${gen.status} ${(gj.error ?? "").slice(0, 70)}`);
if (!gj.text) throw new Error("sem base");
// 2) EDITA (contexto edit, plano completo + pedido) — caminho nunca testado
const plan = JSON.parse(gj.text.slice(gj.text.indexOf("{"), gj.text.lastIndexOf("}") + 1));
t0 = Date.now();
const edit = await fetch(`${BASE}/api/assistente`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    message: `Pedido do personal: trocar o primeiro exercício do dia A por Supino reto com barra.\nPlano atual em JSON (devolva COMPLETO, mudando somente o pedido):\n${JSON.stringify(plan)}`,
    context: "edit",
    extras: { "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)": ex.map((e) => e.name).slice(0, 200).join(" | ") },
  }) });
const ej = await edit.json().catch(() => ({}));
let editOk = false, editDias = 0;
if (edit.ok && ej.ok && ej.text) {
  try {
    const p2 = JSON.parse(ej.text.slice(ej.text.indexOf("{"), ej.text.lastIndexOf("}") + 1));
    editDias = p2.dias?.length ?? 0;
    editOk = editDias === plan.dias.length;
  } catch { editOk = false; }
}
console.log(`2) edita v2:`, editOk ? `OK (${((Date.now() - t0) / 1000).toFixed(1)}s, ${editDias} dias intactos)` : `FALHA ${edit.status} ${(ej.error ?? ej.text ?? "").slice(0, 90)}`);
// 3) aprova a v2 e atribui
if (editOk) {
  const p2 = JSON.parse(ej.text.slice(ej.text.indexOf("{"), ej.text.lastIndexOf("}") + 1));
  const exIds = new Map((await admin.from("exercises").select("id, name").limit(500)).data.map((e) => [e.name.toLowerCase(), e.id]));
  const pr = await mg.from("workout_programs").insert({ gym_id: GYM, trainer_id: mid, name: p2.nome + " (E2E Edit)", objective: p2.objetivo, created_via: "ia", ai_draft: JSON.stringify(p2), reviewed_by: mid }).select("id").single();
  let bad = pr.error?.message ?? null;
  if (!bad) {
    for (let di = 0; di < p2.dias.length && !bad; di++) {
      const day = p2.dias[di];
      const dr = await mg.from("workout_days").insert({ gym_id: GYM, program_id: pr.data.id, name: day.nome, day_order: di + 1 }).select("id").single();
      if (dr.error) { bad = dr.error.message; break; }
      const rows = (day.exercicios ?? []).map((e, k) => ({ gym_id: GYM, day_id: dr.data.id, exercise_id: exIds.get(String(e.exercicio).toLowerCase()) ?? null, sets: e.series, reps: String(e.reps), rest_seconds: parseInt(e.descanso) || 60, ord: k + 1 }));
      const mi = rows.findIndex((r) => !r.exercise_id);
      if (mi >= 0) { bad = "fora da biblioteca: " + day.exercicios[mi].exercicio; break; }
      const wr = await mg.from("workout_exercises").insert(rows);
      if (wr.error) { bad = wr.error.message; break; }
    }
  }
  console.log("3) aprova v2:", bad ? "ERRO " + bad : "OK");
  if (!bad) {
    const sw = await mg.from("student_workouts").insert({ gym_id: GYM, student_id: sid, program_id: pr.data.id, status: "active" });
    console.log("4) atribui v2:", sw.error ? "ERRO " + sw.error.message : "OK");
  }
}
for (const id of [mid, sid]) {
  await admin.from("notifications").delete().eq("user_id", id);
  await admin.from("student_trainers").delete().or(`student_id.eq.${id},trainer_id.eq.${id}`);
  await admin.from("workout_logs").delete().eq("student_id", id);
  await admin.from("leaderboard").delete().eq("student_id", id);
  await admin.from("student_achievements").delete().eq("student_id", id);
  await admin.from("feed_posts").delete().eq("author_id", id);
  const sw = await admin.from("student_workouts").select("program_id").eq("student_id", id);
  for (const r of sw.data ?? []) {
    const dd = await admin.from("workout_days").select("id").eq("program_id", r.program_id);
    const ids = (dd.data ?? []).map((d) => d.id);
    if (ids.length) { await admin.from("workout_exercises").delete().in("day_id", ids); await admin.from("workout_days").delete().in("id", ids); }
    await admin.from("student_workouts").delete().eq("program_id", r.program_id);
    await admin.from("workout_programs").delete().eq("id", r.program_id);
  }
  await admin.auth.admin.deleteUser(id).catch(() => {});
}
console.log("cleanup ok");
process.exit(0);
