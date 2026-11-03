/**
 * Utilitários dos testes de SQL. Cada teste roda dentro de uma transação
 * que sempre termina em ROLLBACK: um teste nunca enxerga dado de outro.
 * Antes: npm run test:db (já roda scripts/test-db-setup.mjs).
 */
import pg from "pg";
import { randomUUID } from "node:crypto";

const URL_DEFAULT = "postgres://postgres:test@127.0.0.1:54329/gf_test";

export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export async function withTx(fn: (q: Q, h: Helpers) => Promise<void>): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL ?? URL_DEFAULT });
  await client.connect();
  const q: Q = async (sql, params) => (await client.query(sql, params as unknown[])).rows;
  const notices: string[] = [];
  client.on("notice", (n) => notices.push(n.message ?? String(n)));
  try {
    await client.query("begin");
    await client.query("set local timezone = 'UTC'");
    await fn(q, helpers(q, notices));
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

/** Dia de hoje em São Paulo, como o banco calcula. */
export async function todaySP(q: Q): Promise<string> {
  const [r] = await q<{ d: string }>("select to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') d");
  return r.d;
}

/** Dia (YYYY-MM-DD) somado de n dias. */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dia da semana ISO (1=seg … 7=dom) de uma chave YYYY-MM-DD. */
export function isoDow(key: string): number {
  const d = new Date(`${key}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export const DOW_LABEL = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type Helpers = ReturnType<typeof helpers>;

function helpers(q: Q, notices: string[]) {
  let exerciseId: string | null = null;

  return {
    /** Avisos (RAISE WARNING/NOTICE) emitidos pelo banco até agora. */
    warnings(): string[] {
      return [...notices];
    },

    async gym(): Promise<string> {
      const id = randomUUID();
      await q("insert into gyms (id, name, slug) values ($1, 'Academia Teste', $2)", [id, `teste-${id.slice(0, 8)}`]);
      return id;
    },

    async student(gymId: string, name = "Aluno Teste"): Promise<string> {
      const id = randomUUID();
      await q("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@teste.local`]);
      await q(
        "insert into profiles (id, gym_id, name, email, role, approved_at) values ($1, $2, $3, $4, 'student', now())",
        [id, gymId, name, `${id}@teste.local`]
      );
      return id;
    },

    async trainer(gymId: string): Promise<string> {
      const id = randomUUID();
      await q("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@teste.local`]);
      await q(
        "insert into profiles (id, gym_id, name, email, role, approved_at) values ($1, $2, 'Personal Teste', $3, 'trainer', now())",
        [id, gymId, `${id}@teste.local`]
      );
      return id;
    },

    /** Ficha ativa com os dias marcados (ex.: ["Seg","Qua","Sex"]). */
    async plan(gymId: string, studentId: string, days: string[]): Promise<string> {
      const trainer = await this.trainer(gymId);
      const [prog] = await q<{ id: string }>(
        "insert into workout_programs (gym_id, trainer_id, name, ai_draft) values ($1, $2, 'Ficha teste', $3) returning id",
        [gymId, trainer, JSON.stringify({ daysSelected: days })]
      );
      const [sw] = await q<{ id: string }>(
        "insert into student_workouts (gym_id, student_id, program_id, status, assigned_at) values ($1, $2, $3, 'active', now()) returning id",
        [gymId, studentId, prog.id]
      );
      return sw.id;
    },

    /** Grava um exercício feito no dia (meio-dia de São Paulo). */
    async logOn(gymId: string, studentId: string, day: string): Promise<void> {
      if (!exerciseId) {
        const [e] = await q<{ id: string }>(
          "insert into exercises (name, category) values ('Supino teste', 'peito') returning id"
        );
        exerciseId = e.id;
      }
      await q(
        "insert into workout_logs (gym_id, student_id, exercise_id, date) values ($1, $2, $3, ($4::date + time '12:00') at time zone 'America/Sao_Paulo')",
        [gymId, studentId, exerciseId, day]
      );
    },

    /** Age como o usuário logado (auth.uid()) dali em diante na transação. */
    async as(userId: string | null): Promise<void> {
      await q("select set_config('request.jwt.claims', $1, true)", [
        userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
      ]);
    },

    async streak(studentId: string): Promise<number> {
      const [r] = await q<{ s: number }>("select public.day_streak($1) s", [studentId]);
      return Number(r.s);
    },
  };
}
