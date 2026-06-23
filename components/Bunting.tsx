import { memo } from "react";

// SVG gerado uma vez. O componente é memoizado e SEM props, então renderiza
// só na montagem e nunca reage aos re-renders do jogo (cronômetro etc.) —
// evita a animação de entrada reiniciar em loop.
function buntingSvg() {
  // cores do convite Festa Junina Marista 2026: vermelho, amarelo, rosa, ciano, roxo
  const cols = ["#e23b2e", "#f9c21a", "#e84c97", "#28a8e0", "#6e5ba6"];
  const W = 520, H = 48, n = 12, gap = W / n, top = 5, sag = 15;
  const yAt = (x: number) => { const t = x / W; return top + sag * 4 * t * (1 - t); };
  let cord = "M0 " + top.toFixed(1);
  for (let x = 0; x <= W; x += 24) cord += " L" + x + " " + yAt(x).toFixed(1);
  cord += " L" + W + " " + top.toFixed(1);
  const fw = gap * 0.84, fh = 27, notch = 9;
  let flags = "";
  for (let i = 0; i < n; i++) {
    const ax = gap * (i + 0.5), ay = yAt(ax);
    const l = (ax - fw / 2).toFixed(1), r = (ax + fw / 2).toFixed(1);
    const t = ay.toFixed(1), b = (ay + fh).toFixed(1), nb = (ay + fh - notch).toFixed(1);
    const c = cols[i % cols.length];
    flags += `<g class="flag" style="animation-delay:${(i * 0.11).toFixed(2)}s;transform-origin:${ax.toFixed(1)}px ${t}px">
      <path d="M${l} ${t} L${r} ${t} L${r} ${b} L${ax.toFixed(1)} ${nb} L${l} ${b} Z" fill="${c}" stroke="rgba(0,0,0,.16)" stroke-width="1"/>
      <path d="M${l} ${t} L${r} ${t} L${r} ${(ay + 4).toFixed(1)} L${l} ${(ay + 4).toFixed(1)} Z" fill="rgba(255,255,255,.30)"/>
      <path d="M${ax.toFixed(1)} ${t} L${r} ${t} L${r} ${b} L${ax.toFixed(1)} ${nb} Z" fill="rgba(0,0,0,.10)"/>
    </g>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path d="${cord}" stroke="#d9b85a" stroke-width="2.2" fill="none" stroke-linecap="round"/>${flags}</svg>`;
}

function Bunting() {
  return <div className="bunting noprint" dangerouslySetInnerHTML={{ __html: buntingSvg() }} />;
}

export default memo(Bunting);
