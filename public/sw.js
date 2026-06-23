// Service Worker do Arraiá do Tesouro (Next.js).
// Estratégia leve: network-first para navegação/HTML (correções chegam no
// próximo load), cache-first com revalidação para assets estáticos. Chamadas
// ao Supabase nunca passam pelo cache.
const CACHE = "arraia-next-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (/supabase\.(co|in)$/.test(url.hostname)) return; // ranking/cartões: sempre rede

  const isDoc = request.mode === "navigate" || request.destination === "document";
  if (isDoc) {
    event.respondWith(
      fetch(request)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(request, c)); return res; })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request).then((res) => {
        if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(request, c)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
