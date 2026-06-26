import Script from "next/script";

// Google tag (gtag.js) — Google Analytics da pluzy.com.br/mapa.
// Fica restrito ao segmento /mapa (não afeta o jogo hospedado na Vercel).
const GA_ID = "G-KXKDTG3597";

// Auto-cura de cache: o jogo (rota "/") registra um Service Worker com escopo "/"
// que também controla "/mapa" e guarda os chunks em cache. Após um deploy isso
// causa "ChunkLoadError" (HTML novo apontando para chunks que o SW antigo não tem).
// Este script remove qualquer SW e limpa os caches ao abrir o mapa, recarregando
// uma única vez para pegar os arquivos novos. Roda inline (não depende do React).
const LIMPAR_SW = `
(function () {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        var tinha = regs.length > 0;
        Promise.all(regs.map(function (r) { return r.unregister(); })).then(function () {
          var limpar = (window.caches && caches.keys)
            ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
            : Promise.resolve();
          limpar.then(function () {
            if (tinha && !sessionStorage.getItem('mapa_sw_limpo')) {
              sessionStorage.setItem('mapa_sw_limpo', '1');
              location.reload();
            }
          });
        });
      }).catch(function () {});
    }
  } catch (e) {}
})();
`;

export default function MapaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* remove o Service Worker do jogo que quebra os chunks no /mapa */}
      <script dangerouslySetInnerHTML={{ __html: LIMPAR_SW }} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      {children}
    </>
  );
}
