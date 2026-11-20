"use client";

/**
 * Acesso demo (só você abre, com a sua senha). Nesta sessão o app LÊ os dados
 * reais normalmente, mas NADA é gravado: inserts, updates, deletes e as funções
 * de escrita do banco viram no-op no cliente.
 */
const FLAG = "gf-dev-demo";

export function isDevDemo(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function setDevDemo(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(FLAG, "1");
    else window.sessionStorage.removeItem(FLAG);
  } catch {
    /* navegador sem sessionStorage: a sessão demo simplesmente não fica marcada */
  }
}

/** Nomes de funções do banco que gravam. Qualquer um destes vira no-op no modo demo. */
const WRITE_RPC =
  /^(set_|send_|invite_|save_|create_|update_|delete_|register_|finish_|complete_|check|log_|add_|apply_|assign_|challenge_|auto_close|submit|approve|accept|reject|mark_|toggle_|post_|upsert_|remove_|join_|leave_|record_|start_|end_|close_|open_|cancel|book|reserve|generate|sync|enqueue|queue|touch|cheer|claim|redeem|pay|subscribe|unsubscribe|request_|respond|update|insert|move_|reorder|archive|restore|import)/;

const WRITE_METHODS = new Set(["insert", "upsert", "update", "delete"]);

/** Resposta vazia e sem erro, encadeável (.eq(), .select(), .single()...). */
function noop(): unknown {
  const result = { data: null, error: null };
  const chain: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
      if (prop === "catch") return () => Promise.resolve(result);
      if (prop === "finally") return (fn: () => void) => Promise.resolve(result).finally(fn);
      return () => chain;
    },
    apply() {
      return chain;
    },
  });
  return chain;
}

/** Envolve o cliente do Supabase: leitura passa, escrita não chega ao banco. */
export function guardDevDemo<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "from") {
        return (table: string) => {
          const builder = (target as unknown as { from: (t: string) => object }).from(table);
          return new Proxy(builder, {
            get(b, p) {
              if (typeof p === "string" && WRITE_METHODS.has(p)) return () => noop();
              const v = Reflect.get(b, p, b);
              return typeof v === "function" ? v.bind(b) : v;
            },
          });
        };
      }
      if (prop === "rpc") {
        return (name: string, args?: unknown, opts?: unknown) =>
          WRITE_RPC.test(name)
            ? noop()
            : (target as unknown as { rpc: (n: string, a?: unknown, o?: unknown) => unknown }).rpc(name, args, opts);
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}
