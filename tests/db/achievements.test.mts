import test from "node:test";
import assert from "node:assert/strict";
import { addDays, todaySP, withTx } from "./harness.mts";

/**
 * Os gatilhos de conquista/ranking/aviso engolem os próprios erros (viram
 * warning). Sem estes testes, uma quebra neles passaria despercebida: o
 * aluno simplesmente deixaria de ganhar conquistas.
 */

const ALL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

async function codes(q: Parameters<Parameters<typeof withTx>[0]>[0], aluno: string): Promise<string[]> {
  const rows = await q<{ code: string }>(
    "select a.code from student_achievements sa join achievements a on a.id = sa.achievement_id where sa.student_id = $1 order by 1",
    [aluno]
  );
  return rows.map((r) => r.code);
}

test("primeiro treino libera 'first_workout', avisa o aluno e posta no feed", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym, "Maria Silva");
    await h.plan(gym, aluno, ALL);
    await h.logOn(gym, aluno, await todaySP(q));

    assert.ok((await codes(q, aluno)).includes("first_workout"));
    const [n] = await q<{ n: number }>(
      "select count(*)::int n from notifications where user_id = $1 and title like 'Conquista liberada:%'", [aluno]
    );
    assert.equal(n.n, 1);
    const [f] = await q<{ body: string }>("select body from feed_posts where author_id = $1 and type = 'conquista'", [aluno]);
    assert.match(f.body, /^Maria S\. fez o primeiro treino!/);
  });
});

test("3 dias seguidos liberam 'streak_3' (sem post no feed)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (const n of [-2, -1, 0]) await h.logOn(gym, aluno, addDays(hoje, n));

    assert.ok((await codes(q, aluno)).includes("streak_3"));
    const [f] = await q<{ n: number }>(
      "select count(*)::int n from feed_posts where author_id = $1 and body like '%3 dias programados%'", [aluno]
    );
    assert.equal(f.n, 0);
  });
});

test("mais exercícios no mesmo dia não duplicam conquista nem aviso", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (let i = 0; i < 5; i++) await h.logOn(gym, aluno, hoje);

    const all = await codes(q, aluno);
    assert.equal(all.filter((c) => c === "first_workout").length, 1);
    // nenhum aviso repetido (cada título aparece 1 vez só)
    const dup = await q<{ title: string; n: number }>(
      "select title, count(*)::int n from notifications where user_id = $1 group by title having count(*) > 1", [aluno]
    );
    assert.deepEqual(dup, []);
  });
});

test("treino gravado entra no ranking da semana", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    await h.logOn(gym, aluno, await todaySP(q));
    const rows = await q<{ rank_type: string }>("select rank_type from leaderboard where student_id = $1", [aluno]);
    assert.ok(rows.length > 0, "aluno deveria aparecer no leaderboard");
  });
});

test("gatilhos de treino não deixam warning escondido (erro engolido)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (const n of [-2, -1, 0]) await h.logOn(gym, aluno, addDays(hoje, n));
    assert.deepEqual(h.warnings(), []);
  });
});
