import test from "node:test";
import assert from "node:assert/strict";
import { withTx } from "./harness.mts";

/**
 * Fila de WhatsApp (migration 077): campanha "treino pronto" para quem está
 * sem ficha. Só quem tem telefone válido + consentimento; 2 por lote,
 * lotes espaçados e só em horário comercial de São Paulo; nunca repete.
 */

type Row = { student_id: string; phone: string; body: string; scheduled_at: string; local_hour: number };

async function rows(q: Parameters<Parameters<typeof withTx>[0]>[0]) {
  return q<Row>(
    `select student_id, phone, body, scheduled_at,
       extract(hour from scheduled_at at time zone 'America/Sao_Paulo')::int local_hour
     from whatsapp_outbox where campaign = 'treino-pronto' order by scheduled_at`
  );
}

test("enfileira só quem está sem ficha, aprovado, com telefone válido e consentimento", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const ok = await h.student(gym, "Ana Lima");
    const semConsent = await h.student(gym, "Bia Sem");
    const semFone = await h.student(gym, "Caio Sem");
    const comFicha = await h.student(gym, "Duda Ficha");
    const semAprovacao = await h.student(gym, "Eva Espera");
    const comLaudo = await h.student(gym, "Fabio Laudo");
    await q("update profiles set phone = '(22) 99800-1111', whatsapp_consent = true where id in ($1, $2)", [ok, comFicha]);
    await q("update profiles set phone = '(22) 99800-2222', whatsapp_consent = false where id = $1", [semConsent]);
    await q("update profiles set phone = null, whatsapp_consent = true where id = $1", [semFone]);
    await q("update profiles set phone = '(22) 99800-3333', whatsapp_consent = true, approved_at = null where id = $1", [semAprovacao]);
    await q(
      "update profiles set phone = '(22) 99800-4444', whatsapp_consent = true, medical_risk = true, status = 'pending_clearance' where id = $1",
      [comLaudo]
    );
    await h.plan(gym, comFicha, ["Seg"]);

    const [r] = await q<{ n: number }>("select public.enqueue_starter_campaign($1, now()) n", [gym]);
    assert.equal(Number(r.n), 1);
    const [row] = await rows(q);
    assert.equal(row.student_id, ok);
    assert.equal(row.phone, "5522998001111");
    assert.match(row.body, /Ana/);
    // agora o CTA leva o link direto do app, onde ele escolhe o treino
    assert.match(row.body, /https:\/\/gymfitnesscampos\.com\.br\/app\/treino/);
    assert.match(row.body, /me diz|me conta|me responde/i);
  });
});

test("2 por lote, lotes com 2h+ de intervalo, tudo entre 9h e 20h", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    for (let i = 0; i < 7; i++) {
      const id = await h.student(gym, `Aluno ${i}`);
      await q("update profiles set phone = $2, whatsapp_consent = true where id = $1", [id, `229980000${i}0`]);
    }
    // começa às 10h de SP de um dia qualquer
    await q("select public.enqueue_starter_campaign($1, '2026-11-04 10:00:00-03')", [gym]);
    const r = await rows(q);
    assert.equal(r.length, 7);
    for (const x of r) assert.ok(x.local_hour >= 9 && x.local_hour < 20, `fora do horário: ${x.local_hour}h`);
    const t = r.map((x) => new Date(x.scheduled_at).getTime());
    // lote 1 = 2 primeiros (até 10 min de diferença); próximo lote 2h+ depois
    assert.ok(t[1] - t[0] <= 10 * 60_000);
    assert.ok(t[2] - t[1] >= 2 * 3_600_000, "lotes precisam de 2h+ de intervalo");
    assert.ok(t[4] - t[3] >= 2 * 3_600_000);
  });
});

test("lote que passaria das 20h vai para o dia seguinte de manhã", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    for (let i = 0; i < 4; i++) {
      const id = await h.student(gym, `Aluno ${i}`);
      await q("update profiles set phone = $2, whatsapp_consent = true where id = $1", [id, `229981000${i}0`]);
    }
    // começa 17h: o primeiro lote é hoje; o seguinte (2h+) já cai depois das 19h
    await q("select public.enqueue_starter_campaign($1, '2026-11-04 17:00:00-03')", [gym]);
    const r = await rows(q);
    const day = (s: string) => new Date(new Date(s).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    assert.equal(day(r[0].scheduled_at), "2026-11-04");
    assert.equal(day(r[2].scheduled_at), "2026-11-05");
    assert.ok(r[2].local_hour >= 9 && r[2].local_hour < 12, "dia seguinte começa de manhã");
  });
});

test("rodar a campanha de novo não manda 2 vezes para a mesma pessoa", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const id = await h.student(gym, "Ana Lima");
    await q("update profiles set phone = '22998001111', whatsapp_consent = true where id = $1", [id]);
    await q("select public.enqueue_starter_campaign($1, now())", [gym]);
    const [r] = await q<{ n: number }>("select public.enqueue_starter_campaign($1, now()) n", [gym]);
    assert.equal(Number(r.n), 0);
    assert.equal((await rows(q)).length, 1);
  });
});

test("app (aluno) não lê nem escreve na fila", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const id = await h.student(gym);
    await h.asApp(id);
    await h.rejects("select * from whatsapp_outbox", [], /permission denied/);
    await h.rejects("select public.enqueue_starter_campaign($1, now())", [gym], /permission denied/);
  });
});

test("domingo não envia e nome em MAIÚSCULAS sai capitalizado", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const id = await h.student(gym, "ROMERO SILVA");
    await q("update profiles set phone = '22998001111', whatsapp_consent = true where id = $1", [id]);
    // domingo 09/11/2026, 10h
    await q("select public.enqueue_starter_campaign($1, '2026-11-09 10:00:00-03')", [gym]);
    const [r] = await rows(q);
    const dow = new Date(new Date(r.scheduled_at).getTime() - 3 * 3_600_000).getUTCDay();
    assert.equal(dow, 1, "domingo passa para segunda");
    assert.match(r.body, /Romero/);
    assert.doesNotMatch(r.body, /ROMERO/);
  });
});

test("variedade: 6 abordagens girando, todas com o link do app", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    for (let i = 0; i < 7; i++) {
      const id = await h.student(gym, `Aluno ${i}`);
      await q("update profiles set phone = $2, whatsapp_consent = true where id = $1", [
        id,
        `2299800${String(i + 1).padStart(4, "0")}`,
      ]);
    }
    const [r] = await q<{ n: number }>("select public.enqueue_starter_campaign($1, now()) n", [gym]);
    assert.equal(Number(r.n), 7);
    const rows = await q<{ body: string }>("select body from whatsapp_outbox order by scheduled_at");
    assert.equal(rows.length, 7);
    for (const row of rows) {
      assert.match(row.body, /https:\/\/gymfitnesscampos\.com\.br\/app\/treino/);
    }
    // 6 variações distintas; a 7ª repete a 1ª
    const primeiras = rows.map((x) => x.body.split("\n")[0]);
    assert.equal(new Set(primeiras).size, 6);
    assert.equal(primeiras[6], primeiras[0]);
  });
});

test("retomada: só quem recebeu há 2+ dias, segue sem ficha e não veio", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const parado = await h.student(gym, "Ana Parada");
    const comFicha = await h.student(gym, "Bia Ficha");
    const veio = await h.student(gym, "Caio Veio");
    const recem = await h.student(gym, "Duda Recente");

    for (const [i, id] of [parado, comFicha, veio, recem].entries()) {
      await q("update profiles set phone = $2, whatsapp_consent = true where id = $1", [id, `2299700${i}00`]);
      await q(
        `insert into whatsapp_outbox (gym_id, student_id, campaign, phone, body, status, sent_at, scheduled_at)
         values ($1, $2, 'treino-pronto', $3, 'oi', 'sent', now() - interval '3 days', now() - interval '3 days')`,
        [gym, id, `552299700${i}00`]
      );
    }
    await h.plan(gym, comFicha, ["Seg"]);
    await q(
      "insert into checkins (gym_id, student_id, checked_at) values ($1, $2, now() - interval '1 day')",
      [gym, veio]
    );
    await q("update whatsapp_outbox set sent_at = now() - interval '1 day' where student_id = $1", [recem]);

    const [r] = await q<{ n: number }>("select public.enqueue_retomada_treino($1, now()) n", [gym]);
    assert.equal(Number(r.n), 1);
    const [row] = await q<{ student_id: string; body: string }>(
      "select student_id, body from whatsapp_outbox where campaign = 'retomada-treino'"
    );
    assert.equal(row.student_id, parado);
    assert.match(row.body, /https:\/\/gymfitnesscampos\.com\.br\/app\/treino/);
  });
});
