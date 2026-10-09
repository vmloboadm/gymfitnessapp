import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import sharp from "sharp";

/**
 * E2E — Frentes do lote:
 *  1) Foto obrigatória: aluno nasce sem foto (gate fechado) → upload /api/avatar → gate abre.
 *  2) Geração de treino com FOCO MULTI ("Braços, Ombros") via /api/assistente (produção).
 *  3) Save igual approvePlan (workout_programs/days/exercises → student_workouts).
 *  4) Aluno lê com RLS exatamente como /treino faz → plano ativo com exercícios.
 * Uso: node scripts/e2e-treino-save.mjs (lê .env.local, como os demais scripts)
 */

const env = {};
for (const line of readFileSync("/root/gymfitnessapp/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = "https://gymfitnesscampos.com.br/app";
const GYM = "00000000-0000-0000-0000-000000000001";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const PERSONAL = { email: "personal-save-e2e@teste.com", password: "E2e#Treino123" };
const ALUNO = { email: "aluno-save-e2e@teste.com", password: "E2e#Treino123" };

const results = [];
function ok(name, cond, extra = "") {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

async function findUser(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return (data.users ?? []).find((u) => u.email === email) ?? null;
}

async function cleanup() {
  for (const email of [PERSONAL.email, ALUNO.email]) {
    const u = await findUser(email).catch(() => null);
    if (u) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  const { data: progs } = await admin
    .from("workout_programs")
    .select("id")
    .eq("gym_id", GYM)
    .like("name", "%E2E Save%");
  for (const p of progs ?? []) {
    const { data: days } = await admin.from("workout_days").select("id").eq("program_id", p.id);
    const dayIds = (days ?? []).map((d) => d.id);
    if (dayIds.length) {
      await admin.from("workout_exercises").delete().in("day_id", dayIds);
      await admin.from("workout_days").delete().in("id", dayIds);
    }
    await admin.from("student_workouts").delete().eq("program_id", p.id);
    await admin.from("workout_programs").delete().eq("id", p.id);
  }
}

function sessionCookie(session) {
  return `sb-jeixbpucnxrhizqpapyv-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
}

function parsePlan(text) {
  try {
    return JSON.parse(text);
  } catch {
    const i = text.indexOf("{");
    const j = text.lastIndexOf("}");
    if (i >= 0 && j > i) return JSON.parse(text.slice(i, j + 1));
    throw new Error("resposta sem JSON: " + text.slice(0, 160));
  }
}

const main = async () => {
  await cleanup();

  // ---------- 1) cria as contas ----------
  const { data: pUser, error: pErr } = await admin.auth.admin.createUser({
    email: PERSONAL.email,
    password: PERSONAL.password,
    email_confirm: true,
  });
  if (pErr) throw new Error("criar personal: " + pErr.message);
  const { data: aUser, error: aErr } = await admin.auth.admin.createUser({
    email: ALUNO.email,
    password: ALUNO.password,
    email_confirm: true,
  });
  if (aErr) throw new Error("criar aluno: " + aErr.message);

  await admin
    .from("profiles")
    .update({ name: "Personal E2E Save", role: "trainer", gym_id: GYM })
    .eq("id", pUser.user.id);
  await admin
    .from("profiles")
    .update({
      name: "Aluno E2E Save",
      role: "student",
      gym_id: GYM,
      approved_at: new Date().toISOString(),
      sex: "M",
      experience_level: "Intermediário",
      available_days: ["Seg", "Qua", "Sex", "Sáb"],
      goal: "Hipertrofia",
      avatar_url: null,
      onboarding_completed: true,
      onboarding_step: 7,
    })
    .eq("id", aUser.user.id);

  // ---------- 2) FOTO: nasce sem foto (gate fechado) ----------
  const { data: before } = await admin.from("profiles").select("avatar_url").eq("id", aUser.user.id).single();
  ok("aluno novo nasce SEM foto (PhotoGate fecha o app)", before?.avatar_url === null, `avatar=${before?.avatar_url}`);

  const { data: aSess, error: aLoginErr } = await admin.auth.signInWithPassword(ALUNO);
  if (aLoginErr) throw new Error("login aluno: " + aLoginErr.message);

  // PNG colorido 640x480 — smart crop da /api/avatar
  const png = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 40, g: 120, b: 220 } },
  })
    .png()
    .toBuffer();
  const fd = new FormData();
  fd.append("file", new File([png], "rosto.png", { type: "image/png" }));
  const upRes = await fetch(`${BASE}/api/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aSess.session.access_token}`,
      Cookie: sessionCookie(aSess.session),
    },
    body: fd,
  });
  const upData = await upRes.json();
  ok("upload /api/avatar (rosto) aceito", upRes.ok && upData.ok === true, upData.error ?? "");

  const { data: after } = await admin.from("profiles").select("avatar_url").eq("id", aUser.user.id).single();
  ok("profiles.avatar_url preenchido → PhotoGate abre", !!after?.avatar_url, after?.avatar_url ?? "");

  // ---------- 3) personal gera treino com FOCO MULTI ----------
  const { data: pSess, error: pLoginErr } = await admin.auth.signInWithPassword(PERSONAL);
  if (pLoginErr) throw new Error("login personal: " + pLoginErr.message);

  const { data: exRows } = await admin.from("exercises").select("id, name, category, muscles").limit(400);
  const exList = exRows ?? [];
  const validNames = exList.map((e) => e.name);
  ok("biblioteca de exercícios carregada", validNames.length > 0, `${validNames.length} nomes`);

  const message = [
    "Aluno: Aluno E2E Save",
    "Objetivo: Hipertrofia",
    "Nível: Intermediário",
    "Frequência: 4 dias",
    "Dias da semana escolhidos pelo aluno: Seg, Qua, Sex, Sáb (nomeie cada dia do plano pelo dia correspondente)",
    "Sexo: Masculino",
    "Nível de experiência: Intermediário",
    "",
    "Pedido do personal: Plano Intermediário para Aluno E2E Save. Objetivo: Hipertrofia. Foco: Braços, Ombros.",
  ].join("\n");

  const t0 = Date.now();
  const genRes = await fetch(`${BASE}/api/assistente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie(pSess.session) },
    body: JSON.stringify({
      message,
      context: "personal",
      extras: {
        "Biblioteca de exercícios (use APENAS estes nomes, exatamente como escritos)":
          validNames.slice(0, 200).join(" | "),
        "Quantidade exata de dias do plano": "4",
      },
    }),
  });
  const genData = await genRes.json();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  ok("geração /api/assistente respondeu ok", genRes.ok && genData.ok === true && !!genData.text, `${secs}s ${genData.error ?? ""}`);
  if (!genData.text) throw new Error("sem texto da IA");

  const plan = parsePlan(genData.text);
  ok("plano é JSON estruturado com dias", Array.isArray(plan?.dias) && plan.dias.length > 0, `${plan.dias?.length ?? 0} dias`);
  ok("4 dias conforme pediu o assistente", plan.dias?.length === 4, `${plan.dias?.length} dias`);

  const flat = (plan.dias ?? []).flatMap((d) => d.exercicios ?? []);
  ok("plano com exercícios", flat.length >= 8, `${flat.length} exercícios`);

  const libSet = new Set(validNames.map((n) => n.toLowerCase()));
  const unknown = flat.filter((e) => !libSet.has(String(e.exercicio).toLowerCase()));
  ok("100% dos exercícios na biblioteca", unknown.length === 0, unknown.slice(0, 3).map((e) => e.exercicio).join(", "));

  const focoMulti = flat.filter((e) =>
    /rosca|tr[ií]ceps|antebrach|eleva[çc][ãa]o lateral|desenvolvimento|supino|pull|remada|delt[oó]ide/i.test(
      String(e.exercicio)
    )
  );
  ok("foco multi (Braços + Ombros) refletido no plano", focoMulti.length >= 2, `${focoMulti.length} exercícios de braços/ombros`);

  // ---------- 4) save (espelha assignReal do approvePlan) ----------
  const { data: prog, error: progErr } = await admin
    .from("workout_programs")
    .insert({
      gym_id: GYM,
      trainer_id: pUser.user.id,
      name: `${plan.nome ?? "Plano E2E"} (E2E Save)`,
      objective: plan.objetivo ?? null,
      created_via: "ia",
      ai_draft: JSON.stringify(plan),
      reviewed_by: pUser.user.id,
    })
    .select("id")
    .single();
  if (progErr) throw new Error("insert program: " + progErr.message);

  const byName = new Map(exList.map((e) => [e.name.toLowerCase(), e.id]));
  const placeholder = exList[0]?.id ?? null;
  for (let di = 0; di < plan.dias.length; di++) {
    const day = plan.dias[di];
    const { data: dayRow, error: dayErr } = await admin
      .from("workout_days")
      .insert({ gym_id: GYM, program_id: prog.id, name: day.nome, day_order: di + 1 })
      .select("id")
      .single();
    if (dayErr || !dayRow) throw new Error("insert day: " + (dayErr?.message ?? "sem id"));
    const rows = (day.exercicios ?? []).map((e, i) => ({
      gym_id: GYM,
      day_id: dayRow.id,
      exercise_id:
        byName.get(String(e.exercicio).toLowerCase()) ??
        byName.get(String(e.exercicio).toLowerCase().split(" ")[0]) ??
        placeholder,
      sets: e.series,
      reps: e.reps,
      rest_seconds: parseInt(e.descanso) || 60,
      rpe: e.rpe,
      notes: String(e.exercicio),
      ord: i + 1,
    }));
    if (rows.length) {
      const { error: wexErr } = await admin.from("workout_exercises").insert(rows);
      if (wexErr) throw new Error("insert exercises: " + wexErr.message);
    }
  }
  const { error: swErr } = await admin
    .from("student_workouts")
    .insert({ gym_id: GYM, student_id: aUser.user.id, program_id: prog.id, status: "active" });
  ok("plano salvo em student_workouts (active)", !swErr, swErr?.message ?? "");

  // ---------- 5) aluno lê como /treino (RLS com JWT do aluno) ----------
  const aluno = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${aSess.session.access_token}` } },
  });
  const { data: sw, error: swE1 } = await aluno
    .from("student_workouts")
    .select("*")
    .eq("student_id", aUser.user.id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  ok("aluno vê o treino ativo (RLS)", !swE1 && !!sw, swE1?.message ?? "");

  if (sw) {
    const [{ data: pr }, { data: days }] = await Promise.all([
      aluno.from("workout_programs").select("id, name, objective").eq("id", sw.program_id).maybeSingle(),
      aluno.from("workout_days").select("id, name, day_order").eq("program_id", sw.program_id).order("day_order"),
    ]);
    ok("aluno lê programa + 4 dias (RLS)", !!pr && (days?.length ?? 0) === 4, `dias=${days?.length ?? 0}`);

    const dayIds = (days ?? []).map((d) => d.id);
    const { data: we, error: weE } = await aluno
      .from("workout_exercises")
      .select("*")
      .in("day_id", dayIds)
      .order("ord");
    ok("aluno lê exercícios do plano (RLS)", !weE && (we?.length ?? 0) >= 8, `${we?.length ?? 0} linhas ${weE?.message ?? ""}`);

    const exIds = [...new Set((we ?? []).map((w) => w.exercise_id).filter(Boolean))];
    const { data: ex, error: exE } = await aluno.from("exercises").select("id, name").in("id", exIds);
    ok("aluno resolve nomes dos exercícios (RLS)", !exE && (ex?.length ?? 0) === exIds.length, `${ex?.length}/${exIds.length}`);
  }

  // ---------- cleanup ----------
  await cleanup();
  console.log("\n" + (results.every((r) => r.pass) ? "TODOS PASS" : "FALHAS: " + results.filter((r) => !r.pass).map((r) => r.name).join(" | ")));
  process.exit(results.every((r) => r.pass) ? 0 : 1);
};

main().catch(async (e) => {
  console.error("ERRO:", e.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
