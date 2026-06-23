// Service Worker do Arraiá do Tesouro.
// Cache "app shell" + bibliotecas de CDN para o jogo funcionar offline
// (importante numa festa onde o sinal costuma falhar).
const CACHE = "arraia-tesouro-v8";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll falha tudo se um item falhar; usamos add individual tolerante
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => console.warn("SW: falhou cache de", url))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Para o HTML (navegação) usamos NETWORK-FIRST: assim, online, o aparelho
// sempre pega a versão mais nova do app (correções chegam no próximo reload),
// caindo pro cache só quando estiver offline.
// Para os demais arquivos (libs, ícones) seguimos CACHE-FIRST com revalidação.
function isHtmlRequest(request) {
  return request.mode === "navigate" ||
    (request.destination === "document") ||
    /\/$|\.html(\?|$)/.test(new URL(request.url).pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Supabase (ranking ao vivo): sempre rede, nunca cache (evita ranking velho)
  if (/supabase\.(co|in)$/.test(new URL(request.url).hostname)) return;

  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // cache-first + revalidação em segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
