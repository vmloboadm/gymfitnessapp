import test from "node:test";
import assert from "node:assert/strict";
import { guardDevDemo } from "~/lib/dev-demo";

/** Na sessão demo: leitura passa, escrita não chega ao banco. */

function fakeClient() {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select: () => ({ data: [{ ok: true }], error: null }),
        insert: () => {
          calls.push(`insert:${table}`);
          return { data: null, error: null };
        },
      };
    },
    rpc(name: string) {
      calls.push(`rpc:${name}`);
      return Promise.resolve({ data: { ok: true }, error: null });
    },
  };
  return { client, calls };
}

test("insert não chega ao banco e responde vazio", async () => {
  const { client, calls } = fakeClient();
  const g = guardDevDemo(client) as unknown as { from: (t: string) => { insert: (v: unknown) => { eq: () => unknown } } };
  const res = await (g.from("checkins").insert({ a: 1 }) as unknown as Promise<{ data: unknown; error: unknown }>);
  assert.deepEqual(res, { data: null, error: null });
  assert.ok(!calls.includes("insert:checkins"));
});

test("select continua lendo", async () => {
  const { client } = fakeClient();
  const g = guardDevDemo(client) as unknown as { from: (t: string) => { select: () => { data: unknown[] } } };
  assert.deepEqual(g.from("profiles").select().data, [{ ok: true }]);
});

test("função de escrita é bloqueada e função de leitura passa", async () => {
  const { client, calls } = fakeClient();
  const g = guardDevDemo(client) as unknown as { rpc: (n: string, a?: unknown) => Promise<unknown> };
  const w = await g.rpc("send_cheer", { p_to: "x" });
  assert.deepEqual(w, { data: null, error: null });
  const r = await g.rpc("gym_roster", { p_gym_id: "g" });
  assert.deepEqual(r, { data: { ok: true }, error: null });
  assert.ok(!calls.includes("rpc:send_cheer"));
  assert.ok(calls.includes("rpc:gym_roster"));
});
