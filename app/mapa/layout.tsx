import Script from "next/script";

// Google tag (gtag.js) — Google Analytics da pluzy.com.br/mapa.
// Fica restrito ao segmento /mapa (não afeta o jogo hospedado na Vercel).
const GA_ID = "G-KXKDTG3597";

export default function MapaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
