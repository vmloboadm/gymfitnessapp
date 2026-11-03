/**
 * Monitoramento no servidor (Next 15):
 * - register(): logger.error de rotas/API passa a gravar em app_errors;
 * - onRequestError(): qualquer erro não tratado em página, rota ou
 *   server action também é gravado.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { setErrorSink } = await import("~/lib/logger");
  const { reportServerError } = await import("~/lib/monitoring/server");
  setErrorSink((event, error, data) => {
    void reportServerError(event, error, data);
  });
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("~/lib/monitoring/server");
  const digest = (error as { digest?: string } | null)?.digest;
  // NEXT_REDIRECT / NEXT_NOT_FOUND são controle de fluxo, não erro
  if (digest && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest)) return;
  await reportServerError(
    `server.${context.routeType}`,
    error,
    { method: request.method, route: context.routePath, digest },
    request.path
  );
}
