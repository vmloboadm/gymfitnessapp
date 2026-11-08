/**
 * Enviador da fila de WhatsApp (tabela whatsapp_outbox, migration 077).
 * Roda NA VPS (o WAHA do CRM não é exposto para fora). A cada execução:
 *   - só envia entre 9h e 20h de São Paulo;
 *   - pega no máximo 2 mensagens vencidas e respeita o teto diário
 *     (GF_DAILY_CAP, padrão 25) — número quente, usado por humano e pela IA;
 *   - se as últimas 5 tentativas falharam, para por segurança;
 *   - antes de enviar, confere de novo: aluno ainda sem ficha? ainda com
 *     consentimento? número existe no WhatsApp?
 *   - simula "digitando…", envia pela sessão do número da academia e marca.
 *
 * Uso: node scripts/whatsapp-drip.mjs [--dry-run] [--test-to=55DDNNNNNNNNN]
 * Env: GF_WAHA_URL, GF_WAHA_KEY, GF_WAHA_SESSION (o .sh preenche a partir do CRM)
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const TEST_TO = process.argv.find((a) => a.startsWith("--test-to="))?.split("=")[1];

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const WAHA = process.env.GF_WAHA_URL;
const KEY = process.env.GF_WAHA_KEY;
const SESSION = process.env.GF_WAHA_SESSION;
if (!WAHA || !KEY || !SESSION) {
  console.error("faltou GF_WAHA_URL / GF_WAHA_KEY / GF_WAHA_SESSION");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));
const stamp = () => new Date().toISOString();

async function waha(path, body) {
  const res = await fetch(`${WAHA}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WAHA ${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send(phone, text) {
  const exists = await waha(`/api/contacts/check-exists?phone=${phone}&session=${SESSION}`);
  if (!exists?.numberExists) return { ok: false, error: "número sem WhatsApp" };
  const chatId = exists.chatId ?? `${phone}@c.us`;
  if (DRY) return { ok: true, dry: true };
  await waha("/api/startTyping", { session: SESSION, chatId }).catch(() => {});
  await sleep(rand(3000, 7000));
  await waha("/api/sendText", { session: SESSION, chatId, text });
  await waha("/api/stopTyping", { session: SESSION, chatId }).catch(() => {});
  return { ok: true };
}

function spHour() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

const status = await waha(`/api/sessions/${SESSION}`);
if (status?.status !== "WORKING") {
  console.error(stamp(), "sessão do WhatsApp não está WORKING:", status?.status);
  process.exit(1);
}

if (TEST_TO) {
  const r = await send(TEST_TO, "Teste do envio automático da GymFitness ✅ (pode ignorar)");
  console.log(stamp(), "teste →", TEST_TO.slice(0, 6) + "…", JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}

const h = spHour();
if (h < 9 || h >= 20) {
  console.log(stamp(), `fora do horário (${h}h em SP), nada enviado`);
  process.exit(0);
}

const db = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await db.connect();

// Teto diário de campanha: nunca passar de ~20-30 mensagens/dia no mesmo número
// (recomendação para número usado por humano e pela IA).
const CAP_DIARIO = Number(process.env.GF_DAILY_CAP ?? 25);
const { rows: hojeRows } = await db.query(
  `select count(*)::int n from whatsapp_outbox
   where status = 'sent'
     and (sent_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date`
);
const enviadosHoje = hojeRows[0]?.n ?? 0;
if (enviadosHoje >= CAP_DIARIO) {
  console.log(stamp(), `teto diário atingido (${enviadosHoje}/${CAP_DIARIO}), nada enviado`);
  await db.end();
  process.exit(0);
}

// Freio de falhas: se as últimas 5 tentativas falharam, insistir só piora a
// situação do número. Para em vez de tentar de novo.
const { rows: ultimas } = await db.query(
  `select status from whatsapp_outbox
   where status in ('sent', 'failed')
   order by coalesce(sent_at, scheduled_at) desc
   limit 5`
);
if (ultimas.length === 5 && ultimas.every((r) => r.status === "failed")) {
  console.error(stamp(), "as últimas 5 tentativas falharam — parando por segurança (confira a sessão/número)");
  await db.end();
  process.exit(1);
}

const { rows } = await db.query(
  `select o.id, o.student_id, o.phone, o.body, o.campaign
   from whatsapp_outbox o
   where o.status = 'pending' and o.scheduled_at <= now()
   order by o.scheduled_at limit $1`,
  [Math.min(2, CAP_DIARIO - enviadosHoje)]
);

let enviadosAgora = 0;
for (const [idx, m] of rows.entries()) {
  // confere de novo na hora: quem já escolheu treino ou tirou consentimento não recebe
  const { rows: chk } = await db.query(
    `select coalesce(p.whatsapp_consent, false) consent, p.status = 'pending_clearance' medical,
       p.approved_at is not null approved,
       exists (select 1 from student_workouts sw where sw.student_id = p.id and sw.status = 'active') has_plan,
       exists (select 1 from challenge_participants cp
               where cp.student_id = p.id and 'desafio:' || cp.challenge_id = $2) joined
     from profiles p where p.id = $1`,
    [m.student_id, m.campaign]
  );
  const c = chk[0];
  // campanhas de treino não servem para quem ainda não foi aprovado (o app
  // recusa a escolha) nem para quem precisa de laudo
  const treino = m.campaign === "treino-pronto" || m.campaign === "retomada-treino";
  const already =
    (treino && (c?.has_plan || c?.medical || !c?.approved)) ||
    (m.campaign.startsWith("desafio:") && c?.joined);
  if (!c || !c.consent || already) {
    await db.query("update whatsapp_outbox set status = 'skipped', error = $2 where id = $1", [
      m.id,
      !c
        ? "aluno removido"
        : !c.consent
          ? "sem consentimento"
          : treino && !c.approved
            ? "cadastro aguardando aprovação"
            : treino && c.medical
              ? "aguardando laudo"
              : "já fez (treino/desafio)",
    ]);
    console.log(stamp(), "pulado", m.id);
    continue;
  }

  // Convite do desafio só depois que o aluno já tem ficha: não adianta chamar
  // para o desafio quem ainda não consegue treinar. Empurra 3 dias e tenta de
  // novo, em horário comercial.
  if (m.campaign.startsWith("desafio:") && !c.has_plan) {
    if (DRY) {
      console.log(stamp(), "[dry-run] adiaria 3 dias (sem ficha)", m.id);
    } else {
      await db.query(
        "update whatsapp_outbox set scheduled_at = public.next_business_slot(now() + interval '3 days') where id = $1",
        [m.id]
      );
      console.log(stamp(), "adiado 3 dias (sem ficha)", m.id);
    }
    continue;
  }

  // Retomada de treino só para quem ainda tem ficha ativa.
  if (m.campaign.startsWith("volta-treino") && (!c.approved || c.medical || !c.has_plan)) {
    await db.query("update whatsapp_outbox set status = 'skipped', error = $2 where id = $1", [
      m.id,
      !c.has_plan ? "sem ficha ativa" : "cadastro aguardando aprovação",
    ]);
    console.log(stamp(), "pulado (retomada sem ficha)", m.id);
    continue;
  }
  try {
    const r = await send(m.phone, m.body);
    if (DRY) {
      console.log(stamp(), "[dry-run] enviaria", m.id, "→", m.phone.slice(0, 6) + "…");
      continue;
    }
    await db.query(
      r.ok
        ? "update whatsapp_outbox set status = 'sent', sent_at = now(), error = null where id = $1"
        : "update whatsapp_outbox set status = 'failed', error = $2 where id = $1",
      r.ok ? [m.id] : [m.id, r.error]
    );
    console.log(stamp(), r.ok ? "enviado" : "falhou", m.id, r.error ?? "");
    if (r.ok) enviadosAgora++;
  } catch (err) {
    await db.query("update whatsapp_outbox set status = 'failed', error = $2 where id = $1", [m.id, String(err).slice(0, 300)]);
    console.log(stamp(), "erro", m.id, String(err).slice(0, 200));
  }
  if (idx < rows.length - 1) await sleep(rand(60_000, 180_000)); // 1 a 3 min entre os dois
}

console.log(stamp(), `dia: ${enviadosHoje + enviadosAgora}/${CAP_DIARIO} mensagens de campanha`);

await db.end();
