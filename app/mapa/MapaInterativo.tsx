"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./mapa.module.css";
import {
  ASSETS,
  cardapio,
  ginasioPontos,
  horaParaMinutos,
  mapaPontos,
  programacao,
  type Hotspot,
  type Screen,
} from "./data";

const SCREENS: Screen[] = ["capa", "mapa", "ginasio", "programacao", "cardapio"];

const SACOLA_KEY = "festa_sacola_v1";

// pontos do mapa que oferecem um atalho contextual para o cardápio
const VER_CARDAPIO = new Set(["praca", "bebidas", "inflaveis", "brincadeiras"]);
// pontos que oferecem atalho para a programação
const VER_PROGRAMACAO = new Set(["quadra", "concentracao", "entrada-alunos"]);

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°\s]/g, "")
    .toLowerCase();

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function compartilhar(texto: string) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  try {
    if (navigator.share) {
      await navigator.share({ title: "Festa Junina 2026 · Colégio Marista", text: texto, url });
    } else {
      await navigator.clipboard.writeText(`${texto}\n${url}`);
      alert("Copiado para a área de transferência! ✅");
    }
  } catch {
    /* usuário cancelou — sem problema */
  }
}

/* ───────────────────────── Tela cheia (modo quiosque) ───────────────────────── */
type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FsDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}
function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsEl;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}
async function enterFullscreen() {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {
    /* o navegador pode recusar — sem problema */
  }
}
function exitFullscreen() {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) void d.exitFullscreen();
    else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
  } catch {
    /* ignora */
  }
}
function useFullscreen(): boolean {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const on = () => setFs(isFullscreen());
    on();
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);
  return fs;
}

function FullscreenButton() {
  const [mounted, setMounted] = useState(false);
  const fs = useFullscreen();
  useEffect(() => setMounted(true), []);
  if (!mounted || !fullscreenSupported()) return null;
  return (
    <button
      className={styles.fsBtn}
      onClick={() => (fs ? exitFullscreen() : enterFullscreen())}
      aria-label={fs ? "Sair da tela cheia" : "Entrar em tela cheia"}
      title={fs ? "Sair da tela cheia" : "Tela cheia"}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {fs ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}

function screenFromHash(): Screen {
  if (typeof window === "undefined") return "capa";
  const h = window.location.hash.replace("#", "") as Screen;
  return SCREENS.includes(h) ? h : "capa";
}

// índice item->dados para a sacola
type IndexItem = { nome: string; preco: number; barraca: string; emoji: string };
const itemIndex: Record<string, IndexItem> = {};
for (const b of cardapio) {
  for (const it of b.itens) {
    itemIndex[`${b.id}::${it.nome}`] = { nome: it.nome, preco: it.preco, barraca: b.nome, emoji: b.emoji };
  }
}

export default function MapaInterativo() {
  const [screen, setScreen] = useState<Screen>("capa");
  const [ponto, setPonto] = useState<Hotspot | null>(null);

  // sincroniza tela com o hash (deep-link + botão voltar do navegador)
  useEffect(() => {
    const sync = () => {
      setScreen(screenFromHash());
      setPonto(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // tablet/iPad: entra em tela cheia já no primeiro toque (modo quiosque)
  useEffect(() => {
    if (!fullscreenSupported()) return;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!coarse) return;
    const once = () => {
      if (!isFullscreen()) void enterFullscreen();
    };
    document.addEventListener("click", once, { once: true });
    return () => document.removeEventListener("click", once);
  }, []);

  const go = useCallback((s: Screen) => {
    setPonto(null);
    if (screenFromHash() === s) setScreen(s);
    window.location.hash = s;
  }, []);

  const abrirPonto = useCallback(
    (h: Hotspot) => {
      if (h.goto) {
        go(h.goto);
        return;
      }
      setPonto(h);
    },
    [go],
  );

  return (
    <div className={styles.wrap}>
      {screen === "capa" && <Capa onStart={() => go("mapa")} />}

      {screen === "mapa" && (
        <ImageScreen
          key="mapa"
          asset={ASSETS.mapa}
          alt="Mapa da Festa Junina 2026"
          hotspots={mapaPontos}
          onSelect={abrirPonto}
          selected={ponto}
        />
      )}
      {screen === "ginasio" && (
        <ImageScreen
          key="ginasio"
          asset={ASSETS.ginasio}
          alt="Mapa do ginásio — setores e entradas"
          hotspots={ginasioPontos}
          onSelect={abrirPonto}
          selected={ponto}
        />
      )}
      {screen === "programacao" && <Programacao />}
      {screen === "cardapio" && <Cardapio />}

      {screen !== "capa" && <TabBar screen={screen} go={go} />}

      {ponto && (
        <InfoSheet
          ponto={ponto}
          onClose={() => setPonto(null)}
          onGo={go}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Capa ───────────────────────── */
function Capa({ onStart }: { onStart: () => void }) {
  return (
    <button className={styles.capa} onClick={onStart} aria-label="Iniciar o mapa interativo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.capa.src} alt="Capa — Mapa Interativo Festa Junina 2026" />
      <span className={styles.capaHint}>👆 Toque para começar</span>
    </button>
  );
}

/* ───────────────────────── Tela de imagem (mapa/ginásio) ───────────────────────── */
function ImageScreen({
  asset,
  alt,
  hotspots,
  onSelect,
  selected,
}: {
  asset: { src: string; aspect: number };
  alt: string;
  hotspots: Hotspot[];
  onSelect: (h: Hotspot) => void;
  selected: Hotspot | null;
}) {
  const [zoom, setZoom] = useState(1);
  const [hints, setHints] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // ao trocar zoom para 1, volta para o topo/centro
  useEffect(() => {
    if (zoom === 1 && scrollRef.current) scrollRef.current.scrollTo({ top: 0, left: 0 });
  }, [zoom]);

  // destaca no mapa o(s) ponto(s) selecionado(s) e centraliza na área visível
  const activeLabel =
    selected && hotspots.some((h) => h.id === selected.id) ? selected.label : null;
  useEffect(() => {
    if (activeLabel && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const pontos = hotspots.filter((h) => h.kind !== "nav" && h.emoji);

  return (
    <div className={styles.imageScreen}>
      <div className={styles.stageHead}>
        <button
          className={`${styles.hintToggle} ${hints ? styles.on : ""}`}
          onClick={() => setHints((v) => !v)}
          aria-pressed={hints}
        >
          {hints ? "💡 Pontos ativos" : "Mostrar pontos"}
        </button>
        <div className={styles.zoomCtrls}>
          <FullscreenButton />
          <button
            className={styles.zbtn}
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
            disabled={zoom <= 1}
            aria-label="Diminuir zoom"
          >
            −
          </button>
          <button
            className={styles.zbtn}
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))}
            disabled={zoom >= 3}
            aria-label="Aumentar zoom"
          >
            ＋
          </button>
        </div>
      </div>

      <div className={styles.stageScroll} ref={scrollRef}>
        <div
          className={`${styles.stage} ${hints ? styles.showHints : ""}`}
          style={{ ["--zoom"]: zoom, ["--ar"]: asset.aspect } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.src} alt={alt} draggable={false} />
          {hotspots.map((h) => {
            const isActive = activeLabel != null && h.label === activeLabel;
            const isFirstActive =
              isActive && hotspots.findIndex((x) => x.label === activeLabel) === hotspots.indexOf(h);
            return (
              <button
                key={h.id}
                ref={isFirstActive ? activeRef : undefined}
                className={`${styles.hot} ${styles[h.kind ?? "zona"]} ${isActive ? styles.hotActive : ""}`}
                style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
                onClick={() => onSelect(h)}
                aria-label={h.label}
                title={h.label}
              >
                <span className={styles.hotDot} />
                {isActive && (
                  <span className={styles.hotPin} aria-hidden>
                    {h.emoji ?? "📍"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>📍 Pontos da festa — toque para detalhes</div>
        <div className={styles.legendGrid}>
          {pontos.map((h) => (
            <button key={h.id} className={styles.legendItem} onClick={() => onSelect(h)}>
              <span className={styles.legendEmoji}>{h.emoji}</span>
              {h.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Bottom sheet de ponto ───────────────────────── */
function InfoSheet({
  ponto,
  onClose,
  onGo,
}: {
  ponto: Hotspot;
  onClose: () => void;
  onGo: (s: Screen) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className={styles.sheetBackdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label={ponto.label}>
        <div className={styles.grabber} />
        <div className={styles.sheetHead}>
          <div className={styles.sheetEmoji}>{ponto.emoji ?? "📍"}</div>
          <h2 className={styles.sheetTitle}>{ponto.label}</h2>
        </div>
        {ponto.desc && <p className={styles.sheetDesc}>{ponto.desc}</p>}
        <div className={styles.sheetActions}>
          {VER_CARDAPIO.has(ponto.id) && (
            <button className={styles.btnYellow} onClick={() => onGo("cardapio")}>
              🍢 Ver cardápio
            </button>
          )}
          {VER_PROGRAMACAO.has(ponto.id) && (
            <button className={styles.btnYellow} onClick={() => onGo("programacao")}>
              🎭 Ver programação
            </button>
          )}
          <button className={styles.btnGhost} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Programação ───────────────────────── */
function Programacao() {
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const agoraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const starts = useMemo(() => programacao.map((s) => horaParaMinutos(s.hora)), []);

  const { agoraIdx, proxIdx } = useMemo(() => {
    if (nowMin == null) return { agoraIdx: -1, proxIdx: -1 };
    let a = -1;
    for (let i = 0; i < programacao.length; i++) {
      const st = starts[i];
      const en = i + 1 < starts.length ? starts[i + 1] : st + 30;
      if (nowMin >= st && nowMin < en) {
        a = i;
        break;
      }
    }
    const p = starts.findIndex((st) => st > nowMin);
    return { agoraIdx: a, proxIdx: p };
  }, [nowMin, starts]);

  const nq = norm(q);
  const matches = (turma: string) => nq.length > 0 && norm(turma).includes(nq);
  const slotMatch = (i: number) =>
    nq.length === 0 ||
    programacao[i].turmas.some((t) => matches(t)) ||
    norm(programacao[i].grupo).includes(nq);

  const visiveis = programacao.map((_, i) => i).filter(slotMatch);

  const horaNow =
    nowMin == null
      ? "--:--"
      : `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;

  let clockMsg: ReactNode = "Confira quando cada turma sobe ao palco do ginásio.";
  if (nowMin != null) {
    if (agoraIdx >= 0) {
      const s = programacao[agoraIdx];
      clockMsg = (
        <>
          No palco agora: <b>{s.grupo}</b> ({s.hora})
          {proxIdx >= 0 && (
            <>
              {" "}
              · a seguir {programacao[proxIdx].hora}: {programacao[proxIdx].grupo}
            </>
          )}
        </>
      );
    } else if (proxIdx >= 0) {
      const falta = starts[proxIdx] - nowMin;
      const s = programacao[proxIdx];
      clockMsg = (
        <>
          Próxima apresentação às <b>{s.hora}</b> ({s.grupo}) — começa em {falta} min
        </>
      );
    } else {
      clockMsg = <>As apresentações já terminaram por hoje. Até a próxima! 🎉</>;
    }
  }

  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.topTitle}>
          <span className={styles.topSpark}>🎭</span> Apresentações
        </h1>
        <button
          className={styles.back}
          onClick={() =>
            compartilhar("Confira a programação das apresentações da Festa Junina 2026 do Colégio Marista! 🎉")
          }
          aria-label="Compartilhar programação"
        >
          📤
        </button>
        <FullscreenButton />
      </header>

      <div className={styles.scroller}>
        <div className={styles.clockBar}>
          {agoraIdx >= 0 ? (
            <span className={styles.live}>
              <span className={styles.liveDot} /> Ao vivo
            </span>
          ) : (
            <span className={styles.live}>🕒 Horário</span>
          )}
          <span className={styles.clockMsg}>{clockMsg}</span>
          <span className={styles.clockNow}>{horaNow}</span>
        </div>

        <div className={styles.search}>
          🔎
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar sua turma (ex: 5º C, INF 3)"
            inputMode="search"
          />
          {q && (
            <button className={styles.searchClear} onClick={() => setQ("")} aria-label="Limpar busca">
              ×
            </button>
          )}
        </div>

        {visiveis.length === 0 && (
          <div className={styles.empty}>
            Nenhuma turma encontrada para “{q}”.
            <br />
            Tente “5C”, “INF 3” ou “9º A”.
          </div>
        )}

        {visiveis.map((i) => {
          const s = programacao[i];
          const isAgora = i === agoraIdx && nq.length === 0;
          const isProx = i === proxIdx && agoraIdx >= 0 && nq.length === 0;
          return (
            <div
              key={s.hora}
              ref={isAgora ? agoraRef : undefined}
              className={`${styles.slot} ${isAgora ? styles.agora : ""} ${isProx ? styles.proxima : ""}`}
            >
              {isAgora && <span className={`${styles.tag} ${styles.tagAgora}`}>No palco</span>}
              {isProx && <span className={`${styles.tag} ${styles.tagProxima}`}>A seguir</span>}
              <div className={styles.slotHora}>{s.hora}</div>
              <div className={styles.slotBody}>
                <div className={styles.slotGrupo}>{s.grupo}</div>
                {s.periodo && <div className={styles.slotPeriodo}>{s.periodo}</div>}
                <div className={styles.turmas}>
                  {s.turmas.map((t) => (
                    <span key={t} className={`${styles.turma} ${matches(t) ? styles.match : ""}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className={styles.slotIcs}
                onClick={() =>
                  compartilhar(
                    `${s.grupo} se apresenta às ${s.hora} na Festa Junina 2026 do Colégio Marista! 🎉 (${s.turmas.join(", ")})`,
                  )
                }
                aria-label={`Compartilhar apresentação das ${s.hora}`}
                title="Compartilhar"
              >
                📤
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───────────────────────── Cardápio ───────────────────────── */
type Sacola = Record<string, number>;

function Cardapio() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [sacola, setSacola] = useState<Sacola>({});
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SACOLA_KEY);
      if (raw) setSacola(JSON.parse(raw));
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SACOLA_KEY, JSON.stringify(sacola));
    } catch {
      /* ignora */
    }
  }, [sacola]);

  const add = (key: string, delta: number) =>
    setSacola((s) => {
      const n = (s[key] ?? 0) + delta;
      const next = { ...s };
      if (n <= 0) delete next[key];
      else next[key] = n;
      return next;
    });

  const nq = norm(q);
  const lista = cardapio
    .filter((b) => !filtro || b.id === filtro)
    .map((b) => ({
      ...b,
      itens: nq.length === 0 ? b.itens : b.itens.filter((it) => norm(it.nome).includes(nq)),
    }))
    .filter((b) => b.itens.length > 0);

  const totalItens = Object.values(sacola).reduce((a, n) => a + n, 0);
  const totalValor = Object.entries(sacola).reduce(
    (a, [k, n]) => a + (itemIndex[k]?.preco ?? 0) * n,
    0,
  );

  const highlight = (nome: string) => {
    const i = nome.toLowerCase().indexOf(q.trim().toLowerCase());
    if (!q.trim() || i < 0) return nome;
    return (
      <>
        {nome.slice(0, i)}
        <mark>{nome.slice(i, i + q.trim().length)}</mark>
        {nome.slice(i + q.trim().length)}
      </>
    );
  };

  const compartilharSacola = () => {
    const linhas = Object.entries(sacola)
      .map(([k, n]) => `${n}x ${itemIndex[k]?.nome}`)
      .join(", ");
    compartilhar(`Minha sacola na Festa Junina 2026 🎉: ${linhas}. Total: ${brl(totalValor)}`);
  };

  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.topTitle}>
          <span className={styles.topSpark}>🍢</span> Cardápio
        </h1>
        <FullscreenButton />
      </header>

      <div className={`${styles.search} ${styles.searchTop}`}>
        🔎
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar comida (ex: açaí, espetinho, pastel)"
          inputMode="search"
        />
        {q && (
          <button className={styles.searchClear} onClick={() => setQ("")} aria-label="Limpar busca">
            ×
          </button>
        )}
      </div>

      <div className={styles.chips}>
        <button
          className={`${styles.chip} ${!filtro ? styles.on : ""}`}
          onClick={() => setFiltro(null)}
        >
          Tudo
        </button>
        {cardapio.map((b) => (
          <button
            key={b.id}
            className={`${styles.chip} ${filtro === b.id ? styles.on : ""}`}
            onClick={() => setFiltro((f) => (f === b.id ? null : b.id))}
          >
            {b.emoji} {b.nome}
          </button>
        ))}
      </div>

      <div className={styles.scroller} style={{ paddingBottom: 156 }}>
        {lista.length === 0 && (
          <div className={styles.empty}>Nenhum item encontrado para “{q}”.</div>
        )}
        {lista.map((b) => (
          <section key={b.id} className={styles.barraca}>
            <div className={styles.barracaHead}>
              <span className={styles.barracaEmoji}>{b.emoji}</span>
              <span className={styles.barracaNome}>{b.nome}</span>
              {b.tipo === "diversao" && <span className={styles.barracaTipo}>Diversão</span>}
            </div>
            {b.itens.map((it) => {
              const key = `${b.id}::${it.nome}`;
              const qtd = sacola[key] ?? 0;
              return (
                <div key={key} className={styles.item}>
                  <span className={styles.itemNome}>{highlight(it.nome)}</span>
                  <span className={styles.itemPreco}>{brl(it.preco)}</span>
                  {qtd > 0 && <span className={styles.qtyN}>{qtd}×</span>}
                  <button
                    className={`${styles.addBtn} ${b.tipo === "diversao" ? styles.diversao : ""}`}
                    onClick={() => add(key, 1)}
                    aria-label={`Adicionar ${it.nome} à sacola`}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {totalItens > 0 && (
        <button className={styles.fab} onClick={() => setAberta(true)}>
          🛍️ <span className={styles.fabCount}>{totalItens}</span>
          <span className={styles.fabTotal}>{brl(totalValor)}</span>
        </button>
      )}

      {aberta && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setAberta(false)} />
          <div className={styles.sheet} role="dialog" aria-label="Minha sacola">
            <div className={styles.grabber} />
            <div className={styles.sheetHead}>
              <div className={styles.sheetEmoji}>🛍️</div>
              <h2 className={styles.sheetTitle}>Minha sacola</h2>
            </div>
            {totalItens === 0 ? (
              <p className={styles.muted}>Sua sacola está vazia. Toque no “+” dos itens para montar seu rango! 😋</p>
            ) : (
              <>
                {Object.entries(sacola).map(([k, n]) => {
                  const it = itemIndex[k];
                  if (!it) return null;
                  return (
                    <div key={k} className={styles.sacolaItem}>
                      <div className={styles.sacolaNome}>
                        {it.emoji} {it.nome}
                        <small>{it.barraca}</small>
                      </div>
                      <div className={styles.qty}>
                        <button className={styles.qtyBtn} onClick={() => add(k, -1)} aria-label="Menos um">
                          −
                        </button>
                        <span className={styles.qtyN}>{n}</span>
                        <button className={styles.qtyBtn} onClick={() => add(k, 1)} aria-label="Mais um">
                          +
                        </button>
                      </div>
                      <span className={styles.sacolaPreco}>{brl(it.preco * n)}</span>
                    </div>
                  );
                })}
                <div className={styles.totalRow}>
                  <span>Total ({totalItens} {totalItens === 1 ? "item" : "itens"})</span>
                  <b>{brl(totalValor)}</b>
                </div>
                <p className={styles.muted}>
                  Estimativa para você se planejar — o pagamento é feito nas barracas/caixa da festa.
                </p>
                <div className={styles.sheetActions}>
                  <button className={styles.btnYellow} onClick={compartilharSacola}>
                    📤 Compartilhar
                  </button>
                  <button className={styles.btnGhost} onClick={() => setSacola({})}>
                    🗑️ Limpar
                  </button>
                  <button className={styles.btnGhost} onClick={() => setAberta(false)}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ───────────────────────── Barra de navegação (abas) ───────────────────────── */
function TabBar({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const tabs: { id: Screen; icon: string; label: string }[] = [
    { id: "mapa", icon: "🗺️", label: "Mapa" },
    { id: "ginasio", icon: "🏟️", label: "Ginásio" },
    { id: "programacao", icon: "🎭", label: "Palco" },
    { id: "cardapio", icon: "🍢", label: "Cardápio" },
  ];
  return (
    <nav className={styles.tabbar}>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`${styles.tab} ${screen === t.id ? styles.tabOn : ""}`}
          onClick={() => go(t.id)}
          aria-current={screen === t.id}
        >
          <span className={styles.tabIcon}>{t.icon}</span>
          <span className={styles.tabLabel}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
