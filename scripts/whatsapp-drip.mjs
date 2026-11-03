/**
 * Enviador da fila de WhatsApp (tabela whatsapp_outbox, migration 077).
 * Roda NA VPS (o WAHA do CRM não é exposto para fora). A cada execução:
 *   - só envia entre 9h e 20h de São Paulo;
 *   - pega no máximo 2 mensagens vencidas;
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

const { rows } = await db.query(
  `select o.id, o.student_id, o.phone, o.body, o.campaign
   from whatsapp_outbox o
   where o.status = 'pending' and o.scheduled_at <= now()
   order by o.scheduled_at limit 2`
);

for (const [idx, m] of rows.entries()) {
  // confere de novo na hora: quem já escolheu treino ou tirou consentimento não recebe
  const { rows: chk } = await db.query(
    `select coalesce(p.whatsapp_consent, false) consent,
       exists (select 1 from student_workouts sw where sw.student_id = p.id and sw.status = 'active') has_plan
     from profiles p where p.id = $1`,
    [m.student_id]
  );
  const c = chk[0];
  if (!c || !c.consent || (m.campaign === "treino-pronto" && c.has_plan)) {
    await db.query("update whatsapp_outbox set status = 'skipped', error = $2 where id = $1", [
      m.id,
      !c ? "aluno removido" : !c.consent ? "sem consentimento" : "já tem treino",
    ]);
    console.log(stamp(), "pulado", m.id);
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
  } catch (err) {
    await db.query("update whatsapp_outbox set status = 'failed', error = $2 where id = $1", [m.id, String(err).slice(0, 300)]);
    console.log(stamp(), "erro", m.id, String(err).slice(0, 200));
  }
  if (idx < rows.length - 1) await sleep(rand(60_000, 180_000)); // 1 a 3 min entre os dois
}

await db.end();
