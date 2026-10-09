import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * E2E gamificação (motores do banco + leitura RLS-real como aluno):
 *  1) conclude de treino (insert workout_logs) acende leaderboard da semana.
 *  2) 7 dias seguidos disparam "Sequência de 7 dias" + meta da semana.
 *  3) aluno novo avisa o staff; aprovação avisa o aluno.
 *  4) gym_roster mostra nome/foto de todos (RLS de profiles é fechada).
 *  5) seeds do feed visíveis para o aluno.
 * Uso: node scripts/e2e-gamificacao.mjs (lê .env.local)
 */

const env = {};
for (const line of readFileSync("/root/gymfitnessapp/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const GYM = "00000000-0000-0000-0000-000000000001";
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
function ok(name, cond, extra = "") {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const A1 = { email: "game-um-e2e@teste.com", password: "E2e#Game123" };
const A2 = { email: "game-dois-e2e@teste.com", password: "E2e#Game123" };

async function findUser(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data.users ?? []).find((u) => u.email === email) ?? null;
}

async function cleanup(ids) {
  await admin.from("notifications").delete().in("user_id", ids);
  await admin.from("notifications").delete().like("body", "%E2E Game%");
  await admin.from("workout_logs").delete().in("student_id", ids);
  await admin.from("leaderboard").delete().in("student_id", ids);
  for (const email of [A1.email, A2.email]) {
    const u = await findUser(email).catch(() => null);
    if (u) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
}

const main = async () => {
  await cleanup([]);
  const ids = [];

  // ---------- aluno 1: streak de 7 dias + meta de 1 treino/semana ----------
  const { data: u1 } = await admin.auth.admin.createUser({
    email: A1.email, password: A1.password, email_confirm: true,
    user_metadata: { name: "Aluno E2E Game Um" },
  });
  ids.push(u1.user.id);
  await admin.from("profiles").update({
    name: "Aluno E2E Game Um", role: "student", gym_id: GYM,
    approved_at: new Date().toISOString(), onboarding_completed: true,
    available_days: ["Seg"], avatar_url: null,
  }).eq("id", u1.user.id);

  const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s1, error: loginErr } = await anon.auth.signInWithPassword(A1);
  if (loginErr) throw new Error("login: " + loginErr.message);
  const stu = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${s1.session.access_token}` } },
  });

  const { data: ex } = await admin.from("exercises").select("id").limit(1);
  const exId = ex[0].id;
  // 6 dias passados + hoje (1 linha/dia, como o conclude gravaria)
  for (let back = 6; back >= 0; back--) {
    const d = new Date(Date.now() - back * 86400000).toISOString();
    const { error } = await stu.from("workout_logs").insert({
      gym_id: GYM, student_id: u1.user.id, workout_id: null,
      exercise_id: exId, date: d, reps: 10, rpe: 8,
    });
    if (error) throw new Error(`insert dia -${back}: ` + error.message);
  }
  const { data: logs } = await stu.from("workout_logs").select("date").eq("student_id", u1.user.id);
  ok("7 dias de treino gravados pelo aluno (RLS)", (logs ?? []).length === 7, `${(logs ?? []).length} linhas`);

  const monday = (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); })();
  const { data: lb } = await stu.from("leaderboard")
    .select("sessions, points, streak").eq("student_id", u1.user.id)
    .eq("gym_id", GYM).eq("week_start", monday).eq("rank_type", "load").maybeSingle();
  ok("leaderboard da semana acendeu (trigger)", !!lb && lb.sessions >= 1 && lb.points > 0, lb ? `sessions=${lb.sessions} pts=${lb.points} streak=${lb.streak}` : "sem linha");
  ok("streak 7 gravado no leaderboard", lb?.streak === 7, `streak=${lb?.streak}`);

  const { data: notifs } = await stu.from("notifications").select("title").eq("user_id", u1.user.id);
  const titles = (notifs ?? []).map((n) => n.title);
  const metas = titles.filter((t) => t === "Meta da semana batida").length;
  ok("meta da semana avisa uma vez só (sem spam)", metas === 1, `${metas}x`);
  ok("notificação da sequência de 7 dias", titles.includes("Sequência de 7 dias"), titles.join(" | "));

  // ---------- roster + feed como aluno ----------
  const roster = await stu.rpc("gym_roster", { p_gym_id: GYM });
  const mates = roster.data ?? [];
  const me = mates.find((m) => m.id === u1.user.id);
  ok("gym_roster lista membros com nome (RLS-safe)", !roster.error && mates.length > 1 && !!me?.name, `${mates.length} membros`);
  const feed = await stu.from("feed_posts").select("id, type").eq("gym_id", GYM).limit(30);
  ok("posts da academia visíveis no feed", !feed.error && (feed.data ?? []).length >= 3, `${(feed.data ?? []).length} posts`);

  // ---------- aluno 2: ciclo de vida (staff avisado, aluno avisado) ----------
  const { data: u2 } = await admin.auth.admin.createUser({
    email: A2.email, password: A2.password, email_confirm: true,
    user_metadata: { name: "Aluno E2E Game Dois" },
  });
  ids.push(u2.user.id);
  await admin.from("profiles").update({
    name: "Aluno E2E Game Dois", role: "student", gym_id: GYM, onboarding_completed: false,
  }).eq("id", u2.user.id);
  const { data: staffNotif } = await admin.from("notifications").select("id")
    .like("body", "%Aluno E2E Game Dois%").limit(5);
  ok("staff avisado do aluno novo", (staffNotif ?? []).length >= 1, `${(staffNotif ?? []).length} avisos`);
  await admin.from("profiles").update({ approved_at: new Date().toISOString(), onboarding_completed: true }).eq("id", u2.user.id);
  const { data: okNotif } = await admin.from("notifications").select("title").eq("user_id", u2.user.id);
  ok("aluno avisado da aprovação", (okNotif ?? []).some((n) => n.title === "Cadastro aprovado"));

  await cleanup(ids);
  const left = await findUser(A1.email).catch(() => null);
  ok("cleanup zerou os testes", !left, "");
  console.log("\n" + (results.every((r) => r.pass) ? "TODOS PASS" : "FALHAS: " + results.filter((r) => !r.pass).map((r) => r.name).join(" | ")));
  process.exit(results.every((r) => r.pass) ? 0 : 1);
};

main().catch(async (e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
