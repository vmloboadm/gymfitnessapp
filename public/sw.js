/* GymFitness Service Worker — PWA-first (blueprint §10)
 * Offline shell + cache runtime com estrategia network-first p/ páginas,
 * stale-while-revalidate p/ assets, background sync e escuta de push.
 */
const CACHE_VERSION = "gymfitness-v17";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// App shell: o que o PWA precacheia para abrir offline (login + onboarding + treino)
const SHELL_URLS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/onboarding",
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
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
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
            return caches.match("/");
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
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(url);
    })
  );
});