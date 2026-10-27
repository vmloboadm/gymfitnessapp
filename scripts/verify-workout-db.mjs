#!/usr/bin/env node
/**
 * Contrato do banco para o fluxo de treino.
 * Falha antes da migration e passa depois. Não deixa dados de teste:
 * os inserts rodam em transação e terminam em ROLLBACK.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 6543),
  user: env.SUPABASE_DB_USER || "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

await client.connect();
try {
  const cols = await client.query(`
    select column_name, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_logs'
  `);
  const col = new Map(cols.rows.map((r) => [r.column_name, r]));
  check(col.has("workout_session_id"), "workout_logs.workout_session_id não existe");
  check(col.get("workout_session_id")?.is_nullable === "YES", "workout_session_id deveria aceitar null (treino sem sessão de banco)");

  const fks = await client.query(`
    select conname, confrelid::regclass::text as target
    from pg_constraint
    where conrelid = 'public.workout_logs'::regclass and contype = 'f'
  `);
  const fk = new Map(fks.rows.map((r) => [r.conname, r.target]));
  check(fk.get("workout_logs_workout_session_id_fkey") === "workout_sessions", "FK workout_logs.workout_session_id não aponta para workout_sessions");
  check(fk.get("workout_logs_session_id_fkey") === "equipment_sessions", "FK workout_logs.session_id deveria continuar em equipment_sessions");

  const slotFks = await client.query(`
    select conname, confrelid::regclass::text as target
    from pg_constraint
    where conrelid = 'public.slot_checks'::regclass and contype = 'f'
  `);
  const slotFk = new Map(slotFks.rows.map((r) => [r.conname, r.target]));
  check(slotFk.get("slot_checks_program_id_fkey") === "workout_programs", "slot_checks.program_id deveria apontar para workout_programs");

  const sample = await client.query(`
    select sw.id as workout_id, sw.program_id, sw.student_id, sw.gym_id, we.exercise_id
    from public.student_workouts sw
    join public.workout_days wd on wd.program_id = sw.program_id
    join public.workout_exercises we on we.day_id = wd.id
    where sw.status = 'active'
    limit 1
  `);
  if (!sample.rows[0]) {
    failures.push("sem plano ativo para o teste transacional");
  } else {
    const s = sample.rows[0];
    await client.query("begin");
    try {
      const sess = await client.query(`
        insert into public.workout_sessions (gym_id, student_id, workout_id, status, meta)
        values ($1, $2, $3, 'active', '{"test":true}'::jsonb) returning id
      `, [s.gym_id, s.student_id, s.workout_id]);
      const sid = sess.rows[0].id;
      await client.query(`
        insert into public.workout_logs
          (gym_id, student_id, workout_id, workout_session_id, exercise_id, weight_kg, reps)
        values ($1, $2, $3, $4, $5, 10, 8)
      `, [s.gym_id, s.student_id, s.workout_id, sid, s.exercise_id]);
      await client.query(`
        insert into public.slot_checks (gym_id, student_id, program_id, slot)
        values ($1, $2, $3, 'A')
      `, [s.gym_id, s.student_id, s.program_id]);
      const joined = await client.query(`
        select wl.id, ws.id as session_id
        from public.workout_logs wl
        join public.workout_sessions ws on ws.id = wl.workout_session_id
        where wl.workout_session_id = $1
      `, [sid]);
      check(joined.rows.length === 1, "log não ficou ligado à sessão de treino");
    } finally {
      await client.query("rollback");
    }
  }
} finally {
  await client.end();
}

if (failures.length) {
  console.error("FAIL verificação do banco:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log("PASS verificação do banco: logs, sessão e slot checks no contrato certo.");
