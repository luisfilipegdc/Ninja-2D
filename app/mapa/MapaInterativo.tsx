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
  EVENTO_DATA,
  cardapio,
  ginasioPontos,
  horaParaMinutos,
  mapaPontos,
  programacao,
  type Hotspot,
  type Screen,
} from "./data";
import { getSupabase } from "@/lib/supabase";

const SCREENS: Screen[] = ["capa", "inicio", "mapa", "ginasio", "programacao", "cardapio"];

// pontos do mapa que oferecem um atalho contextual para o cardápio
const VER_CARDAPIO = new Set(["praca", "bebidas", "inflaveis", "brincadeiras"]);
// pontos que oferecem atalho para a programação
const VER_PROGRAMACAO = new Set(["quadra", "concentracao", "entrada-alunos"]);

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d)[ºo°]/gi, "$1") // ordinal tolerante: 5º / 5° / 5o -> 5
    .replace(/[º°\s]/g, "")
    .toLowerCase();

// Busca com fronteira de palavra: "5c" não retorna "INF 5 C" (inf5c) porque o "5c"
// está precedido por letra — só bate onde o padrão começa em posição inicial ou
// após caractere não-alfanumérico.
// Implementado com indexOf (sem regex lookbehind): o lookbehind não é suportado
// no Safari iOS < 16.4 e quebrava o app em celulares antigos durante a busca.
function matchTurma(turma: string, nq: string): boolean {
  if (!nq) return false;
  const nt = norm(turma);
  for (let from = 0; ; ) {
    const i = nt.indexOf(nq, from);
    if (i < 0) return false;
    if (i === 0) return true; // começa no início → é fronteira de palavra
    const prev = nt[i - 1];
    const prevEhPalavra = (prev >= "a" && prev <= "z") || (prev >= "0" && prev <= "9");
    if (!prevEhPalavra) return true; // precedido por caractere não-alfanumérico
    from = i + 1;
  }
}

// Formata uma duração em minutos: até 59 min mostra "X min"; a partir de 1h
// vira "Xh" (em ponto) ou "XhYY" (ex.: 229 min → "3h49").
function fmtMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, "0")}`;
}

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

// hook compartilhado do "ao vivo": calcula a apresentação atual/próxima pelo relógio.
// (fonte única — quando entrar o controle manual da equipe, troca-se só a origem aqui.)
type AoVivoOverride = { modo: "auto" | "manual"; hora: string | null };

let aoVivoChannelSeq = 0;
function useAoVivo() {
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [override, setOverride] = useState<AoVivoOverride | null>(null);
  const chanIdRef = useRef<number>();
  if (chanIdRef.current == null) chanIdRef.current = ++aoVivoChannelSeq;

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      // "ao vivo" pelo relógio só ativa no dia do evento; fora dele mostra horários estáticos
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (localDate !== EVENTO_DATA) { setNowMin(null); return; }
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  // controle manual da equipe (override em tempo real via Supabase). Sem Supabase
  // configurado, cai no relógio automaticamente.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    const apply = (row: { modo?: string; hora?: string | null } | null) => {
      if (active && row && (row.modo === "auto" || row.modo === "manual")) {
        setOverride({ modo: row.modo, hora: row.hora ?? null });
      }
    };
    let ch: ReturnType<typeof sb.channel> | null = null;
    try {
      sb.from("ao_vivo")
        .select("modo,hora")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => apply(data as { modo?: string; hora?: string | null } | null));
      ch = sb
        .channel(`ao_vivo_${chanIdRef.current}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "ao_vivo" }, (payload) =>
          apply(payload.new as { modo?: string; hora?: string | null }),
        )
        .subscribe();
    } catch {
      /* realtime indisponível — segue no relógio */
    }
    return () => {
      active = false;
      try {
        if (ch) sb.removeChannel(ch);
      } catch {
        /* ignora */
      }
    };
  }, []);

  const starts = useMemo(() => programacao.map((s) => horaParaMinutos(s.hora)), []);

  const { agoraIdx, proxIdx } = useMemo(() => {
    // o override manual da equipe tem prioridade sobre o relógio
    if (override?.modo === "manual") {
      if (!override.hora) return { agoraIdx: -1, proxIdx: -1 }; // intervalo declarado
      const a = programacao.findIndex((s) => s.hora === override.hora);
      const p = a >= 0 && a + 1 < programacao.length ? a + 1 : -1;
      return { agoraIdx: a, proxIdx: p };
    }
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
  }, [override, nowMin, starts]);

  const horaNow =
    nowMin == null
      ? "--:--"
      : `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;
  return { nowMin, starts, agoraIdx, proxIdx, horaNow, manual: override?.modo === "manual" };
}

const TURMA_KEY = "festa_turmas_v2"; // lista de turmas acompanhadas (vários filhos)
const TURMA_KEY_OLD = "festa_turma_v1"; // formato antigo (uma única turma) — migrado
const TODAS_TURMAS = Array.from(new Set(programacao.flatMap((s) => s.turmas)));
const SEGMENTOS: { label: string; emoji: string; test: (t: string) => boolean }[] = [
  { label: "Infantil", emoji: "🧸", test: (t) => t.startsWith("INF") },
  { label: "1º ao 5º", emoji: "✏️", test: (t) => /^[1-5]º/.test(t) },
  { label: "9º Ano", emoji: "📒", test: (t) => t.startsWith("9º") },
  { label: "Ensino Médio", emoji: "🎓", test: (t) => /todas/i.test(t) },
];
type AvLite = { agoraIdx: number; nowMin: number | null; starts: number[]; manual: boolean };
type SeguindoStatus = {
  idx: number;
  estado: "nenhum" | "agora" | "em_breve" | "aguardando" | "passou";
  minutos: number;
};

function statusDaTurma(turma: string | null, av: AvLite): SeguindoStatus {
  if (!turma) return { idx: -1, estado: "nenhum", minutos: 0 };
  const idx = programacao.findIndex((s) => s.turmas.includes(turma));
  if (idx < 0) return { idx: -1, estado: "nenhum", minutos: 0 };
  if (idx === av.agoraIdx) return { idx, estado: "agora", minutos: 0 };
  if (av.manual || av.nowMin == null) return { idx, estado: "aguardando", minutos: 0 };
  const min = av.starts[idx] - av.nowMin;
  if (min > 0) return { idx, estado: "em_breve", minutos: min };
  return { idx, estado: "passou", minutos: 0 };
}

type SeguidoItem = { turma: string; st: SeguindoStatus };

function badgeAoVivo(
  seguidos: SeguidoItem[],
  agoraIdx: number,
  proxIdx: number,
): { live: boolean; tag: string; txt: string } | null {
  // alguma turma acompanhada já está no palco? (prioridade máxima)
  const agora = seguidos.find((s) => s.st.estado === "agora");
  if (agora) return { live: true, tag: "AO VIVO", txt: `${agora.turma} no palco! 🎉` };
  // senão, a próxima turma acompanhada que ainda vai subir (a mais cedo)
  const futuras = seguidos
    .filter((s) => s.st.estado === "em_breve" || s.st.estado === "aguardando")
    .sort((a, b) => a.st.idx - b.st.idx);
  const prox = futuras[0];
  if (prox) {
    if (prox.st.estado === "em_breve")
      return { live: false, tag: "SUA TURMA", txt: `${prox.turma} em ${fmtMin(prox.st.minutos)}` };
    return { live: false, tag: "SUA TURMA", txt: `${prox.turma} — aguarde` };
  }
  if (agoraIdx >= 0) return { live: true, tag: "AO VIVO", txt: `no palco: ${programacao[agoraIdx].grupo}` };
  if (proxIdx >= 0) return { live: false, tag: "EM BREVE", txt: `${programacao[proxIdx].hora} ${programacao[proxIdx].grupo}` };
  return null;
}

function vibrar(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* iOS Safari não vibra — sem problema */
  }
}

function Confetti() {
  const pecas = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 2.4 + Math.random() * 1.8,
        rot: 120 + Math.random() * 520,
        size: 7 + Math.random() * 7,
        cor: ["#f9c21a", "#e23b2e", "#28a8e0", "#2ec27e", "#e84c97", "#6e5ba6"][i % 6],
      })),
    [],
  );
  return (
    <div className={styles.confetti} aria-hidden>
      {pecas.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.cor,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ["--rot"]: `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function MapaInterativo() {
  const [screen, setScreen] = useState<Screen>("capa");
  const [ponto, setPonto] = useState<Hotspot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [coachSeen, setCoachSeen] = useState(false);
  const [seguindo, setSeguindo] = useState<string[]>([]);
  const [confete, setConfete] = useState(false);
  const { agoraIdx, proxIdx, nowMin, starts, manual } = useAoVivo();
  const prevAgora = useRef<number | null>(null);
  const prevEstados = useRef<Record<string, string>>({});
  const alertou30 = useRef<Record<string, boolean>>({});
  const alertou10 = useRef<Record<string, boolean>>({});

  const av = useMemo(
    () => ({ agoraIdx, nowMin, starts, manual }),
    [agoraIdx, nowMin, starts, manual],
  );
  const seguidos = useMemo(
    () => seguindo.map((t) => ({ turma: t, st: statusDaTurma(t, av) })),
    [seguindo, av],
  );

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

  // alerta (toast) quando troca a turma no palco
  useEffect(() => {
    const prev = prevAgora.current;
    if (agoraIdx >= 0 && prev !== null && prev >= 0 && prev !== agoraIdx) {
      setToast(`🎉 Subindo agora: ${programacao[agoraIdx].grupo}`);
    }
    prevAgora.current = agoraIdx;
  }, [agoraIdx]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // coach-mark do mapa: reaparece a cada nova sessão (ao voltar pra capa) e some sozinho
  useEffect(() => {
    if (screen === "capa") setCoachSeen(false);
  }, [screen]);
  useEffect(() => {
    if (screen === "mapa" && !coachSeen) {
      const id = setTimeout(() => setCoachSeen(true), 8000);
      return () => clearTimeout(id);
    }
  }, [screen, coachSeen]);

  // turmas acompanhadas (persistem no aparelho) — suporta vários filhos
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TURMA_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSeguindo(arr.filter((x) => typeof x === "string"));
      } else {
        // migra do formato antigo (uma única turma)
        const antigo = localStorage.getItem(TURMA_KEY_OLD);
        if (antigo) setSeguindo([antigo]);
      }
    } catch {
      /* ignora */
    }
  }, []);
  useEffect(() => {
    try {
      if (seguindo.length) localStorage.setItem(TURMA_KEY, JSON.stringify(seguindo));
      else localStorage.removeItem(TURMA_KEY);
    } catch {
      /* ignora */
    }
  }, [seguindo]);

  // alertas por turma acompanhada (vale para cada filho):
  //  • confete + aviso quando a turma sobe ao palco
  //  • 30 min antes → hora de ir para a CONCENTRAÇÃO (o grande diferencial)
  //  • 10 min antes → lembrete final
  useEffect(() => {
    // limpa o histórico de turmas que deixaram de ser acompanhadas
    const ativos = new Set(seguindo);
    for (const k of Object.keys(prevEstados.current)) {
      if (!ativos.has(k)) {
        delete prevEstados.current[k];
        delete alertou30.current[k];
        delete alertou10.current[k];
      }
    }

    for (const { turma, st } of seguidos) {
      const prev = prevEstados.current[turma] ?? "nenhum";

      if (st.estado === "agora" && prev !== "agora") {
        setConfete(true);
        setToast(`🎉 ${turma} no palco AGORA!`);
        vibrar([0, 90, 50, 130]);
      }

      if (st.estado === "em_breve") {
        // rearma os avisos enquanto ainda falta bastante tempo
        if (st.minutos > 30) alertou30.current[turma] = false;
        if (st.minutos > 10) alertou10.current[turma] = false;

        // ALERTA PRINCIPAL: 30 min antes → ir para a concentração
        if (st.minutos <= 30 && st.minutos > 10 && !alertou30.current[turma]) {
          alertou30.current[turma] = true;
          setToast(`📣 ${turma}: hora de ir para a CONCENTRAÇÃO! Sobe ao palco em ${fmtMin(st.minutos)}.`);
          vibrar([0, 120, 60, 120]);
        }
        // lembrete final faltando 10 min
        if (st.minutos <= 10 && st.minutos > 0 && !alertou10.current[turma]) {
          alertou10.current[turma] = true;
          setToast(`⏰ Falta pouco! ${turma} sobe em ${fmtMin(st.minutos)}.`);
          vibrar(80);
        }
      }

      prevEstados.current[turma] = st.estado;
    }
  }, [seguidos, seguindo]);

  useEffect(() => {
    if (!confete) return;
    const id = setTimeout(() => setConfete(false), 4200);
    return () => clearTimeout(id);
  }, [confete]);

  const go = useCallback((s: Screen) => {
    setPonto(null);
    if (screenFromHash() === s) setScreen(s);
    window.location.hash = s;
  }, []);

  const abrirPonto = useCallback(
    (h: Hotspot) => {
      vibrar(12);
      setCoachSeen(true);
      if (h.goto) {
        go(h.goto);
        return;
      }
      setPonto(h);
    },
    [go],
  );

  // adiciona/remove uma turma da lista de acompanhadas (toast ao adicionar)
  const toggleTurma = useCallback(
    (t: string) => {
      setSeguindo((prev) => {
        if (prev.includes(t)) return prev.filter((x) => x !== t);
        vibrar(12);
        const st = statusDaTurma(t, av);
        if (st.estado === "agora") setToast(`🔔 Acompanhando ${t} — no palco agora! 🎉`);
        else if (st.estado === "em_breve")
          setToast(`🔔 Acompanhando ${t} — sobe em ${fmtMin(st.minutos)}`);
        else if (st.estado === "passou") setToast(`🔔 ${t} já se apresentou hoje`);
        else if (st.estado === "aguardando")
          setToast(`🔔 Acompanhando ${t} (previsto às ${programacao[st.idx].hora})`);
        else setToast(`🔔 Acompanhando ${t}`);
        return [...prev, t];
      });
    },
    [av],
  );

  // boas-vindas: confirma a(s) turma(s) escolhida(s) e entra no mapa
  const confirmarTurmas = useCallback(
    (lista: string[]) => {
      setSeguindo(lista);
      go("mapa");
    },
    [go],
  );

  const badge = badgeAoVivo(seguidos, agoraIdx, proxIdx);

  return (
    <div className={styles.wrap}>
      {screen === "capa" && <Capa onStart={() => go("mapa")} badge={badge} onGo={go} />}

      {screen === "inicio" && (
        <BoasVindas seguindo={seguindo} onConfirm={confirmarTurmas} onSkip={() => go("mapa")} />
      )}

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
      {screen === "programacao" && <Programacao seguindo={seguindo} onSeguir={toggleTurma} />}
      {screen === "cardapio" && <Cardapio />}

      {screen !== "capa" && screen !== "inicio" && <TabBar screen={screen} go={go} />}

      {/* selo AO VIVO flutuante — prioriza a turma acompanhada (mapa/ginásio) */}
      {(screen === "mapa" || screen === "ginasio") && badge && (
        <button
          className={`${styles.liveBadge} ${badge.live ? styles.liveOn : ""}`}
          onClick={() => go("programacao")}
          aria-label="Ver a programação ao vivo"
        >
          <span className={styles.liveDotBig} />
          <span>
            <b>{badge.tag}</b> · {badge.txt}
          </span>
        </button>
      )}

      {confete && <Confetti />}

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}

      {/* coach-mark: ensina que os pontos do mapa são tocáveis */}
      {screen === "mapa" && !coachSeen && (
        <div className={styles.coach}>
          <div className={styles.coachCard}>
            <span className={styles.coachEmoji}>👆</span>
            <p>
              O mapa <b>já é interativo</b>: toque em qualquer ponto para ver o local —
              barracas, palco, banheiros e mais. Se quiser, o <b>💡</b> lá em cima
              {" "}
              <b>destaca os pontos</b>.
            </p>
            <button className={styles.btnYellow} onClick={() => setCoachSeen(true)}>
              Entendi
            </button>
          </div>
        </div>
      )}

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
// elementos do PDF oficial recortados como stickers — a identidade da festa
const CAPA_STICKERS: { src: string; cls: "stChapeu" | "stGirassol" | "stCacto" | "stIgreja" }[] = [
  { src: "/mapa/stickers/chapeu.png", cls: "stChapeu" },
  { src: "/mapa/stickers/girassol.png", cls: "stGirassol" },
  { src: "/mapa/stickers/cacto.png", cls: "stCacto" },
  { src: "/mapa/stickers/igreja.png", cls: "stIgreja" },
];
// cores do convite Festa Junina Marista 2026
const CAPA_CORES = ["#e23b2e", "#f9c21a", "#e84c97", "#28a8e0", "#6e5ba6", "#2ec27e"];
const CAPA_BANDEIRAS = Array.from({ length: 14 }, (_, i) => ({
  cor: CAPA_CORES[i % CAPA_CORES.length],
  delay: ((i % 6) * 0.16).toFixed(2),
}));
// confete que flutua devagar — padrão fixo (sem Math.random no render → hidratação ok)
const CAPA_CONFETE = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61 + 5) % 100,
  cor: CAPA_CORES[(i + 2) % CAPA_CORES.length],
  delay: (((i * 7) % 11) * 0.7).toFixed(2),
  dur: 7 + ((i * 5) % 6),
  size: 6 + (i % 3) * 3,
  drift: (i % 2 ? 1 : -1) * (10 + (i % 4) * 8),
  rodar: 180 + (i % 4) * 120,
}));

function CapaBandeiras() {
  return (
    <div className={styles.capaBandeiras} aria-hidden>
      {CAPA_BANDEIRAS.map((b, i) => (
        <span
          key={i}
          className={styles.bandeira}
          style={{ background: b.cor, animationDelay: `${b.delay}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function CapaConfete() {
  return (
    <div className={styles.capaConfete} aria-hidden>
      {CAPA_CONFETE.map((c, i) => (
        <span
          key={i}
          className={styles.confeteDot}
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.size,
              background: c.cor,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              ["--drift"]: `${c.drift}px`,
              ["--rodar"]: `${c.rodar}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Capa({
  onStart,
  badge,
  onGo,
}: {
  onStart: () => void;
  badge: { live: boolean; tag: string; txt: string } | null;
  onGo: (s: Screen) => void;
}) {
  const [acendendo, setAcendendo] = useState(false);
  const iniciar = useCallback(() => {
    if (acendendo) return;
    vibrar([16, 28, 16]);
    const reduz =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduz) {
      onStart();
      return;
    }
    setAcendendo(true);
    window.setTimeout(onStart, 380);
  }, [acendendo, onStart]);

  return (
    <div className={`${styles.capa} ${acendendo ? styles.capaIndo : ""}`}>
      <CapaConfete />
      <CapaBandeiras />

      {/* stickers recortados do PDF, emoldurando a cena */}
      {CAPA_STICKERS.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={s.cls} className={`${styles.sticker} ${styles[s.cls]}`} src={s.src} alt="" aria-hidden />
      ))}

      <button
        className={styles.capaHit}
        onClick={iniciar}
        aria-label="Abrir o mapa interativo da Festa Junina"
      />

      <div className={styles.capaScene}>
        <div className={styles.capaHero}>
          <span className={styles.capaSelo}>Mapa Interativo</span>
          <div className={styles.capaFesta}>
            <span className={styles.capaFestaTop}>Festa</span>
            <span className={styles.capaFestaBot}>
              Junina <span className={styles.capaAno}>2026</span>
            </span>
          </div>
          <p className={styles.capaLead}>
            A festa toda no seu celular: as barracas, o palco e o ginásio no mapa.
          </p>
        </div>

        <span className={styles.capaCta}>
          <span>Toque para abrir o mapa</span>
          <span className={styles.capaCtaArrow} aria-hidden>
            →
          </span>
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.capaMarista}
          src="/mapa/marista-branco.png"
          alt="Colégio Marista de Brasília"
        />
      </div>

      {badge && (
        <button
          className={`${styles.capaLivePill} ${badge.live ? styles.liveOn : ""}`}
          onClick={() => onGo("programacao")}
          aria-label="Ver a programação ao vivo"
        >
          <span className={styles.liveDotBig} />
          <span>
            <b>{badge.tag}</b> · {badge.txt}
          </span>
          <span className={styles.capaLiveArrow} aria-hidden>
            ›
          </span>
        </button>
      )}

      {acendendo && <span className={styles.capaFaisca} aria-hidden />}
    </div>
  );
}

/* ───────────────────────── Boas-vindas (escolher a turma) ───────────────────────── */
function BoasVindas({
  seguindo,
  onConfirm,
  onSkip,
}: {
  seguindo: string[];
  onConfirm: (lista: string[]) => void;
  onSkip: () => void;
}) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<number | null>(null);
  const [sel, setSel] = useState<string[]>(seguindo);
  const nq = norm(q);
  const lista = nq
    ? TODAS_TURMAS.filter((t) => matchTurma(t, nq)).slice(0, 40)
    : seg != null
      ? TODAS_TURMAS.filter(SEGMENTOS[seg].test)
      : [];
  const toggle = (t: string) => {
    vibrar(10);
    setSel((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };
  return (
    <div className={styles.welcome}>
      <CapaBandeiras />
      <div className={styles.welcomeInner}>
        <span className={styles.welcomeEmoji}>👋</span>
        <h1 className={styles.welcomeTitle}>Quem você veio ver?</h1>
        <p className={styles.welcomeSub}>
          Escolha a turma do seu filho e a gente avisa <b>30 min antes</b> para ir à{" "}
          <b>concentração</b> e <b>quando ele subir</b> ao palco. 🔔
          <br />
          Tem mais de um filho? <b>Marque todas as turmas</b> — acompanhamos cada uma. 👨‍👩‍👧‍👦
        </p>

        {sel.length > 0 && (
          <div className={styles.welcomeSelWrap}>
            <span className={styles.welcomeSelTitle}>Acompanhando ({sel.length}):</span>
            <div className={styles.welcomeSelChips}>
              {sel.map((t) => (
                <button
                  key={t}
                  className={styles.welcomeSelChip}
                  onClick={() => toggle(t)}
                  aria-label={`Remover ${t}`}
                >
                  🔔 {t} <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.segRow}>
          {SEGMENTOS.map((s, i) => (
            <button
              key={s.label}
              className={`${styles.segBtn} ${seg === i ? styles.segOn : ""}`}
              onClick={() => {
                vibrar(10);
                setQ("");
                setSeg(seg === i ? null : i);
              }}
            >
              <span aria-hidden>{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>

        <div className={`${styles.search} ${styles.welcomeSearch}`}>
          🔎
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSeg(null);
            }}
            placeholder="ou digite a turma (ex: 5º C)"
            inputMode="search"
          />
          {q && (
            <button className={styles.searchClear} onClick={() => setQ("")} aria-label="Limpar">
              ×
            </button>
          )}
        </div>

        {(q || seg != null) && (
          <div className={styles.welcomeGrid}>
            {lista.length === 0 ? (
              <p className={styles.welcomeHint}>Nenhuma turma encontrada.</p>
            ) : (
              lista.map((t) => {
                const ativo = sel.includes(t);
                return (
                  <button
                    key={t}
                    className={`${styles.welcomeChip} ${ativo ? styles.welcomeChipOn : ""}`}
                    onClick={() => toggle(t)}
                  >
                    {ativo ? "🔔 " : ""}
                    {t}
                  </button>
                );
              })
            )}
          </div>
        )}

        {sel.length > 0 && (
          <button className={`${styles.btnYellow} ${styles.welcomeCont}`} onClick={() => onConfirm(sel)}>
            Ver o mapa · acompanhando {sel.length} turma{sel.length > 1 ? "s" : ""} →
          </button>
        )}

        <button className={styles.welcomeSkip} onClick={onSkip}>
          {sel.length > 0 ? "Pular por agora ›" : "Ver o mapa sem acompanhar ›"}
        </button>
      </div>
    </div>
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
  const [hints, setHints] = useState(false);
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
          aria-label={hints ? "Ocultar destaque dos pontos" : "Mostrar destaque dos pontos"}
          title="Destaque dos pontos"
        >
          💡
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
              🎭 Ver apresentações
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
function Programacao({
  seguindo,
  onSeguir,
}: {
  seguindo: string[];
  onSeguir: (t: string) => void;
}) {
  const [q, setQ] = useState("");
  const agoraRef = useRef<HTMLDivElement>(null);
  const { nowMin, starts, agoraIdx, proxIdx, horaNow, manual } = useAoVivo();
  const seguidos = seguindo
    .map((t) => ({ turma: t, st: statusDaTurma(t, { agoraIdx, nowMin, starts, manual }) }))
    .filter((s) => s.st.idx >= 0)
    .sort((a, b) => a.st.idx - b.st.idx);
  const textoStatus = (st: SeguindoStatus) =>
    st.estado === "agora"
      ? "no palco agora! 🎉"
      : st.estado === "em_breve"
        ? `sobe às ${programacao[st.idx].hora} (faltam ${fmtMin(st.minutos)})`
        : st.estado === "aguardando"
          ? `previsto às ${programacao[st.idx].hora}`
          : "já se apresentou";

  const nq = norm(q);
  const matches = (turma: string) => nq.length > 0 && matchTurma(turma, nq);
  const slotMatch = (i: number) =>
    nq.length === 0 ||
    programacao[i].turmas.some((t) => matches(t)) ||
    norm(programacao[i].grupo).includes(nq);

  const visiveis = programacao.map((_, i) => i).filter(slotMatch);

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
          Próxima apresentação às <b>{s.hora}</b> ({s.grupo}) — começa em {fmtMin(falta)}
        </>
      );
    } else {
      clockMsg = <>As apresentações já terminaram por hoje. Até a próxima! 🎉</>;
    }
  }

  return (
    <>
      <header className={styles.topbar}>
        <CapaBandeiras />
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
          <div className={styles.clockRow}>
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
          <div className={styles.clockCaveat}>
            Horários previstos — a equipe ajusta o “ao vivo” em caso de atraso.
          </div>
        </div>

        {seguidos.length > 0 ? (
          <div className={styles.seguindoLista}>
            {seguidos.map(({ turma, st }) => (
              <div
                key={turma}
                className={`${styles.seguindoBar} ${st.estado === "agora" ? styles.seguindoAgora : ""}`}
              >
                <span className={styles.seguindoTxt}>
                  🔔 Acompanhando <b>{turma}</b> — {textoStatus(st)}
                </span>
                <button
                  className={styles.seguindoX}
                  onClick={() => onSeguir(turma)}
                  aria-label={`Deixar de acompanhar ${turma}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.followHint}>
            🔔 Toque na <b>sua turma</b> abaixo para acompanhá-la e ser avisado <b>30 min antes</b>.
            Tem mais de um filho? Pode marcar <b>várias turmas</b>.
          </p>
        )}

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

        {visiveis.map((i, pos) => {
          const s = programacao[i];
          const isAgora = i === agoraIdx && nq.length === 0;
          const isProx = i === proxIdx && agoraIdx >= 0 && nq.length === 0;
          return (
            <div
              key={s.hora}
              ref={isAgora ? agoraRef : undefined}
              className={`${styles.slot} ${isAgora ? styles.agora : ""} ${isProx ? styles.proxima : ""}`}
              style={{ animationDelay: `${Math.min(pos * 35, 480)}ms` }}
            >
              {isAgora && <span className={`${styles.tag} ${styles.tagAgora}`}>No palco</span>}
              {isProx && <span className={`${styles.tag} ${styles.tagProxima}`}>A seguir</span>}
              <div className={styles.slotHora}>{s.hora}</div>
              <div className={styles.slotBody}>
                <div className={styles.slotGrupo}>{s.grupo}</div>
                {s.periodo && <div className={styles.slotPeriodo}>{s.periodo}</div>}
                <div className={styles.turmas}>
                  {s.turmas.map((t) => {
                    const ativo = seguindo.includes(t);
                    return (
                      <button
                        key={t}
                        className={`${styles.turma} ${matches(t) ? styles.match : ""} ${
                          ativo ? styles.turmaSeguindo : ""
                        }`}
                        onClick={() => onSeguir(t)}
                      >
                        {ativo ? "🔔 " : ""}
                        {t}
                      </button>
                    );
                  })}
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

/* ───────────────────────── Cardápio (só preços) ───────────────────────── */
function Cardapio() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);

  const nq = norm(q);
  const lista = cardapio
    .filter((b) => !filtro || b.id === filtro)
    .map((b) => ({
      ...b,
      itens: nq.length === 0 ? b.itens : b.itens.filter((it) => norm(it.nome).includes(nq)),
    }))
    .filter((b) => b.itens.length > 0);

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

  return (
    <>
      <header className={styles.topbar}>
        <CapaBandeiras />
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

      <div className={styles.scroller}>
        {lista.length === 0 && (
          <div className={styles.empty}>Nenhum item encontrado para “{q}”.</div>
        )}
        {lista.map((b, i) => (
          <section key={b.id} className={styles.barraca} style={{ animationDelay: `${Math.min(i * 45, 480)}ms` }}>
            <div className={styles.barracaHead}>
              <span className={styles.barracaEmoji}>{b.emoji}</span>
              <span className={styles.barracaNome}>{b.nome}</span>
              {b.tipo === "diversao" && <span className={styles.barracaTipo}>Diversão</span>}
            </div>
            {b.itens.map((it) => (
              <div key={`${b.id}::${it.nome}`} className={styles.item}>
                <span className={styles.itemNome}>{highlight(it.nome)}</span>
                <span className={styles.itemPreco}>{brl(it.preco)}</span>
              </div>
            ))}
          </section>
        ))}
      </div>

    </>
  );
}

/* ───────────────────────── Barra de navegação (abas) ───────────────────────── */
function TabBar({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const tabs: { id: Screen; icon: string; label: string }[] = [
    { id: "mapa", icon: "🗺️", label: "Mapa" },
    { id: "ginasio", icon: "🏟️", label: "Ginásio" },
    { id: "programacao", icon: "🎭", label: "Apresentações" },
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
