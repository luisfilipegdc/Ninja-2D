"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import Bunting from "@/components/Bunting";
import { getSupabase, EVENT } from "@/lib/supabase";
import type { Card, EventRow, GameState, Level, Media, ScoreRow } from "@/lib/types";
import { isNameClean } from "@/lib/badwords";

/* ===================== helpers puros ===================== */
type ViewId = "splash" | "game" | "scan" | "card" | "chest" | "ranking" | "admin" | "montar";
type Method = "nfc" | "nfctap" | "none";

const LS_SESS = "arraia.session.v2";
const LS_RANK = "arraia.ranking.v1";
const LS_CARDS = "arraia.cardcache.v1";
const LS_MESTRE = "arraia.mestre";
const LS_EGGS = "arraia.eggs.v1";
const EGGS_TOTAL = 3; // chuva, sopro, nome mágico

// Nomes mágicos: cada um dispara uma animação temática correlata ao nome
const MAGIC_NAMES: Record<string, { anim: "catolica" | "saojoao" | "festa" | "milho"; toast: string }> = {
  "marcelino": { anim: "catolica", toast: "🕊️ Paz e bem! O espírito de Marcelino Champagnat te abençoa ✝️" },
  "sao joao":  { anim: "saojoao",  toast: "🎆 Viva São João! A festa junina é dele — e a fogueira também 🔥" },
  "festa junina": { anim: "festa", toast: "💃🕺 É arraiá! Puxa a quadrilha que a festa começou 🎪" },
  "ze do milho": { anim: "milho",  toast: "🌽 Pamonha, curau e canjica! Zé do Milho passou por aqui" },
};

// Prêmio do baú — edite aqui pra mudar a copy na splash e no baú
const PREMIO = "uma lembrancinha junina";
// Pistas temáticas da ordem da senha (gamificação "Monte o código")
const POS_CLUE: Record<number, { emoji: string; word: string }> = {
  1: { emoji: "🌽", word: "abre a senha" },
  2: { emoji: "🪗", word: "fica no meio" },
  3: { emoji: "🔥", word: "fecha a senha" },
};
const ORDINAL: Record<number, string> = { 1: "1ª", 2: "2ª", 3: "3ª" };

// Níveis de dificuldade (escolhidos na splash)
const LEVELS: { id: Level; emoji: string; label: string; desc: string }[] = [
  { id: "facil", emoji: "🐣", label: "Fácil", desc: "5 a 7 anos · senha vem pronta" },
  { id: "medio", emoji: "🌽", label: "Médio", desc: "8 a 10 anos · monte com pistas" },
  { id: "dificil", emoji: "🔥", label: "Difícil", desc: "11 a 13 anos · sem pistas" },
  { id: "impossivel", emoji: "💃", label: "Impossível", desc: "14+ · contas, iscas e a quadrilha embolada" },
];

// "Continha" que resulta no dígito (nível impossível) — força decifrar
function riddleFor(d: number): string {
  const ops: string[] = [];
  if (d >= 1) { const a = Math.floor(Math.random() * (d + 1)); ops.push(a + "+" + (d - a)); }
  for (let a = 2; a < d; a++) if (d % a === 0) ops.push(a + "×" + (d / a));
  const k = 1 + Math.floor(Math.random() * 5); ops.push((d + k) + "−" + k);
  return ops[Math.floor(Math.random() * ops.length)] || String(d);
}

function fmt(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return m + ":" + s;
}
function extractCode(text: string): string | null {
  if (typeof text !== "string") return null;
  text = text.trim();
  const m = text.match(/[?&]c=([^&\s#]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  if (/^[A-Za-z0-9_-]{4,40}$/.test(text)) return text;
  return null;
}
function ytId(url: string): string | null {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function mediaIcon(m: Media | null) {
  return ({ texto: "📝", imagem: "🖼️", youtube: "▶️", spotify: "🎵", audio: "🔊" } as Record<string, string>)[m || ""] || "📜";
}
function spotifyEmbed(url: string): string | null {
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}
function randCode() { let s = ""; const h = "0123456789abcdef"; for (let i = 0; i < 8; i++) s += h[(Math.random() * 16) | 0]; return s; }
function vibrate(p: number | number[]) { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p); }

interface LocalEntry { name: string; ms: number; at: number; total: number; lock: number; }
function loadRank(): LocalEntry[] { try { return JSON.parse(localStorage.getItem(LS_RANK) || "[]"); } catch { return []; } }
function saveRank(l: LocalEntry[]) { localStorage.setItem(LS_RANK, JSON.stringify(l)); }
function localRows(L: number): ScoreRow[] {
  return loadRank().filter(e => e.lock === L).sort((a, b) => a.ms - b.ms).map(e => ({ id: "local_" + e.at, name: e.name, ms: e.ms }));
}

/* ===================== Componente principal ===================== */
export default function Game({ start }: { start?: "admin" } = {}) {
  const [view, setView] = useState<ViewId>("splash");
  const [game, setGame] = useState<GameState | null>(null);
  const activeLock = 1; // cadeado único
  const [elapsed, setElapsed] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("medio");
  const [splashStep, setSplashStep] = useState<1 | 2>(1);
  const [splashMsg, setSplashMsg] = useState("");
  const [toast, setToast] = useState("");
  const [social, setSocial] = useState("");
  const socialT = useRef<any>(null);
  const [mestre, setMestre] = useState(false);
  const [fogueiraOut, setFogueiraOut] = useState(false);
  const [blowOn, setBlowOn] = useState(false);
  const [foundEggs, setFoundEggs] = useState<string[]>([]);
  const foundEggsRef = useRef<string[]>([]);
  const markEgg = useCallback((id: string) => {
    if (foundEggsRef.current.includes(id)) return;
    const next = [...foundEggsRef.current, id];
    foundEggsRef.current = next; setFoundEggs(next);
  }, []);
  const resetEggs = useCallback(() => {
    foundEggsRef.current = [];
    setFoundEggs([]); setMestre(false);
  }, []);

  // scanner
  const [scanErr, setScanErr] = useState("");
  const [scanHint, setScanHint] = useState("");

  // card reveal
  const [cardView, setCardView] = useState<{ kind: "senha" | "curio"; node: React.ReactNode; kicker: string; cta: string } | null>(null);
  const afterCardRef = useRef<() => void>(() => {});

  // chest
  const [chest, setChest] = useState<{ lock: number; combo: (number | string)[] } | null>(null);
  const [chestRank, setChestRank] = useState<ScoreRow[]>([]);
  const [chestBoth, setChestBoth] = useState(false);

  // "Monte o código" (gamificação da ordem da senha)
  type Chip = { id: string; digit: number; pos: number; label: string; decoy?: boolean };
  const [montarOk, setMontarOk] = useState(false);
  const [montarSlots, setMontarSlots] = useState<(Chip | null)[]>([null, null, null]);
  const [montarPool, setMontarPool] = useState<Chip[]>([]);
  const [montarErr, setMontarErr] = useState(false);
  // zoeiras do impossível (estilo Level Devil)
  const [confDodge, setConfDodge] = useState(0);
  const [confXY, setConfXY] = useState<{ x: number; y: number } | null>(null);
  const [fakeOff, setFakeOff] = useState(false);
  const fakeWinUsed = useRef(false);

  // ranking
  const [rank1, setRank1] = useState<ScoreRow[]>([]);

  // refs (latest values em callbacks async)
  const gameRef = useRef<GameState | null>(null);
  const scanActiveRef = useRef(false);
  const myScoreId = useRef<string | null>(null);
  const ambientRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const hotRef = useRef<HTMLDivElement | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const channelsRef = useRef<any[]>([]);
  const burstRef = useRef<() => void>(() => {});
  const rainRef = useRef<() => void>(() => {});
  const fireworksRef = useRef<() => void>(() => {});
  const heartsRef = useRef<() => void>(() => {});
  const balloonsRef = useRef<() => void>(() => {});
  const catolicaRef = useRef<() => void>(() => {});
  const milhoRef = useRef<() => void>(() => {});
  const floresRef = useRef<() => void>(() => {});
  const blowRef = useRef<{ stop: () => void } | null>(null);
  const lastErrRef = useRef(0);
  const toastT = useRef<any>(null);

  useEffect(() => { gameRef.current = game; }, [game]);

  const sb = useMemo(() => getSupabase(), []);

  const logEvent = useCallback((kind: "scan" | "complete" | "admin", info: { actor?: string | null; code?: string | null; detail?: string | null }) => {
    if (!sb) return;
    try { sb.from("events").insert({ game_id: EVENT, kind, actor: info.actor ?? null, code: info.code ?? null, detail: info.detail ?? null }).then(() => {}, () => {}); } catch {}
  }, [sb]);

  // device flags (client)
  const flags = useMemo(() => {
    if (typeof window === "undefined") return { NFC_OK: false, isIOS: false, isAndroid: false, isStandalone: false };
    const ua = navigator.userAgent;
    return {
      NFC_OK: "NDEFReader" in window,
      isIOS: /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      isAndroid: /android/i.test(ua),
      isStandalone: window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true,
    };
  }, []);

  /* ---------- sessão ---------- */
  const persist = useCallback(() => {
    if (gameRef.current) localStorage.setItem(LS_SESS, JSON.stringify({ active: true, ...gameRef.current }));
  }, []);
  const syncGame = useCallback(() => { setGame(gameRef.current ? { ...gameRef.current } : null); }, []);
  const clearSession = useCallback(() => localStorage.removeItem(LS_SESS), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2600);
  }, []);
  const showSocial = useCallback((msg: string) => {
    setSocial(msg); vibrate([15, 30, 15]);
    clearTimeout(socialT.current);
    socialT.current = setTimeout(() => setSocial(""), 6000);
  }, []);
  const flashErr = useCallback((msg: string) => {
    const now = Date.now();
    if (now - lastErrRef.current < 1500) return;
    lastErrRef.current = now;
    setScanErr(msg); showToast(msg); vibrate(120);
  }, [showToast]);

  /* ---------- fullscreen ---------- */
  const tryFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
    const el: any = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch {} }
  }, []);
  const goFullscreen = useCallback(() => {
    tryFullscreen();
    const so: any = typeof screen !== "undefined" ? (screen as any).orientation : null;
    if (so && so.lock) { try { const p = so.lock("portrait"); if (p && p.catch) p.catch(() => {}); } catch {} }
  }, [tryFullscreen]);

  /* ---------- estado dos cadeados ---------- */
  const lockFilled = (g: GameState, L: number) => { let n = 0; for (let p = 1; p <= 3; p++) if (g.locks[L]?.[p] != null) n++; return n; };
  const lockComplete = (g: GameState, L: number) => lockFilled(g, L) >= 3;
  const bothDone = (g: GameState) => lockComplete(g, 1);

  /* ---------- cartões (Supabase + cache) ---------- */
  const cacheCard = (c: Card) => { try { const m = JSON.parse(localStorage.getItem(LS_CARDS) || "{}"); m[c.code] = c; localStorage.setItem(LS_CARDS, JSON.stringify(m)); } catch {} };
  const cachedCard = (code: string): Card | null => { try { return JSON.parse(localStorage.getItem(LS_CARDS) || "{}")[code] || null; } catch { return null; } };
  const fetchCard = useCallback(async (code: string): Promise<Card | null> => {
    if (sb) {
      try {
        const { data, error } = await sb.from("cards").select("*").eq("code", code).maybeSingle();
        if (!error && data) { cacheCard(data as Card); return data as Card; }
      } catch {}
    }
    return cachedCard(code);
  }, [sb]);

  /* ---------- ranking ---------- */
  const sbInsert = useCallback(async (gid: string, nm: string, ms: number, total: number) => {
    if (!sb) return null;
    try {
      const { data, error } = await sb.from("scores").insert({ game_id: gid, name: nm.slice(0, 40), ms, total }).select("id").single();
      return !error && data ? (data as any).id as string : null;
    } catch { return null; }
  }, [sb]);
  const sbTop = useCallback(async (gid: string): Promise<ScoreRow[] | null> => {
    if (!sb) return null;
    try {
      const { data, error } = await sb.from("scores").select("id,name,ms").eq("game_id", gid).order("ms", { ascending: true }).limit(20);
      return error ? null : ((data || []) as ScoreRow[]);
    } catch { return null; }
  }, [sb]);
  const unsubAll = useCallback(() => { if (sb) channelsRef.current.forEach(ch => { try { sb.removeChannel(ch); } catch {} }); channelsRef.current = []; }, [sb]);
  const lockGameId = (L: number) => EVENT + ":L" + L;

  const loadLockBoard = useCallback(async (L: number, set: (r: ScoreRow[]) => void) => {
    const rows = await sbTop(lockGameId(L));
    set(rows ?? localRows(L));
  }, [sbTop]);

  /* ---------- timer ---------- */
  useEffect(() => {
    if (!game) return;
    const id = setInterval(() => { if (gameRef.current && !bothDone(gameRef.current)) setElapsed(Date.now() - gameRef.current.startedAt); }, 500);
    return () => clearInterval(id);
  }, [game]);

  /* ---------- launch (?c=) ---------- */
  useEffect(() => {
    // Modo Mestre / segredos são EFÊMEROS: reiniciam a cada atualização da página.
    // Limpa qualquer estado antigo que tenha ficado salvo.
    try { localStorage.removeItem(LS_MESTRE); localStorage.removeItem(LS_EGGS); } catch {}
    try { sessionStorage.removeItem(LS_MESTRE); sessionStorage.removeItem(LS_EGGS); } catch {}
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) {
      let sess: GameState | null = null;
      try { sess = JSON.parse(localStorage.getItem(LS_SESS) || "null"); } catch {}
      try { window.history.replaceState({}, "", window.location.origin + window.location.pathname); } catch {}
      if (sess && (sess as any).active) {
        gameRef.current = sess; setGame(sess);
        processCode(c);
        return;
      }
      setSplashMsg("Comece primeiro: toque em Iniciar caçada e digite seu nome. Depois é só encostar nos cartões. 😉");
    }
    // service worker
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- anti-cópia (menu direito + copiar/recortar), exceto campos ---------- */
  useEffect(() => {
    const inField = (t: EventTarget | null) => !!(t && (t as HTMLElement).closest && (t as HTMLElement).closest("input,textarea,select,[contenteditable='true']"));
    const onCtx = (e: MouseEvent) => { if (!inField(e.target)) e.preventDefault(); };
    const onCopy = (e: ClipboardEvent) => { if (!inField(e.target)) e.preventDefault(); };
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    return () => { document.removeEventListener("contextmenu", onCtx); document.removeEventListener("copy", onCopy); document.removeEventListener("cut", onCopy); };
  }, []);

  /* ---------- easter egg: chacoalhar → chuva ---------- */
  useEffect(() => {
    let last = 0, lx = 0, ly = 0, lz = 0, primed = false;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const x = a.x || 0, y = a.y || 0, z = a.z || 0;
      const delta = Math.abs(x - lx) + Math.abs(y - ly) + Math.abs(z - lz);
      lx = x; ly = y; lz = z;
      if (!primed) { primed = true; return; }
      if (delta > 45) {
        const now = Date.now(); if (now - last < 4000) return; last = now;
        vibrate([20, 30, 20]); rainRef.current(); markEgg("chuva"); showToast("☔ Olha a chuva… é mentira! 😄");
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [showToast, markEgg]);

  /* ---------- prova social ao vivo (broadcast em tempo real) ---------- */
  const playing = !!game;
  useEffect(() => {
    if (!sb || !playing) return;
    const ch = sb.channel("social_" + EVENT)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: "game_id=eq." + EVENT }, (payload: any) => {
        const e = payload?.new; if (!e || e.kind !== "complete") return;
        const me = gameRef.current?.name;
        if (e.actor && e.actor !== me) showSocial(`🔥 ${e.actor} acabou de abrir o baú! Não fica pra trás — seja o próximo 🤠`);
      }).subscribe();
    return () => { try { sb.removeChannel(ch); } catch {} };
  }, [sb, playing, showSocial]);

  /* ---------- prova social periódica (1,3,5,10,20… min) ---------- */
  useEffect(() => {
    if (!sb || !playing) return;
    let alive = true;
    const fire = async () => {
      if (!alive) return;
      try {
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: scans } = await sb.from("events").select("actor").eq("game_id", EVENT).eq("kind", "scan").gte("at", since);
        const players = new Set((scans || []).map((r: any) => r.actor).filter(Boolean));
        const { data: comps } = await sb.from("events").select("actor").eq("game_id", EVENT).eq("kind", "complete").order("at", { ascending: false }).limit(8);
        const completes = (comps || []).map((r: any) => r.actor).filter(Boolean);
        const opts: string[] = [];
        if (players.size >= 3) opts.push(`🤠 ${players.size} caipiras estão caçando agora!`);
        if (completes.length) opts.push(`🏆 ${completes[(Math.random() * completes.length) | 0]} já descobriu a senha — seja o próximo! 🔥`);
        if (!opts.length) opts.push("🔥 A caçada tá rolando! Ache os 3 números e abra o baú 🎁");
        if (alive) showSocial(opts[(Math.random() * opts.length) | 0]);
      } catch { /* ignora */ }
    };
    const marks = [1, 3, 5, 10, 20, 30, 45, 60, 90, 120];
    const timers = marks.map(m => setTimeout(fire, m * 60 * 1000));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [sb, playing, showSocial]);

  /* ---------- confete ---------- */
  useEffect(() => {
    const cvs = confettiRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d")!; let parts: any[] = []; let rafOn = false;
    const COLORS = ["#e23b2e", "#f9c21a", "#e84c97", "#28a8e0", "#6e5ba6", "#ffffff"];
    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      parts.forEach(p => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life++; if (p.sw) p.sway += p.sw;
        if (p.kind === "rain") {
          ctx.strokeStyle = p.c; ctx.lineWidth = p.s; ctx.lineCap = "round"; ctx.globalAlpha = p.a;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .6, p.y - p.vy * 1.1); ctx.stroke(); ctx.globalAlpha = 1;
        } else if (p.kind === "spark") {
          p.vx *= 0.97; p.vy *= 0.97;
          const fade = 1 - p.life / p.max;
          ctx.globalAlpha = Math.max(0, fade); ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (p.kind === "heart") {
          const fade = p.life > p.max * 0.7 ? Math.max(0, 1 - (p.life - p.max * 0.7) / (p.max * 0.3)) : 1;
          ctx.globalAlpha = fade; ctx.font = p.s + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(p.e, p.x + Math.sin(p.sway) * 12, p.y); ctx.globalAlpha = 1;
        } else if (p.kind === "balloon") {
          const fade = p.life > p.max * 0.78 ? Math.max(0, 1 - (p.life - p.max * 0.78) / (p.max * 0.22)) : 1;
          ctx.globalAlpha = fade;
          const bx = p.x + Math.sin(p.sway) * 14, by = p.y, rx = p.s * 0.52, ry = p.s * 0.66;
          ctx.strokeStyle = "rgba(190,205,230,.45)"; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(bx, by + ry); ctx.quadraticCurveTo(bx + 7, by + ry + p.s * 0.5, bx, by + ry + p.s); ctx.stroke();
          const g2 = ctx.createRadialGradient(bx - rx * 0.35, by - ry * 0.45, 1, bx, by, ry * 1.5);
          g2.addColorStop(0, p.hl); g2.addColorStop(1, p.c);
          ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, 6.28); ctx.fill();
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(bx - 3, by + ry); ctx.lineTo(bx + 3, by + ry); ctx.lineTo(bx, by + ry + 5); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
        }
      });
      parts = parts.filter(p => p.y < cvs.height + 40 && p.life < (p.max || 260));
      if (parts.length) requestAnimationFrame(tick); else { rafOn = false; ctx.clearRect(0, 0, cvs.width, cvs.height); }
    };
    burstRef.current = () => {
      for (let i = 0; i < 90; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * 0.42,
        vx: (Math.random() - .5) * 9, vy: -(Math.random() * 11 + 5), g: 0.28 + Math.random() * 0.12, s: 5 + Math.random() * 7,
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * 0.4, c: COLORS[(Math.random() * COLORS.length) | 0], life: 0 });
      if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
    };
    const RAIN = ["#9fd6f5", "#bfe3ff", "#d6ecff", "#8ecbf0"];
    rainRef.current = () => {
      for (let i = 0; i < 240; i++) parts.push({ kind: "rain", x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 1.1,
        vx: 2.4 + Math.random() * 1.8, vy: 15 + Math.random() * 11, g: 0.12, s: 1.8 + Math.random() * 2.2,
        a: 0.45 + Math.random() * 0.45, c: RAIN[(Math.random() * RAIN.length) | 0], life: 0 });
      if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
    };
    const FIRE = ["#f9c21a", "#ffd84a", "#e23b2e", "#e84c97", "#28a8e0", "#ffffff"];
    const shell = (cx: number, cy: number) => {
      const c = FIRE[(Math.random() * FIRE.length) | 0];
      const n = 22 + (Math.random() * 10 | 0);
      const spd = 4 + Math.random() * 2.2;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 6.28 + Math.random() * 0.2;
        const v = spd * (0.6 + Math.random() * 0.5);
        parts.push({ kind: "spark", x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
          g: 0.05, s: 1.8 + Math.random() * 1.8, c, life: 0, max: 50 + (Math.random() * 26 | 0) });
      }
    };
    fireworksRef.current = () => {
      const launch = (n: number) => {
        for (let i = 0; i < n; i++) shell(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.18 + Math.random() * 0.32));
        if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
      };
      launch(2);
      setTimeout(() => launch(2), 300);
      setTimeout(() => launch(3), 660);
    };
    const HEARTS = ["❤️", "💖", "💗", "💕", "🤍", "💞"];
    const floatUp = (mk: (i: number) => any, n: number, waves: number) => {
      const wave = () => { for (let i = 0; i < n; i++) parts.push(mk(i)); if (!rafOn) { rafOn = true; requestAnimationFrame(tick); } };
      wave(); for (let w = 1; w < waves; w++) setTimeout(wave, w * 380);
    };
    heartsRef.current = () => floatUp(() => ({
      kind: "heart", x: innerWidth * (0.08 + Math.random() * 0.84), y: innerHeight + 12 + Math.random() * 22,
      vx: 0, vy: -(1.5 + Math.random() * 1.7), g: 0, s: 20 + Math.random() * 22,
      sway: Math.random() * 6.28, sw: 0.03 + Math.random() * 0.03, e: HEARTS[(Math.random() * HEARTS.length) | 0],
      life: 0, max: 150 + (Math.random() * 90 | 0) }), 9, 3);
    balloonsRef.current = () => floatUp(() => {
      const navy = ["#15375d", "#1b3a6b", "#0f2c4d", "#21487f"][(Math.random() * 4) | 0];
      return { kind: "balloon", x: innerWidth * (0.1 + Math.random() * 0.8), y: innerHeight + 16 + Math.random() * 26,
        vx: 0, vy: -(1.2 + Math.random() * 1.4), g: 0, s: 34 + Math.random() * 20,
        sway: Math.random() * 6.28, sw: 0.02 + Math.random() * 0.022, c: navy, hl: "#5b86c4",
        life: 0, max: 170 + (Math.random() * 90 | 0) };
    }, 7, 3);
    const floatEmoji = (emojis: string[], sMin: number, sRange: number, n: number) => floatUp(() => ({
      kind: "heart", x: innerWidth * (0.08 + Math.random() * 0.84), y: innerHeight + 12 + Math.random() * 24,
      vx: 0, vy: -(1.3 + Math.random() * 1.5), g: 0, s: sMin + Math.random() * sRange,
      sway: Math.random() * 6.28, sw: 0.022 + Math.random() * 0.03, e: emojis[(Math.random() * emojis.length) | 0],
      life: 0, max: 165 + (Math.random() * 90 | 0) }), n, 3);
    catolicaRef.current = () => floatEmoji(["✝️", "🕊️", "🙏", "✨", "🤍"], 22, 18, 8);
    milhoRef.current = () => floatEmoji(["🌽"], 26, 14, 9);
    floresRef.current = () => floatEmoji(["🌻", "🌼", "🌷", "🌺", "💐", "🌸"], 24, 20, 9);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const burst = useCallback(() => burstRef.current(), []);

  /* ---------- ambiente (brasas + vaga-lumes) ---------- */
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce && reduce.matches) return;
    const cvs = ambientRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d")!; let W = 0, H = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { W = innerWidth; H = innerHeight; cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr); cvs.style.width = W + "px"; cvs.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener("resize", resize);
    const area = Math.max(1, (W * H) / (390 * 740));
    const EMBERS = Math.min(20, Math.round(13 * area)), FLIES = Math.min(10, Math.round(7 * area));
    const fireViews = ["splash", "card", "chest"];
    const fireActive = () => fireViews.includes(viewRef.current);
    const srcX = () => W * 0.5 + (Math.random() - 0.5) * Math.min(W * 0.42, 150);
    const newEmber = (seed: boolean): any => ({ x: srcX(), y: seed ? Math.random() * H : H + 10, vx: (Math.random() - .5) * .25, vy: -(.35 + Math.random() * .7), size: 1 + Math.random() * 2.2, life: 0, max: 180 + Math.random() * 160, hue: 20 + Math.random() * 28, sway: Math.random() * 6.28, swaySpeed: .01 + Math.random() * .02 });
    const newFly = (): any => ({ x: Math.random() * W, y: Math.random() * H, base: .16 + Math.random() * .3, r: 1.3 + Math.random() * 1.7, ph: Math.random() * 6.28, pSpeed: .012 + Math.random() * .02, dx: (Math.random() - .5) * .18, dy: (Math.random() - .5) * .18, t: Math.random() * 1000 });
    let embers = Array.from({ length: EMBERS }, () => newEmber(true));
    const flies = Array.from({ length: FLIES }, () => newFly());
    let running = true, raf = 0;
    const onVis = () => { running = !document.hidden; if (running) raf = requestAnimationFrame(loop); };
    document.addEventListener("visibilitychange", onVis);
    function loop() {
      if (!running) return;
      if (viewRef.current === "admin") { ctx.clearRect(0, 0, W, H); raf = requestAnimationFrame(loop); return; }
      ctx.clearRect(0, 0, W, H);
      for (const fl of flies) {
        fl.t += 1; fl.ph += fl.pSpeed; fl.x += fl.dx + Math.sin(fl.t * .01) * .12; fl.y += fl.dy + Math.cos(fl.t * .013) * .12;
        if (fl.x < -10) fl.x = W + 10; if (fl.x > W + 10) fl.x = -10; if (fl.y < -10) fl.y = H + 10; if (fl.y > H + 10) fl.y = -10;
        const glow = fl.base * (.45 + .55 * (.5 + .5 * Math.sin(fl.ph)));
        const g = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r * 5);
        g.addColorStop(0, "rgba(255,236,150," + glow + ")"); g.addColorStop(.4, "rgba(180,230,120," + glow * .5 + ")"); g.addColorStop(1, "rgba(180,230,120,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r * 5, 0, 6.2832); ctx.fill();
      }
      if (fireActive()) {
        ctx.globalCompositeOperation = "lighter";
        for (let e = 0; e < embers.length; e++) {
          const em = embers[e]; em.life++; em.sway += em.swaySpeed; em.x += em.vx + Math.sin(em.sway) * .4; em.y += em.vy; em.vy -= .0008;
          const k = em.life / em.max; if (k >= 1 || em.y < -20) { embers[e] = newEmber(false); continue; }
          const alpha = Math.sin(k * Math.PI) * .85, r2 = em.size * (1.4 - k * .5);
          const eg = ctx.createRadialGradient(em.x, em.y, 0, em.x, em.y, r2 * 4);
          eg.addColorStop(0, "hsla(" + em.hue + ",100%,72%," + alpha + ")"); eg.addColorStop(.5, "hsla(" + em.hue + ",100%,55%," + alpha * .5 + ")"); eg.addColorStop(1, "hsla(" + em.hue + ",100%,50%,0)");
          ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(em.x, em.y, r2 * 4, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // hot-flash ao abrir o baú
  const viewRef = useRef<ViewId>("splash");
  useEffect(() => {
    viewRef.current = view;
    if (view === "chest" && hotRef.current) { const h = hotRef.current; h.classList.remove("go"); void h.offsetWidth; h.classList.add("go"); }
  }, [view]);

  /* ===================== fluxo do jogo ===================== */
  const renderHub = useCallback(() => { setView("game"); }, []);

  const goStep2 = useCallback(() => {
    const nm = name.trim();
    if (!nm) { setSplashMsg("Digite seu nome de caipira 😊"); return; }
    if (!isNameClean(nm)) { vibrate([60, 40, 60]); setSplashMsg("Ô caipira! 😅 Vamos manter o arraiá pra toda a família — escolhe outro nome."); return; }
    setSplashMsg(""); setSplashStep(2);
  }, [name]);

  const startHunt = useCallback(() => {
    const nm = name.trim();
    if (!nm) return;
    if (!isNameClean(nm)) { vibrate([60, 40, 60]); setSplashMsg("Ô caipira! 😅 Vamos manter o arraiá pra toda a família — escolhe outro nome."); return; }
    setSplashMsg("");
    goFullscreen();
    // easter egg: nome mágico
    const magic = nm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const spell = MAGIC_NAMES[magic];
    if (spell) {
      setMestre(true); markEgg("nome"); vibrate([30, 40, 30, 40, 140]);
      const anim = spell.anim === "catolica" ? catolicaRef : spell.anim === "saojoao" ? fireworksRef : spell.anim === "milho" ? milhoRef : burstRef;
      anim.current();
      showToast(spell.toast);
    } else if (["emanuela bastos", "ester bastos"].includes(magic)) {
      vibrate([20, 40, 20, 40, 20]); heartsRef.current();
      showToast("💖 " + nm + ", um arraiá cheio de amor! 💕");
    } else if (["luis bezaleu", "estevao bastos"].includes(magic)) {
      vibrate([20, 40, 20, 40, 20]); balloonsRef.current();
      showToast("🎈 Balões pra você, " + nm + "! Voa alto 💙");
    } else if (magic === "maria flor") {
      vibrate([20, 40, 20, 40, 20]); floresRef.current();
      showToast("🌻 Um jardim de flores pra você, " + nm + "! 💐");
    }
    const g: GameState = { name: nm, startedAt: Date.now(), gameId: EVENT, locks: { 1: {} }, seen: [], doneLocks: [], active: true, level, coringa: null };
    gameRef.current = g; setGame(g); persist(); vibrate([40, 40, 120]);
    setView("game");
  }, [name, level, goFullscreen, persist, markEgg, showToast]);

  const completeLock = useCallback((L: number) => {
    const g = gameRef.current!; const combo: (number | string)[] = [];
    for (let p = 1; p <= 3; p++) combo.push(g.locks[L]?.[p] ?? "?");
    setChest({ lock: L, combo });
    const gid = lockGameId(L);
    if (!g.doneLocks.includes(L)) {
      g.doneLocks.push(L); persist(); syncGame();
      const ms = Date.now() - g.startedAt;
      logEvent("complete", { actor: g.name, detail: "concluiu o cadeado em " + fmt(ms) });
      const list = loadRank(); list.push({ name: g.name, ms, at: Date.now(), total: 3, lock: L }); list.sort((a, b) => a.ms - b.ms); saveRank(list);
      myScoreId.current = "local_" + list.find(e => e.lock === L && e.name === g.name)!.at;
      setChestRank(localRows(L));
      burst(); setTimeout(burst, 350);
      (async () => {
        const id = await sbInsert(gid, g.name, ms, 3); if (id) myScoreId.current = id;
        const rows = await sbTop(gid); setChestRank(rows ?? localRows(L));
        if (sb) { unsubAll(); const ch = sb.channel("sc_" + gid).on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: "game_id=eq." + gid }, async () => { const r = await sbTop(gid); setChestRank(r ?? localRows(L)); }).subscribe(); channelsRef.current.push(ch); }
      })();
    } else {
      setChestRank(localRows(L));
    }
    setChestBoth(bothDone(g));
    resetEggs(); // easter eggs desligam ao concluir a senha
    setView("chest");
  }, [persist, syncGame, burst, sbInsert, sbTop, sb, unsubAll, resetEggs, logEvent]);

  const buildChips = useCallback((g: GameState): Chip[] => {
    const lvl = g.level || "medio";
    const items: Chip[] = [1, 2, 3].map(p => {
      const d = g.locks[1]?.[p] as number;
      return { id: "r" + p, digit: d, pos: p, label: lvl === "impossivel" ? riddleFor(d) : String(d) };
    });
    if (lvl === "impossivel") {
      const nDecoys = g.coringa === "easy" ? 0 : g.coringa === "hard" ? 3 : 2; // coringa: alívio / pesadelo
      const real = new Set([1, 2, 3].map(p => g.locks[1]?.[p] as number));
      const avail: number[] = []; for (let d = 0; d <= 9; d++) if (!real.has(d)) avail.push(d);
      for (let i = avail.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [avail[i], avail[j]] = [avail[j], avail[i]]; }
      avail.slice(0, nDecoys).forEach((fake, k) => items.push({ id: "d" + k, digit: fake, pos: 0, label: riddleFor(fake), decoy: true }));
    }
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  }, []);

  const peekUsed = useRef(false);
  const montarPeek = useCallback(() => {
    if (peekUsed.current) return; peekUsed.current = true;
    const g = gameRef.current!;
    const correct: Chip[] = [1, 2, 3].map(p => ({ id: "r" + p, digit: g.locks[1]?.[p] as number, pos: p, label: String(g.locks[1]?.[p]) }));
    setMontarSlots(correct); setMontarPool([]); vibrate(20);
    setTimeout(() => montarReset(), 50); // pisca a senha por ~0,05s (zoeira)
    setTimeout(() => showToast("👀 Piscou! Viu ou não viu? 😅"), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMontar = useCallback(() => {
    peekUsed.current = false; fakeWinUsed.current = false; setConfDodge(0); setConfXY(null); setFakeOff(false);
    setMontarPool(buildChips(gameRef.current!)); setMontarSlots([null, null, null]); setMontarErr(false); setView("montar");
  }, [buildChips]);

  const montarPlace = useCallback((chip: Chip) => {
    vibrate(8); setMontarErr(false);
    const inverted = gameRef.current?.level === "impossivel"; // lógica espelhada (preenche da direita)
    setMontarSlots(prev => {
      let i = -1;
      if (inverted) { for (let k = prev.length - 1; k >= 0; k--) if (prev[k] == null) { i = k; break; } }
      else i = prev.findIndex(s => s == null);
      if (i < 0) return prev; const next = prev.slice(); next[i] = chip; return next;
    });
    setMontarPool(prev => prev.filter(c => c.id !== chip.id));
  }, []);

  const montarRemove = useCallback((i: number) => {
    vibrate(8); setMontarErr(false);
    setMontarSlots(prev => { const c = prev[i]; if (!c) return prev; setMontarPool(p => [...p, c]); const next = prev.slice(); next[i] = null; return next; });
  }, []);

  const playSuccess = useCallback(() => {
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC(); const t0 = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        const t = t0 + i * 0.1;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        o.start(t); o.stop(t + 0.36);
      });
      setTimeout(() => { try { ctx.close(); } catch {} }, 1300);
    } catch { /* sem áudio */ }
  }, []);

  const montarReset = useCallback(() => {
    setMontarPool(buildChips(gameRef.current!)); setMontarSlots([null, null, null]);
  }, [buildChips]);

  const montarCheck = useCallback(() => {
    const ok = montarSlots.every((c, i) => c && !c.decoy && c.pos === i + 1);
    if (ok) {
      // falso "ganhou" (1x no impossível) — caminho falso seguro do Level Devil
      if (gameRef.current?.level === "impossivel" && !fakeWinUsed.current) {
        fakeWinUsed.current = true; vibrate([200]); showToast("🎉 VOCÊ GANHOU!… 😜 mentira!");
        setTimeout(() => montarReset(), 1300); return;
      }
      setMontarOk(true); vibrate([40, 40, 40, 40, 220]); playSuccess(); burst(); setTimeout(burst, 260);
      setTimeout(() => { setMontarOk(false); completeLock(1); }, 1200);
    } else {
      vibrate([90, 60, 90, 60, 120]); setMontarErr(true); showToast("Quase! 🔥 Tenta outra ordem");
      setTimeout(() => { setMontarErr(false); montarReset(); }, 550);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montarSlots, completeLock, showToast, playSuccess, burst, montarReset]);

  // zoeiras do impossível enquanto monta: fichas fujonas + reset surpresa + fake desligar
  useEffect(() => {
    if (view !== "montar" || gameRef.current?.level !== "impossivel") return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setMontarPool(p => { const a = p.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
      if (n % 4 === 0) { showToast("💃 Anarriê! Embolou tudo!"); montarReset(); }
      if (n % 6 === 0) { setFakeOff(true); setTimeout(() => setFakeOff(false), 1100); }
    }, 3000);
    return () => clearInterval(id);
  }, [view, montarReset, showToast]);

  const revealSenha = useCallback((card: Card) => {
    const g = gameRef.current!; const L = card.lock || 1, pos = card.position!, digit = card.digit!;
    if (!g.locks[L]) g.locks[L] = {};
    const already = g.locks[L][pos] != null;
    g.locks[L][pos] = digit;
    if (!g.seen.includes(card.code)) g.seen.push(card.code);
    persist(); syncGame();
    vibrate([40, 30, 40, 30, 160]); burst(); setTimeout(burst, 300);
    const complete = lockComplete(g, L) && !g.doneLocks.includes(L);
    const lvl = g.level || "medio";
    const clue = POS_CLUE[pos];
    // a "pista de posição" só aparece no fácil (direta) e médio (temática)
    const where = lvl === "facil"
      ? <div className="senha-where">entra na <b>casa {pos}</b> do cadeado</div>
      : lvl === "medio"
        ? <div className="senha-where"><span className="clue-emoji">{clue.emoji}</span> esse número <b>{clue.word}</b></div>
        : <div className="senha-where">Guarde esse número! 🤫</div>;
    const node = (
      <div className="senha-reveal">
        <div className="senha-digit">{digit}</div>
        {where}
        {card.hint ? <p className="senha-hint">💬 {card.hint}</p> : null}
      </div>
    );
    // fácil: senha vem pronta (vai direto pro baú); demais: monta o código
    afterCardRef.current = complete ? (lvl === "facil" ? () => completeLock(L) : openMontar) : renderHub;
    setCardView({ kind: "senha", node, kicker: already ? "Você já tinha esse número 😉" : "Achou um número da senha!", cta: complete ? (lvl === "facil" ? "Ver a senha do cadeado 🔐" : "🧩 Montar o código!") : "Continuar a caçada 📡" });
    setView("card");
  }, [persist, syncGame, burst, openMontar, completeLock, renderHub]);

  const revealCuriosidade = useCallback((card: Card) => {
    const g = gameRef.current; if (g && !g.seen.includes(card.code)) { g.seen.push(card.code); persist(); syncGame(); }
    vibrate(30);
    const body = card.body || "";
    let media: React.ReactNode;
    if (card.media === "texto") media = <div className="curio-text">{body}</div>;
    else if (card.media === "imagem") media = <img className="curio-img" src={body} alt={card.title || "imagem"} />;
    else if (card.media === "youtube") {
      const id = ytId(body);
      media = id
        ? <div className="curio-yt"><iframe src={"https://www.youtube.com/embed/" + id} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
        : <div className="curio-text">Não consegui carregar o vídeo. Confira o link no painel.</div>;
    }
    else if (card.media === "spotify") {
      const e = spotifyEmbed(body);
      media = e
        ? <iframe className="curio-spotify" src={e} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        : <div className="curio-text">Não consegui carregar a música. Confira o link do Spotify no painel.</div>;
    }
    else if (card.media === "audio") media = <audio className="curio-audio" controls src={body} />;
    else media = <div className="curio-text">{body}</div>;
    const node = (
      <div className="curio">
        {card.title ? <h2 className="curio-title">{card.title}</h2> : null}
        {media}
      </div>
    );
    afterCardRef.current = renderHub;
    setCardView({ kind: "curio", node, kicker: "Curiosidade junina", cta: "Continuar a caçada 📡" });
    setView("card");
  }, [persist, syncGame, renderHub]);

  const revealCoringa = useCallback(async (card: Card) => {
    const g = gameRef.current!;
    const lvl = g.level || "medio";
    if (!g.seen.includes(card.code)) g.seen.push(card.code);
    vibrate([30, 40, 30]);
    let titulo = "🃏 Coringa!"; let msg = ""; let effect = g.coringa || "";
    const prev = g.coringa || ""; // pra não repetir o efeito anterior
    const randPos = (not: number) => { let p; do { p = 1 + Math.floor(Math.random() * 3); } while (p === not); return p; };
    if (lvl === "facil") {
      const missing = [1, 2, 3].filter(p => g.locks[1]?.[p] == null);
      if (missing.length === 0) { msg = "Você já tem os 3 números — boa caçada! 🎁"; effect = "facil"; }
      else {
        let digit: number | null = null, pos = missing[0];
        try { const { data } = await sb!.from("cards").select("position,digit").eq("game_id", EVENT).eq("kind", "senha"); const row = (data || []).find((r: any) => missing.includes(r.position)); if (row) { pos = row.position; digit = row.digit; } } catch {}
        if (digit != null) { if (!g.locks[1]) g.locks[1] = {}; g.locks[1][pos] = digit; titulo = "🃏 Coringa da sorte!"; msg = `Ganhou um número de graça: o ${digit}! 🍀`; }
        else msg = "O coringa piscou… mas não achou número novo 😅";
        effect = "facil";
      }
    } else if (lvl === "medio") {
      effect = prev === "peek" ? "hide:" + randPos(0) : prev.startsWith("hide:") ? "peek" : (Math.random() < 0.5 ? "peek" : "hide:" + randPos(0));
      msg = effect === "peek" ? "🍀 Sorte! Na hora de montar você pode dar uma PISCADA na senha… bem rapidinho 😅" : "🙈 Pegadinha! Uma das pistas vai sumir na hora de montar.";
    } else if (lvl === "dificil") {
      effect = "blur:" + randPos(prev.startsWith("blur:") ? Number(prev.slice(5)) : 0);
      titulo = "🃏 Coringa travesso!"; msg = "😜 Um dos números vai aparecer embaçado na hora de montar. Decifra!";
    } else {
      effect = prev === "easy" ? "hard" : prev === "hard" ? "easy" : (Math.random() < 0.5 ? "easy" : "hard");
      msg = effect === "easy" ? "🍀 ALÍVIO! As fichas falsas somem na hora de montar." : "😬 Azar! Vai entrar mais uma ficha falsa pra te confundir.";
    }
    g.coringa = effect; persist(); syncGame();
    const node = (<div className="curio"><h2 className="curio-title">{titulo}</h2><p className="curio-text" style={{ textAlign: "center" }}>{msg}</p></div>);
    afterCardRef.current = renderHub;
    setCardView({ kind: "curio", node, kicker: "Você achou o coringa 🃏", cta: "Continuar a caçada 📡" });
    setView("card");
  }, [sb, persist, syncGame, renderHub]);

  const processCode = useCallback(async (code: string) => {
    if (!gameRef.current) { setSplashMsg("Comece a caçada primeiro 😉"); setView("splash"); return; }
    await stopScan();
    showToast("Lendo cartão…");
    const card = await fetchCard(code);
    if (!card) { flashErr("Cartão não encontrado. Veja a conexão e tente de novo."); setView("game"); return; }
    logEvent("scan", { actor: gameRef.current?.name, code: card.code, detail: card.kind === "senha" ? `senha · casa ${card.position} = ${card.digit}` : card.kind === "coringa" ? "coringa" : `curiosidade · ${card.title || card.media || ""}` });
    if (card.kind === "senha") revealSenha(card);
    else if (card.kind === "coringa") revealCoringa(card);
    else revealCuriosidade(card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCard, flashErr, showToast, revealSenha, revealCuriosidade, revealCoringa, logEvent]);

  /* ===================== scanner (apenas NFC) ===================== */
  const defaultMethod = (): Method => flags.NFC_OK ? "nfc" : (flags.isIOS ? "nfctap" : "none");

  const onScanText = useCallback((text: string) => {
    if (!scanActiveRef.current) return;
    const code = extractCode(text);
    if (!code) { flashErr("Esse cartão não é da caçada 🤔"); return; }
    processCode(code);
  }, [flashErr, processCode]);

  const startNFC = useCallback(async () => {
    try {
      const reader = new (window as any).NDEFReader();
      const ac = new AbortController(); nfcAbortRef.current = ac;
      await reader.scan({ signal: ac.signal });
      reader.onreadingerror = () => flashErr("Não consegui ler esse cartão. Tente de novo.");
      reader.onreading = (ev: any) => {
        for (const rec of ev.message.records) {
          let text: string | null = null;
          try { text = rec.recordType === "text" ? new TextDecoder(rec.encoding || "utf-8").decode(rec.data) : new TextDecoder().decode(rec.data); } catch {}
          if (text) { onScanText(text); return; }
        }
      };
    } catch (err: any) {
      const n = err?.name || "";
      if (n === "NotSupportedError" || n === "TypeError") setScanErr("Este celular não tem NFC disponível no navegador.");
      else if (n === "NotAllowedError") setScanErr("Precisa permitir o NFC. Toque de novo e aceite — e confira se o NFC está LIGADO (barra de cima → ícone NFC).");
      else setScanErr("Ligue o NFC do celular: puxe a barra de cima e toque no ícone NFC. Depois tente de novo.");
    }
  }, [flashErr, onScanText]);

  const startMethod = useCallback(async (m: Method) => {
    setScanErr("");
    if (m === "nfc") { setScanHint("Aproxime a parte de trás do celular do cartão. Mantenha o NFC ligado."); await startNFC(); }
    else if (m === "nfctap") { setScanHint("Encoste o topo do iPhone no cartão — o jogo abre sozinho. Não precisa apertar nada."); }
    else { setScanHint("Este aparelho não lê NFC. Use o QR do cartão pela câmera do próprio celular — ele abre o jogo sozinho."); }
  }, [startNFC]);

  const stopScan = useCallback(async () => {
    scanActiveRef.current = false;
    if (nfcAbortRef.current) { try { nfcAbortRef.current.abort(); } catch {} nfcAbortRef.current = null; }
  }, []);

  const openScanner = useCallback(() => {
    scanActiveRef.current = true; tryFullscreen();
    const m = defaultMethod(); setScanErr(""); setView("scan");
    setTimeout(() => startMethod(m), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryFullscreen, startMethod]);

  const cancelScan = useCallback(async () => { await stopScan(); setView("game"); }, [stopScan]);

  /* ===================== ranking view ===================== */
  const openRanking = useCallback(() => {
    unsubAll();
    setRank1(localRows(1));
    loadLockBoard(1, setRank1);
    if (sb) {
      const gid = lockGameId(1);
      const ch = sb.channel("rk_" + gid).on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: "game_id=eq." + gid },
        () => loadLockBoard(1, setRank1)).subscribe();
      channelsRef.current.push(ch);
    }
    setView("ranking");
  }, [sb, unsubAll, loadLockBoard]);

  /* ===================== easter egg: assoprar a fogueira ===================== */
  const stopBlow = useCallback(() => { try { blowRef.current?.stop(); } catch {} blowRef.current = null; setBlowOn(false); }, []);

  const bonfireTap = useCallback(async () => {
    vibrate(8);
    if (fogueiraOut) { setFogueiraOut(false); return; } // toca de novo → reacende
    if (blowRef.current) { stopBlow(); return; }
    const md: any = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { burst(); showToast("Esse aparelho não deixa eu ouvir o sopro 🙈"); return; }
    let stream: MediaStream;
    try { stream = await md.getUserMedia({ audio: true }); }
    catch { showToast("Pra apagar a fogueira, é só permitir o microfone e assoprar 🌬️"); return; }
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC(); const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      let raf = 0, hits = 0; const started = Date.now();
      setBlowOn(true); showToast("🌬️ Assopre na fogueira!");
      const stop = () => { cancelAnimationFrame(raf); try { stream.getTracks().forEach(t => t.stop()); ctx.close(); } catch {} };
      blowRef.current = { stop };
      const tick = () => {
        an.getByteFrequencyData(data);
        let low = 0; for (let i = 1; i < 22; i++) low += data[i]; low /= 21;
        if (low > 95) { if (++hits >= 3) { stopBlow(); setFogueiraOut(true); markEgg("sopro"); vibrate([60, 40, 60]); showToast("🌬️ Você apagou a fogueira! 😮💨"); setTimeout(() => setFogueiraOut(false), 5000); return; } }
        else hits = 0;
        if (Date.now() - started > 9000) { stopBlow(); showToast("A fogueira resistiu… tenta de novo 🔥"); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch { try { stream.getTracks().forEach(t => t.stop()); } catch {} setBlowOn(false); }
  }, [fogueiraOut, stopBlow, burst, markEgg, showToast]);

  useEffect(() => () => { try { blowRef.current?.stop(); } catch {} }, []);

  /* ===================== admin ===================== */
  const [admEmail, setAdmEmail] = useState(""); const [admPass, setAdmPass] = useState("");
  const [admErr, setAdmErr] = useState(""); const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Partial<Card> | null>(null);
  const [formErr, setFormErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [logs, setLogs] = useState<EventRow[] | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<"tudo" | "scan" | "admin">("tudo");
  const [myRole, setMyRole] = useState<"admin" | "master">("admin");
  const [showAdmins, setShowAdmins] = useState(false);
  const [admList, setAdmList] = useState<{ email: string; role: string }[] | null>(null);
  const [newAdmEmail, setNewAdmEmail] = useState(""); const [newAdmPass, setNewAdmPass] = useState("");
  const [admMgmtMsg, setAdmMgmtMsg] = useState("");
  const [comboInput, setComboInput] = useState("");

  const fetchRole = useCallback(async (email: string) => {
    if (!sb || !email) { setMyRole("admin"); return; }
    try { const { data } = await sb.from("admins").select("role").eq("email", email.toLowerCase()).maybeSingle(); setMyRole(((data?.role as any) === "master") ? "master" : "admin"); }
    catch { setMyRole("admin"); }
  }, [sb]);

  const loadAdmins = useCallback(async () => {
    if (!sb) return; setAdmList(null); setAdmMgmtMsg("");
    const { data, error } = await sb.functions.invoke("admin-manage", { body: { action: "list" } });
    if (error || (data as any)?.error) {
      const raw = (data as any)?.error || error?.message || "";
      const notDeployed = /Failed to send|Edge Function|not found|404|FunctionsFetchError/i.test(raw);
      setAdmMgmtMsg(notDeployed
        ? "⚙️ Falta publicar a Edge Function pra cadastrar admins por aqui. Enquanto isso, dá pra criar logins direto no painel do Supabase (Authentication → Add user)."
        : "Não consegui listar: " + raw);
      setAdmList([]); return;
    }
    setAdmList(((data as any)?.admins || []) as any);
  }, [sb]);

  const createAdmin = useCallback(async () => {
    if (!sb) return; setAdmMgmtMsg("");
    const { data, error } = await sb.functions.invoke("admin-manage", { body: { action: "create", email: newAdmEmail.trim(), password: newAdmPass } });
    if (error || (data as any)?.error) { setAdmMgmtMsg((data as any)?.error || error?.message || "Erro ao criar."); return; }
    setNewAdmEmail(""); setNewAdmPass(""); setAdmMgmtMsg("Admin criado! ✓"); logEvent("admin", { actor: adminUser, detail: "criou um admin" }); loadAdmins();
  }, [sb, newAdmEmail, newAdmPass, loadAdmins, logEvent, adminUser]);

  const removeAdmin = useCallback(async (email: string) => {
    if (!sb) return; if (!confirm("Remover o admin " + email + "?")) return;
    const { data, error } = await sb.functions.invoke("admin-manage", { body: { action: "delete", email } });
    if (error || (data as any)?.error) { setAdmMgmtMsg((data as any)?.error || error?.message || "Erro ao remover."); return; }
    logEvent("admin", { actor: adminUser, detail: "removeu o admin " + email }); loadAdmins();
  }, [sb, loadAdmins, logEvent, adminUser]);

  const loadLogs = useCallback(async () => {
    if (!sb) return;
    setLogs(null);
    const { data } = await sb.from("events").select("*").eq("game_id", EVENT).order("at", { ascending: false }).limit(1000);
    setLogs((data || []) as EventRow[]);
  }, [sb]);

  const resetRanking = useCallback(async () => {
    if (!sb) return;
    if (!confirm("Zerar TODO o ranking? Apaga os tempos de todos os jogadores e o histórico de quem abriu o baú. Não dá pra desfazer.")) return;
    try {
      const r1 = await sb.from("scores").delete().eq("game_id", lockGameId(1));
      if (r1.error) throw r1.error;
      await sb.from("events").delete().eq("game_id", EVENT).eq("kind", "complete");
      try { localStorage.removeItem(LS_RANK); } catch {}
      logEvent("admin", { actor: adminUser, detail: "zerou o ranking" });
      setRank1([]);
      showToast("Ranking zerado! 🧹");
    } catch (e: any) { showToast("Não consegui zerar: " + (e?.message || "erro") + " (rodou a migration 0009?)"); }
  }, [sb, adminUser, logEvent, showToast]);

  const uploadFile = useCallback(async (file: File) => {
    if (!sb) { setFormErr("Supabase não configurado."); return; }
    if (file.size > 25 * 1024 * 1024) { setFormErr("Arquivo grande demais (máx. 25 MB)."); return; }
    setFormErr(""); setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      const { error } = await sb.storage.from("curiosidades").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) { setFormErr("Falha no upload: " + error.message + " (rodou a migration 0005?)"); }
      else {
        const { data } = sb.storage.from("curiosidades").getPublicUrl(path);
        setForm((f) => (f ? { ...f, body: data.publicUrl } : f));
      }
    } catch { setFormErr("Erro no upload."); }
    setUploading(false);
  }, [sb]);

  const cardUrl = (code: string) => (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "") + "?c=" + encodeURIComponent(code);

  const loadCards = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("cards").select("*").eq("game_id", EVENT).order("kind").order("lock", { nullsFirst: false }).order("position", { nullsFirst: false });
    if (error) { setCards([]); return; }
    const list = (data || []) as Card[]; setCards(list);
    // QR é determinístico pelo código — só gera o que falta (evita travar o admin a cada save)
    setQrMap(prev => {
      const codes = new Set(list.map(c => c.code));
      const kept: Record<string, string> = {};
      for (const code of Array.from(codes)) if (prev[code]) kept[code] = prev[code];
      const missing = list.filter(c => !kept[c.code]);
      if (missing.length) {
        (async () => {
          for (const c of missing) {
            try { const u = await QRCode.toDataURL(cardUrl(c.code), { width: 130, margin: 1, color: { dark: "#241544", light: "#ffffff" } }); setQrMap(m => ({ ...m, [c.code]: u })); } catch {}
          }
        })();
      }
      return kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const openAdmin = useCallback(async () => {
    setView("admin");
    if (!sb) return;
    try { const { data } = await sb.auth.getSession(); if (data?.session) { const em = data.session.user?.email || ""; setAuthed(true); setAdminUser(em); fetchRole(em); loadCards(); } else setAuthed(false); } catch { setAuthed(false); }
  }, [sb, loadCards, fetchRole]);

  const startedAdmin = useRef(false);
  useEffect(() => { if (start === "admin" && !startedAdmin.current) { startedAdmin.current = true; openAdmin(); } }, [start, openAdmin]);

  const doLogin = useCallback(async () => {
    setAdmErr(""); if (!sb) { setAdmErr("Supabase não configurado."); return; }
    if (!admEmail.trim() || !admPass) { setAdmErr("Preencha e-mail e senha."); return; }
    const { error } = await sb.auth.signInWithPassword({ email: admEmail.trim(), password: admPass });
    if (error) { setAdmErr("Não entrou: " + error.message); return; }
    setAuthed(true); setAdminUser(admEmail.trim()); fetchRole(admEmail.trim()); logEvent("admin", { actor: admEmail.trim(), detail: "entrou no painel" }); loadCards();
  }, [sb, admEmail, admPass, loadCards, logEvent, fetchRole]);

  const doLogout = useCallback(async () => { if (sb) { try { await sb.auth.signOut(); } catch {} } setAuthed(false); }, [sb]);

  const applyCombo = useCallback(async (combo: string) => {
    if (!sb || !cards) return;
    const c = (combo || "").replace(/\D/g, "");
    if (c.length !== 3) { showToast("A senha precisa ter 3 dígitos 🔢"); return; }
    const senhas = cards.filter(x => x.kind === "senha");
    if (senhas.length < 3) { showToast("Cadastre as 3 tags de senha (casas 1, 2 e 3) primeiro 🔐"); return; }
    try {
      for (const s of senhas) {
        const p = s.position; if (!p || p < 1 || p > 3) continue;
        const { error } = await sb.from("cards").update({ digit: Number(c[p - 1]), lock: 1 }).eq("code", s.code);
        if (error) throw error;
      }
      vibrate([30, 40, 30]); setComboInput(""); showToast(`🔒 Senha das tags definida: ${c}`);
      logEvent("admin", { actor: adminUser, detail: "definiu a senha do cadeado: " + c });
      loadCards();
    } catch (e: any) { showToast("Não consegui aplicar: " + (e?.message || "erro")); }
  }, [sb, cards, loadCards, showToast, logEvent, adminUser]);

  const randomizeTags = useCallback(async () => {
    if (!sb || !cards) return;
    const tags = cards.slice();
    if (tags.length < 2) { showToast("Cadastre as tags primeiro 🏷️"); return; }
    // o conteúdo (senha OU curiosidade) é remanejado entre as tags;
    // cada tag física fica no lugar (code + location não mudam)
    const orig = tags.map(c => ({ kind: c.kind, position: c.position, digit: c.digit, hint: c.hint, media: c.media, title: c.title, body: c.body }));
    const next = orig.slice();
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    if (next.every((c, i) => c === orig[i]) && next.length > 1) { const t = next[0]; next[0] = next[1]; next[1] = t; }
    try {
      // fase 1: grava o novo conteúdo; as senhas vão "estacionadas" no lock 2
      // (evita colisão no índice único de senha do lock 1 durante a troca)
      for (let i = 0; i < tags.length; i++) {
        const ct = next[i]; const isSenha = ct.kind === "senha";
        const payload = {
          kind: ct.kind,
          lock: isSenha ? 2 : null,
          position: isSenha ? ct.position : null,
          digit: isSenha ? ct.digit : null,
          hint: isSenha ? ct.hint : null,
          media: isSenha ? null : ct.media,
          title: isSenha ? null : ct.title,
          body: isSenha ? null : ct.body,
        };
        const { error } = await sb.from("cards").update(payload).eq("code", tags[i].code);
        if (error) throw error;
      }
      // fase 2: traz as senhas de volta pro lock 1 (cadeado ativo)
      for (let i = 0; i < tags.length; i++) {
        if (next[i].kind === "senha") {
          const { error } = await sb.from("cards").update({ lock: 1 }).eq("code", tags[i].code);
          if (error) throw error;
        }
      }
      vibrate([30, 40, 30]); showToast("🎲 Conteúdo embaralhado entre todas as tags!");
      logEvent("admin", { actor: adminUser, detail: `randomizou ${tags.length} tags` });
      loadCards();
    } catch (e: any) { showToast("Não consegui randomizar: " + (e?.message || "erro")); }
  }, [sb, cards, loadCards, showToast, logEvent, adminUser]);

  const saveCard = useCallback(async () => {
    if (!sb || !form) return; setFormErr("");
    const code = (form.code || "").trim();
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(code)) { setFormErr("Código inválido (4–40 letras/números)."); return; }
    const payload: any = { code, game_id: EVENT, kind: form.kind, lock: null, position: null, digit: null, hint: null, media: null, title: null, body: null, location: (form.location || "").trim() || null };
    if (form.kind === "senha") {
      const pos = Number(form.position), dig = Number(form.digit);
      if (!(pos >= 1 && pos <= 3)) { setFormErr("A casa precisa ser de 1 a 3."); return; }
      if (!(dig >= 0 && dig <= 9)) { setFormErr("Dígito precisa ser de 0 a 9."); return; }
      payload.lock = 1; payload.position = pos; payload.digit = dig; payload.hint = (form.hint || "").trim() || null;
    } else if (form.kind === "coringa") {
      // coringa não tem conteúdo: o efeito é gerado no jogo conforme o nível
    } else {
      payload.media = form.media || "texto"; payload.title = (form.title || "").trim() || null; payload.body = (form.body || "").trim();
      if (!payload.body) { setFormErr("Coloque o conteúdo (texto ou URL)."); return; }
    }
    const existed = !!(cards && cards.some(c => c.code === code));
    const { error } = await sb.from("cards").upsert(payload, { onConflict: "code" });
    if (error) { setFormErr("Erro: " + error.message + ((error as any).code === "23505" ? " (já existe um cartão nessa casa do cadeado)" : "")); return; }
    logEvent("admin", { actor: adminUser, code, detail: (existed ? "editou tag " : "criou tag ") + (form.kind === "senha" ? `(senha casa ${payload.position})` : "(curiosidade)") });
    setForm(null); loadCards();
  }, [sb, form, cards, loadCards, logEvent, adminUser]);

  const delCard = useCallback(async (code: string) => {
    if (!sb) return; if (!confirm("Apagar o cartão " + code + "?")) return;
    const { error } = await sb.from("cards").delete().eq("code", code); if (error) { alert(error.message); return; }
    logEvent("admin", { actor: adminUser, code, detail: "apagou a tag" }); loadCards();
  }, [sb, loadCards, logEvent, adminUser]);

  const writeTag = useCallback(async (url: string, btn: HTMLButtonElement) => {
    if (!flags.NFC_OK) { alert("Gravar tag NFC só funciona no Chrome do Android. Grave num Android — depois funciona no iPhone."); return; }
    const orig = btn.textContent; btn.textContent = "Aproxime a tag…";
    try {
      const w = new (window as any).NDEFReader();
      await w.write({ records: [{ recordType: "url", data: url }] });
      btn.textContent = "✔ Gravada!"; vibrate([40, 30, 120]);
      setTimeout(() => { btn.textContent = orig; }, 2500);
    } catch (e: any) {
      const n = e?.name || "";
      let msg: string;
      if (n === "NotSupportedError") msg = "Essa tag não aceita gravação web — provável Mifare Classic. Use tags NTAG213/215/216 (ou imprima o QR do cartão).";
      else if (n === "NotAllowedError") msg = "Ligue o NFC e permita o acesso, depois toque de novo.";
      else if (n === "NetworkError" || n === "AbortError") msg = "Tirou a tag cedo demais — encoste e segure até aparecer ✔ Gravada.";
      else msg = "Não gravou (" + (n || e?.message || "erro") + "). Tente NTAG213/215/216 — ou use o QR do cartão.";
      btn.textContent = "Falhou — toque de novo";
      showToast(msg);
      setTimeout(() => { btn.textContent = orig; }, 3000);
    }
  }, [flags.NFC_OK, showToast]);

  /* ===================== render ===================== */
  const g = game;
  const v = (id: ViewId) => "view" + (view === id ? " active" : "");
  const filled = g ? lockFilled(g, activeLock) : 0;
  const lockDone = g ? lockComplete(g, activeLock) : false;
  const lvl: Level = (g?.level as Level) || "medio";
  const cofreLabel = (p: number) => lvl === "facil" ? ORDINAL[p] : lvl === "medio" ? POS_CLUE[p].emoji : "•";
  const cor = g?.coringa || "";
  const hidePos = cor.startsWith("hide:") ? Number(cor.slice(5)) : 0;   // médio: pista sumida
  const blurPos = cor.startsWith("blur:") ? Number(cor.slice(5)) : 0;   // difícil: número embaçado
  const canPeek = cor === "peek";                                       // médio: espiar 2s

  const logStats = useMemo(() => {
    const list = logs || [];
    const scans = list.filter(e => e.kind === "scan");
    const players = new Set<string>();
    list.forEach(e => { if ((e.kind === "scan" || e.kind === "complete") && e.actor) players.add(e.actor); });
    const completes = list.filter(e => e.kind === "complete").length;
    const byTag: Record<string, number> = {};
    scans.forEach(e => { if (e.code) byTag[e.code] = (byTag[e.code] || 0) + 1; });
    let topTag = "—", topN = 0;
    for (const code of Object.keys(byTag)) if (byTag[code] > topN) { topN = byTag[code]; topTag = code; }
    return { players: players.size, scans: scans.length, completes, topTag, topN };
  }, [logs]);
  const logsFiltered = useMemo(() => {
    const list = logs || [];
    if (logFilter === "admin") return list.filter(e => e.kind === "admin");
    if (logFilter === "scan") return list.filter(e => e.kind === "scan" || e.kind === "complete");
    return list;
  }, [logs, logFilter]);

  const nfcNotice = flags.NFC_OK
    ? <>📡 Pra ler os cartões por aproximação, <b>ligue o NFC</b> do celular (puxe a barra de cima → ícone <b>NFC</b>).</>
    : flags.isIOS
      ? <>📡 Encoste o <b>topo do iPhone</b> no cartão pra ler.</>
      : <>📡 Encoste o <b>topo do celular</b> no cartão pra ler. Se não rolar, ligue o <b>NFC</b> nos ajustes.</>;

  return (
    <>
      <canvas id="ambient" ref={ambientRef} aria-hidden />
      <canvas id="confetti" ref={confettiRef} />
      <div className="hot-flash" ref={hotRef} aria-hidden />
      {toast ? <div className="toast show">{toast}</div> : null}
      {social ? <div className="social-alert">{social}</div> : null}
      {fakeOff ? <div className="fake-off" aria-hidden /> : null}

      <div className={"app" + (mestre ? " mestre" : "") + (view === "admin" ? " admin-wide" : "")}>
        <Bunting />

        {/* SPLASH */}
        <section id="view-splash" className={v("splash")}>
          {splashStep === 1 ? (
            <div className="splash-deco" aria-hidden>
              <span className="d1">🌵</span><span className="d2">🪗</span><span className="d3">🌻</span><span className="d4">🌽</span>
            </div>
          ) : null}
          {splashStep === 1 ? <div className="kicker">Colégio Marista de Brasília</div> : null}
          <h1 className="title">Arraiá<br />do Tesouro</h1>
          {splashStep === 1 ? (
            <>
              <p className="festa">Festa Junina <span className="ano">2026</span></p>
              <p className="lead">Ache os cartões escondidos no estande, monte a senha e abra o baú. Bora?</p>
              <div className="premio-splash">🎁 Abra o baú e leve <b>{PREMIO}</b>!</div>
              <div className={"bonfire" + (fogueiraOut ? " out" : "") + (blowOn ? " listening" : "")} aria-hidden onClick={bonfireTap}>
                <div className="halo" /><div className="flame" /><div className="flame f2" /><div className="flame f3" />
                <div className="smoke"><span /><span /><span /></div>
                <div className="logs"><span /><span /></div>
              </div>
              {blowOn ? <div className="blow-hint">🌬️ Assopre no microfone pra apagar a fogueira…</div> : null}
              {foundEggs.length ? <div className="eggs-badge">🏅 {foundEggs.length}/{EGGS_TOTAL} segredos juninos {foundEggs.length >= EGGS_TOTAL ? "· lenda do arraiá! 👑" : "descobertos"}</div> : null}
              <div className="install" style={{ display: "block" }}>{nfcNotice}</div>
            </>
          ) : null}
          {splashMsg ? <div className="install warn" style={{ display: "block" }}>{splashMsg}</div> : null}

          {splashStep === 1 ? (
            <>
              <label className="field" htmlFor="playerName">Seu nome de caipira</label>
              <input id="playerName" type="text" maxLength={22} placeholder="Ex: Zé do Milho" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") goStep2(); }} autoComplete="off" />
              <div className="spacer" />
              <button className="btn fire" id="startBtn" onClick={goStep2}>Continuar →</button>
            </>
          ) : (
            <>
              <label className="field">Escolha o nível, <b style={{ color: "var(--milho)" }}>{name.trim()}</b>:</label>
              <div className="levels">
                {LEVELS.map(l => (
                  <button key={l.id} type="button" className={"level-btn" + (level === l.id ? " sel" : "")} onClick={() => { setLevel(l.id); vibrate(8); }}>
                    <span className="lv-emoji">{l.emoji}</span>
                    <span className="lv-label">{l.label}</span>
                    <span className="lv-desc">{l.desc}</span>
                  </button>
                ))}
              </div>
              <div className="spacer" />
              <button className="btn fire" onClick={startHunt}>Iniciar caçada 🔥</button>
              <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setSplashStep(1)}>← Voltar</button>
            </>
          )}
          <div className="linkbar">
            <a onClick={openRanking}>🏆 Ranking</a>
            <a onClick={openAdmin}>⚙️ Organizador</a>
          </div>
        </section>

        {/* HUB */}
        <section id="view-game" className={v("game")}>
          <div className="hub-brand">
            <span className="hb-title">Arraiá do Tesouro</span>
            <span className="hb-sub">Festa Junina 2026</span>
          </div>
          <div className="statline"><span>🤠 {g?.name || "—"}</span><span className="timer">{fmt(elapsed)}</span></div>
          <p className="anyorder">🔀 Ache os 3 números em <b>qualquer ordem</b>{lvl === "facil" ? " — a senha vem pronta!" : " — no fim você monta o código!"}</p>
          {g ? (
            <div className={"lockpanel" + (lockDone ? " done" : "")}>
              <div className="lockhead"><span>🔓 Senha do cadeado</span>{lockDone ? <span className="ok">✓ achou os 3!</span> : <span className="cnt">{filled === 2 ? "Falta só 1! 🔥" : filled === 0 ? "Faltam 3 números" : "Faltam " + (3 - filled) + " números"}</span>}</div>
              <div className="cofre">
                {(() => {
                  const fp = [1, 2, 3].filter(p => g.locks[activeLock]?.[p] != null).sort((a, b) => (g.locks[activeLock]![a] as number) - (g.locks[activeLock]![b] as number));
                  return (<>
                    {fp.map(p => <div key={p} className="slot filled"><span className="pos">{cofreLabel(p)}</span>{g.locks[activeLock]![p]}</div>)}
                    {Array.from({ length: 3 - fp.length }).map((_, i) => <div key={"l" + i} className="slot"><span className="pos">?</span>🔒</div>)}
                  </>);
                })()}
              </div>
              {lockDone ? <button className="btn fire" style={{ marginTop: 12 }} onClick={() => (lvl === "facil" ? completeLock(activeLock) : openMontar())}>{lvl === "facil" ? "Ver a senha do cadeado 🔐" : "🧩 Montar o código!"}</button> : null}
            </div>
          ) : null}
          <button className="btn fire" style={{ marginTop: 18 }} onClick={openScanner}>Procurar próximo cartão 🔦</button>
          <p className="scanhint-sm">Pode ser um número da senha… ou uma curiosidade! 🎁</p>
          <div className="spacer" />
          <button className="btn ghost noprint" style={{ marginTop: 12 }} onClick={() => { gameRef.current = null; setGame(null); clearSession(); setName(""); setSplashMsg(""); setSplashStep(1); setView("splash"); }}>Sair da caçada</button>
        </section>

        {/* SCAN (apenas NFC) */}
        <section id="view-scan" className={v("scan")}>
          <div className="kicker">Encoste na tag NFC</div>
          <h1 className="title" style={{ fontSize: "2.2rem" }}>Procurando…</h1>
          <div className="nfcpanel"><div className="nfc-stage"><div className="ring" /><div className="ring" /><div className="ring" /><div className="nfc-phone">📱</div></div></div>
          {scanErr ? <div className="scan-err">{scanErr}</div> : null}
          <p className="scan-hint">{scanHint}</p>
          <div className="spacer" />
          <button className="btn ghost" onClick={cancelScan}>Cancelar</button>
        </section>

        {/* CARD */}
        <section id="view-card" className={v("card")}>
          <div className="kicker">{cardView?.kicker}</div>
          <div className="cardbody">{cardView?.node}</div>
          <div className="spacer" />
          <button className="btn fire" onClick={() => { const f = afterCardRef.current; afterCardRef.current = () => {}; f(); }}>{cardView?.cta}</button>
        </section>

        {/* CHEST */}
        <section id="view-chest" className={v("chest") + " celebrate"}>
          <div className="chest">🧰</div>
          <div className="big">Você montou a senha! 🎉</div>
          {(() => { const mp = chestRank.findIndex(e => e.id === myScoreId.current) + 1; return mp > 0 ? <div className="chest-pos">🏆 Você foi o <b>{mp}º</b> a abrir o baú!</div> : null; })()}
          <p className="lead" style={{ textAlign: "center" }}>Gire o cadeado para:</p>
          <div className="combo">{chest?.combo.map((d, i) => <div key={i} className="d">{d}</div>)}</div>
          <p className="lead" style={{ textAlign: "center", marginTop: 14 }}>Boa, <b>{g?.name}</b>! Mostre pro organizador, abra o baú e pegue {PREMIO}. 🎁</p>
          <ul className="rank">{chestRank.slice(0, 12).map((e, i) => <li key={e.id} className={e.id === myScoreId.current ? "me" : ""}><span className="pos">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="nm">{e.name}</span><span className="tm">{fmt(e.ms)}</span></li>)}</ul>
          <div className="spacer" />
          <button className="btn fire" onClick={() => (chestBoth ? openRanking() : setView("game"))}>{chestBoth ? "Ver ranking 🏆" : "Continuar a caçada 📡"}</button>
        </section>

        {/* MONTAR O CÓDIGO */}
        <section id="view-montar" className={v("montar")}>
          <div className="kicker">Monte o código do cadeado</div>
          <h1 className="title" style={{ fontSize: "2.1rem" }}>Que ordem é a senha? 🧩</h1>
          <p className="lead">{lvl === "medio" ? <>Cada número leva o <b>desenho da sua pista</b>. Junte no lugar certo! 🧩</> : lvl === "impossivel" ? <>💃 <b>A quadrilha embolou!</b> Continhas, fichas falsas, lógica invertida (<b>anarriê!</b>) e pegadinhas. Boa sorte… 😜</> : <>🔥 <b>Sem pistas.</b> Descubra sozinho a ordem certa!</>}</p>
          {canPeek ? <button className="btn ghost noprint" style={{ marginTop: 8 }} onClick={montarPeek}>👀 Piscar a senha (rapidinho!) 🃏</button> : null}
          <div className={"montar-slots" + (montarErr ? " err" : "") + (montarOk ? " ok" : "")}>
            {[1, 2, 3].map((p, i) => {
              const hidden = lvl === "medio" && hidePos === p;
              return (
                <div key={p} className={"mslot" + (montarSlots[i] ? " filled" : "")} onClick={() => montarRemove(i)}>
                  <span className="mclue">{lvl === "medio" ? (hidden ? "❔" : POS_CLUE[p].emoji) : ORDINAL[p]}</span>
                  <span className="mnum">{montarSlots[i] ? montarSlots[i]!.digit : "?"}</span>
                  {lvl === "medio" ? <span className="mword">{hidden ? "pista sumiu!" : POS_CLUE[p].word}</span> : null}
                </div>
              );
            })}
          </div>
          <div className="montar-pool">
            {montarPool.map(c => (
              <button key={c.id} className={"mchip" + (c.decoy ? " decoy" : "")} onClick={() => montarPlace(c)}>
                <span className={"mchip-num" + (lvl === "dificil" && blurPos === c.pos ? " blurry" : "")}>{c.label}</span>
                {lvl === "medio" && !c.decoy && hidePos !== c.pos ? <span className="mchip-clue">{POS_CLUE[c.pos].emoji}</span> : null}
              </button>
            ))}
            {montarSlots.every(s => s) ? <span className="montar-ready">Confere! 👇</span> : null}
          </div>
          <div className="spacer" />
          <button className="btn fire" disabled={montarSlots.some(s => s == null)}
            style={confXY ? { transform: `translate(${confXY.x}px,${confXY.y}px)`, transition: "transform .14s ease" } : undefined}
            onClick={() => {
              if (lvl === "impossivel" && confDodge < 2) { setConfDodge(confDodge + 1); setConfXY({ x: (Math.random() * 2 - 1) * 130, y: -(20 + Math.random() * 50) }); vibrate(15); return; }
              setConfXY(null); montarCheck();
            }}>🔓 Conferir o código</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setView("game")}>Voltar</button>
        </section>

        {/* RANKING */}
        <section id="view-ranking" className={v("ranking")}>
          <div className="kicker">Quem montou as senhas mais rápido</div>
          <h1 className="title" style={{ fontSize: "2.4rem" }}>Ranking 🏆</h1>
          {rank1.length ? (<>
            <div className="rank-count">{rank1.length} participante{rank1.length === 1 ? "" : "s"}</div>
            <ul className="rank rank-all">{rank1.map((e, i) => <li key={e.id} className={e.id === myScoreId.current ? "me" : ""}><span className="pos">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="nm">{e.name}</span><span className="tm">{fmt(e.ms)}</span></li>)}</ul>
          </>) : <p className="empty">Ninguém abriu o cadeado ainda. Seja o primeiro! 🔥</p>}
          <div className="spacer" />
          {authed && myRole === "master" ? <button className="btn danger-btn noprint" onClick={resetRanking}>🗑️ Zerar ranking</button> : null}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => { unsubAll(); setView(g ? "game" : "splash"); }}>Voltar</button>
        </section>

        {/* ADMIN */}
        <section id="view-admin" className={v("admin")}>
          <div className="kicker noprint">Painel do organizador</div>
          <h1 className="title noprint" style={{ fontSize: "2.2rem" }}>Arraiá · Admin</h1>
          {authed ? <div className="adm-whoami noprint">{myRole === "master" ? "👑 master" : "🙋 admin"} · {adminUser || "—"}</div> : null}
          {!authed ? (
            <div className="noprint">
              <p className="lead">Entre com o usuário admin pra gerenciar os cartões.</p>
              <label className="field" htmlFor="admEmail">E-mail</label>
              <input id="admEmail" type="text" value={admEmail} onChange={(e) => setAdmEmail(e.target.value)} autoComplete="username" />
              <label className="field" htmlFor="admPass">Senha</label>
              <input id="admPass" type="password" value={admPass} onChange={(e) => setAdmPass(e.target.value)} autoComplete="current-password" />
              {admErr ? <div className="scan-err">{admErr}</div> : null}
              <button className="btn" style={{ marginTop: 16 }} onClick={doLogin}>Entrar</button>
            </div>
          ) : (
            <div>
              <div className="note noprint">🔐 As <b>3 tags de senha</b> ficam fixas no lugar. Aqui você define <b>qual cadeado</b> elas revelam e pode <b>randomizar</b> qual tag mostra qual conteúdo — sem mexer nas tags.</div>

              <div className="panel noprint">
                <h3 className="panel-h">🔢 Senha das tags</h3>
                <p className="panel-sub">Escolhe o cadeado físico que vale agora (vai pras 3 tags de senha):</p>
                <div className="combo-presets">
                  <button className="btn ghost" onClick={() => applyCombo("120")}>🔒 Cadeado 1 · <b>120</b></button>
                  <button className="btn ghost" onClick={() => applyCombo("476")}>🔒 Cadeado 2 · <b>476</b></button>
                </div>
                <div className="field-row" style={{ marginTop: 10 }}>
                  <input className="fld" inputMode="numeric" maxLength={3} value={comboInput} onChange={(e) => setComboInput(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Outra senha (3 dígitos)" />
                  <button className="btn" onClick={() => applyCombo(comboInput)}>Aplicar</button>
                </div>
              </div>

              {cards && cards.length >= 2 ? (
                <button className="btn fire noprint" style={{ marginTop: 12 }} onClick={randomizeTags}>🎲 Randomizar tags</button>
              ) : null}
              <div className="admin-toolbar noprint">
                <button className="btn ghost" onClick={() => setForm({ code: randCode(), kind: "senha", lock: 1, position: 1, digit: 0, media: "texto", location: "" })}>+ Nova tag</button>
                <button className={"btn ghost" + (showLogs ? " on" : "")} onClick={() => { const ns = !showLogs; setShowLogs(ns); if (ns) loadLogs(); }}>📋 Logs</button>
                {myRole === "master" ? <button className={"btn ghost" + (showAdmins ? " on" : "")} onClick={() => { const ns = !showAdmins; setShowAdmins(ns); if (ns) loadAdmins(); }}>👑 Admins</button> : null}
              </div>

              {showAdmins && myRole === "master" ? (
                <div className="panel noprint">
                  <h3 className="panel-h">👑 Organizadores</h3>
                  <p className="panel-sub">Você é o <b>master</b>. Cadastre quem mais vai usar o painel (entram com este e-mail/senha).</p>
                  {admMgmtMsg ? <div className={admMgmtMsg.includes("✓") ? "panel-msg ok" : admMgmtMsg.startsWith("⚙️") ? "panel-msg info" : "panel-msg err"}>{admMgmtMsg}</div> : null}
                  <div className="field-row">
                    <input className="fld" type="email" value={newAdmEmail} onChange={(e) => setNewAdmEmail(e.target.value)} placeholder="E-mail do novo admin" autoComplete="off" />
                    <input className="fld" type="text" value={newAdmPass} onChange={(e) => setNewAdmPass(e.target.value)} placeholder="Senha (mín. 6)" autoComplete="off" />
                  </div>
                  <button className="btn" style={{ marginTop: 12 }} onClick={createAdmin}>➕ Cadastrar admin</button>
                  <ul className="adm-list">
                    {admList === null ? <li className="empty">Carregando…</li> :
                      admList.length === 0 ? <li className="empty">Nenhum admin cadastrado ainda.</li> :
                        admList.map(a => (
                          <li key={a.email}>
                            <span className="adm-em">{a.role === "master" ? "👑 " : "🙋 "}{a.email}</span>
                            {a.role === "master" ? <span className="adm-role">master</span> : <button className="nfc-btn danger" onClick={() => removeAdmin(a.email)}>remover</button>}
                          </li>
                        ))}
                  </ul>
                </div>
              ) : null}

              {showLogs ? (
                <div className="logs-panel noprint">
                  <div className="logs-metrics">
                    <div className="metric"><b>{logStats.players}</b><span>jogadores</span></div>
                    <div className="metric"><b>{logStats.scans}</b><span>leituras</span></div>
                    <div className="metric"><b>{logStats.completes}</b><span>concluíram</span></div>
                    <div className="metric"><b style={{ fontSize: ".82rem", wordBreak: "break-all" }}>{logStats.topTag}</b><span>tag + achada{logStats.topN ? ` (${logStats.topN})` : ""}</span></div>
                  </div>
                  <div className="logs-filter">
                    {([["tudo", "Tudo"], ["scan", "Jogadores"], ["admin", "Admin"]] as const).map(([k, lbl]) => (
                      <button key={k} className={logFilter === k ? "on" : ""} onClick={() => setLogFilter(k)}>{lbl}</button>
                    ))}
                    <button className="logs-refresh" onClick={loadLogs}>↻</button>
                  </div>
                  {logs === null ? <p className="empty">Carregando…</p> :
                    logsFiltered.length === 0 ? <p className="empty">Sem registros ainda. (Rodou a migration 0007?)</p> : (
                      <ul className="logs-list">
                        {logsFiltered.slice(0, 200).map(e => (
                          <li key={e.id} className={"log-" + e.kind}>
                            <span className="log-ico">{e.kind === "admin" ? "⚙️" : e.kind === "complete" ? "🏆" : "📡"}</span>
                            <span className="log-main"><b>{e.actor || "—"}</b> {e.detail || (e.kind === "scan" ? "leu uma tag" : "")}{e.code ? <span className="log-code"> · {e.code}</span> : null}</span>
                            <span className="log-time">{new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              ) : null}

              {form ? (
                <div className="admin-row noprint">
                  <label className="field" htmlFor="fCode">ID da tag (código gravado)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id="fCode" type="text" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex: 53bfb8a3500001 (serial do leitor) ou aleatório" />
                    <button className="nfc-btn" style={{ flex: "none" }} onClick={() => setForm({ ...form, code: randCode() })}>🎲</button>
                  </div>
                  <label className="field" htmlFor="fLoc">📍 Localização física</label>
                  <input id="fLoc" type="text" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: atrás da barraca da pescaria" />
                  <label className="field" htmlFor="fKind">Tipo</label>
                  <select id="fKind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
                    <option value="senha">🔐 Senha (1 número do cadeado)</option>
                    <option value="curiosidade">📜 Curiosidade</option>
                    <option value="coringa">🃏 Coringa (efeito variável por nível)</option>
                  </select>
                  {form.kind === "senha" ? (
                    <>
                      <label className="field" htmlFor="fPos">Casa na senha (1 a 3)</label>
                      <input id="fPos" type="number" min={1} max={3} value={String(form.position ?? 1)} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
                      <label className="field" htmlFor="fDigit">Dígito (0 a 9)</label>
                      <input id="fDigit" type="number" min={0} max={9} value={String(form.digit ?? 0)} onChange={(e) => setForm({ ...form, digit: Number(e.target.value) })} />
                      <label className="field" htmlFor="fHint">Dica (opcional)</label>
                      <input id="fHint" type="text" value={form.hint || ""} onChange={(e) => setForm({ ...form, hint: e.target.value })} placeholder="Ex: o número da sorte do caipira" />
                    </>
                  ) : form.kind === "curiosidade" ? (
                    <>
                      <label className="field" htmlFor="fMedia">Tipo de conteúdo</label>
                      <select id="fMedia" value={form.media || "texto"} onChange={(e) => setForm({ ...form, media: e.target.value as Media })}>
                        <option value="texto">📝 Texto</option>
                        <option value="imagem">🖼️ Imagem (URL ou upload)</option>
                        <option value="youtube">▶️ Vídeo do YouTube (link)</option>
                        <option value="spotify">🎵 Música do Spotify (link)</option>
                        <option value="audio">🔊 Áudio (URL ou upload)</option>
                      </select>
                      <label className="field" htmlFor="fTitle">Título</label>
                      <input id="fTitle" type="text" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Por que tem fogueira?" />
                      {form.media === "texto" ? (
                        <>
                          <label className="field" htmlFor="fBody">Texto da curiosidade</label>
                          <textarea id="fBody" value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Escreva o textinho aqui" />
                        </>
                      ) : (
                        <>
                          <label className="field" htmlFor="fBody">
                            {form.media === "youtube" ? "Link do YouTube" : form.media === "spotify" ? "Link do Spotify" : "URL do arquivo"}
                          </label>
                          <input id="fBody" type="text" value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })}
                            placeholder={form.media === "youtube" ? "https://youtu.be/..." : form.media === "spotify" ? "https://open.spotify.com/..." : "cole a URL ou use o upload abaixo"} />
                          {(form.media === "imagem" || form.media === "audio") ? (
                            <div className="uploadbox">
                              <label className="nfc-btn" style={{ display: "inline-block", cursor: "pointer" }}>
                                {uploading ? "Enviando…" : "📤 Enviar arquivo"}
                                <input type="file" accept={form.media === "imagem" ? "image/*" : "audio/*"} style={{ display: "none" }}
                                  disabled={uploading}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }} />
                              </label>
                              {form.body ? <span className="upload-ok">✔ pronto</span> : null}
                            </div>
                          ) : null}
                          {form.media === "imagem" && form.body ? <img className="upload-prev" src={form.body} alt="prévia" /> : null}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="install" style={{ display: "block", marginTop: 14 }}>🃏 <b>Tag coringa.</b> O efeito muda conforme o nível de quem achar (dá uma força ou apronta!). É só dar o ID, a localização e espalhar — sem mais nada pra preencher.</div>
                  )}
                  {formErr ? <div className="scan-err">{formErr}</div> : null}
                  <button className="btn" style={{ marginTop: 16 }} onClick={saveCard}>Salvar cartão</button>
                  <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setForm(null)}>Cancelar</button>
                </div>
              ) : null}

              <div id="cardList">
                {cards === null ? <p className="empty">Carregando…</p> :
                  cards.length === 0 ? <p className="empty">Nenhum cartão ainda. Crie o primeiro! ☝️</p> :
                    cards.map((c) => (
                      <div key={c.code} className="admin-row">
                        <div className="rh">{c.code}</div>
                        {c.location ? <div style={{ color: "#9fc3e8", marginTop: 4, fontSize: ".85rem", fontWeight: 700 }}>📍 {c.location}</div> : null}
                        <div style={{ color: "#e9def7", marginTop: 6 }}>
                          {c.kind === "senha" ? <>🔐 casa <b>{c.position}</b> = <b>{c.digit}</b>{c.hint ? ` · dica: ${c.hint}` : ""}</> : c.kind === "coringa" ? <>🃏 <b>Coringa</b> · efeito variável</> : <>{mediaIcon(c.media)} {c.title || "Curiosidade"}</>}
                        </div>
                        {qrMap[c.code] ? <div className="qbox-mini"><img src={qrMap[c.code]} alt={c.code} /></div> : null}
                        <div className="card-actions noprint">
                          <button className="nfc-btn" onClick={(e) => writeTag(cardUrl(c.code), e.currentTarget)}>📡 Gravar NFC</button>
                          <button className="nfc-btn" onClick={() => setForm({ ...c })}>✏️ Editar</button>
                          <button className="nfc-btn danger" onClick={() => delCard(c.code)}>🗑️ Apagar</button>
                        </div>
                      </div>
                    ))}
              </div>

              <div className="noprint">
                <div className="note">Crie os cartões, grave cada um numa <b>tag NFC</b> (Android) e/ou imprima o <b>QR</b>. A mesma tag funciona no iPhone (abre sozinho) e no Android.</div>
                {cards && cards.length ? <button className="btn fire" style={{ marginTop: 14 }} onClick={() => window.print()}>Imprimir os QR Codes 🖨️</button> : null}
                {myRole === "master" ? <button className="btn danger-btn" style={{ marginTop: 12 }} onClick={resetRanking}>🗑️ Zerar ranking</button> : null}
                <button className="btn ghost" style={{ marginTop: 12 }} onClick={doLogout}>Sair do admin</button>
              </div>
            </div>
          )}
          <div className="spacer" />
          <button className="btn ghost noprint" style={{ marginTop: 12 }} onClick={() => setView("splash")}>Voltar</button>
        </section>
      </div>
    </>
  );
}
