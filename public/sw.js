/* GymFitness Service Worker — PWA-first (blueprint §10)
 * Offline shell + cache runtime com estrategia network-first p/ páginas,
 * stale-while-revalidate p/ assets, background sync e escuta de push.
 * BASE-aware: deriva o prefixo (/app) do próprio scope do SW, funcionando
 * tanto na raiz quanto sob basePath.
 */
const CACHE_VERSION = "gymfitness-v50";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

/** Prefixo do app (ex: "/app"). Derivado do scope do registro do SW. */
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

// App shell: o que o PWA precacheia para abrir offline (login + onboarding + treino)
const SHELL_URLS = [
  `${BASE}/`,
  `${BASE}/login`,
  `${BASE}/register`,
  `${BASE}/forgot-password`,
  `${BASE}/onboarding`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca intercede chamadas ao Supabase/OmniRoute — dados sempre da rede
  if (url.origin !== self.location.origin) return;

  // API routes: network-only
  if (url.pathname.startsWith(`${BASE}/api/`)) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // Estáticos imutáveis (chunks JS/CSS/ícones/imagens locais): CACHE-FIRST abre instantâneo
  if (
    url.pathname.startsWith(`${BASE}/_next/static`) ||
    url.pathname.startsWith(`${BASE}/icons`) ||
    url.pathname.startsWith(`${BASE}/workout`) ||
    url.pathname.startsWith(`${BASE}/images`) ||
    url.pathname === `${BASE}/manifest.json`
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return res;
          })
      )
    );
    return;
  }

  // GET navegação/posts: network-first, fallback cache + tollera offline
  if (request.method === "GET") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match(`${BASE}/`);
          }
          return new Response(null, { status: 404 });
        })
    );
  }
});

/* Background sync: ações offline enfileiradas (useOfflineQueue) são
 * sincronizadas quando a conexão voltar (blueprint §5.5). */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-queue") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ type: "SYNC_OFFLINE_QUEUE" });
        });
      })
    );
  }
});

/* Push notifications */
self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "GymFitness", body: "Nova notificação" };
  event.waitUntil(
    self.registration.showNotification(data.title ?? "GymFitness", {
      body: data.body ?? "",
      icon: `${BASE}/icons/icon-192x192.png`,
      badge: `${BASE}/icons/icon-96x96.png`,
      data: { url: data.url ?? `${BASE}/` },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? `${BASE}/`;
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(target);
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(target);
    })
  );
});
