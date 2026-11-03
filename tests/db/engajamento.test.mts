import test from "node:test";
import assert from "node:assert/strict";
import { addDays, todaySP, withTx, type Q } from "./harness.mts";

/**
 * Conquistas de verdade (migration 071): toda conquista vai pro feed, dá os
 * pontos do catálogo e gera UM aviso no sininho. Recorde pessoal vira post.
 */

const ALL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

async function codes(q: Q, aluno: string): Promise<string[]> {
  const rows = await q<{ code: string }>(
    "select a.code from student_achievements sa join achievements a on a.id = sa.achievement_id where sa.student_id = $1 order by 1",
    [aluno]
  );
  return rows.map((r) => r.code);
}

async function exercise(q: Q, name: string): Promise<string> {
  const [e] = await q<{ id: string }>("insert into exercises (name, category) values ($1, 'peito') returning id", [name]);
  return e.id;
}

async function log(q: Q, gym: string, aluno: string, ex: string, day: string, kg: number, reps = 10) {
  await q(
    "insert into workout_logs (gym_id, student_id, exercise_id, date, weight_kg, reps) values ($1, $2, $3, ($4::date + time '12:00') at time zone 'America/Sao_Paulo', $5, $6)",
    [gym, aluno, ex, day, kg, reps]
  );
}

test("conquista credita os pontos do catálogo (Primeiro treino = 50)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    await h.logOn(gym, aluno, await todaySP(q));
    const rows = await q<{ source: string; points: number }>(
      "select source, points from point_events where student_id = $1 order by points desc", [aluno]
    );
    assert.deepEqual(rows, [{ source: "achievement", points: 50 }]);
  });
});

test("post automático da conquista não conta como 'postar no feed'", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    await h.logOn(gym, aluno, await todaySP(q));
    const [n] = await q<{ n: number }>("select count(*)::int n from point_events where student_id = $1 and source = 'feed_post'", [aluno]);
    assert.equal(n.n, 0);
  });
});

test("post feito pelo aluno continua valendo 10 pontos", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await q("insert into feed_posts (gym_id, author_id, type, body) values ($1, $2, 'geral', 'bora!')", [gym, aluno]);
    const [p] = await q<{ points: number }>("select points from point_events where student_id = $1 and source = 'feed_post'", [aluno]);
    assert.equal(p.points, 10);
  });
});

test("um aviso só por conquista, já com os pontos", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    await h.logOn(gym, aluno, await todaySP(q));
    const rows = await q<{ title: string; body: string }>(
      "select title, body from notifications where user_id = $1 and title <> 'Novo treino liberado' order by created_at", [aluno]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Conquista liberada: Primeiro treino");
    assert.match(rows[0].body, /\+50 pontos/);
  });
});

test("toda conquista vai pro feed, inclusive o raio de 3 dias", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym, "João Pereira");
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (const n of [-2, -1, 0]) await h.logOn(gym, aluno, addDays(hoje, n));
    const posts = await q<{ body: string }>("select body from feed_posts where author_id = $1 and type = 'conquista'", [aluno]);
    assert.ok(posts.some((p) => /Raio de 3 dias/.test(p.body)), JSON.stringify(posts));
  });
});

test("primeiro check-in libera a conquista e posta no feed", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);
    await q("select public.start_checkin('qrcode')");
    assert.ok((await codes(q, aluno)).includes("first_checkin"));
    const [f] = await q<{ n: number }>("select count(*)::int n from feed_posts where author_id = $1 and body like '%Primeiro check-in%'", [aluno]);
    assert.equal(f.n, 1);
  });
});

test("recorde pessoal: carga maior que a anterior no mesmo exercício vira post", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym, "Ana Costa");
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    const supino = await exercise(q, "Supino reto");
    await log(q, gym, aluno, supino, addDays(hoje, -3), 40);
    await log(q, gym, aluno, supino, hoje, 45);

    assert.ok((await codes(q, aluno)).includes("pr_new_record"));
    const posts = await q<{ body: string }>("select body from feed_posts where author_id = $1 and body like '%recorde%'", [aluno]);
    assert.ok(posts.some((p) => /Supino reto/.test(p.body) && /45 ?kg/.test(p.body)), JSON.stringify(posts));
  });
});

test("primeira vez num exercício não é recorde", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    await log(q, gym, aluno, await exercise(q, "Remada"), await todaySP(q), 60);
    assert.ok(!(await codes(q, aluno)).includes("pr_new_record"));
  });
});

test("no máximo 1 post de recorde por dia", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    const a = await exercise(q, "Supino");
    const b = await exercise(q, "Agachamento");
    await log(q, gym, aluno, a, addDays(hoje, -2), 40);
    await log(q, gym, aluno, b, addDays(hoje, -2), 80);
    await log(q, gym, aluno, a, hoje, 50);
    await log(q, gym, aluno, b, hoje, 90);
    const [n] = await q<{ n: number }>(
      "select count(*)::int n from feed_posts where author_id = $1 and body like '%novo recorde%'", [aluno]
    );
    assert.equal(n.n, 1);
  });
});

test("10.000 kg de volume na semana liberam 'Pesos pesados'", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    const ex = await exercise(q, "Leg press");
    // 5 séries de 200 kg x 10 = 10.000 kg hoje
    for (let i = 0; i < 5; i++) await log(q, gym, aluno, ex, hoje, 200, 10);
    assert.ok((await codes(q, aluno)).includes("volume_10k"));
  });
});

test("aviso novo fica marcado como pendente de push", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    const [n] = await q<{ pushed_at: string | null }>(
      "insert into notifications (gym_id, user_id, title, body) values ($1, $2, 'Teste', 'oi') returning pushed_at", [gym, aluno]
    );
    assert.equal(n.pushed_at, null);
    assert.deepEqual(h.warnings(), []);
  });
});
