"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import Bunting from "@/components/Bunting";
import { getSupabase, EVENT } from "@/lib/supabase";
import type { Card, GameState, Media, ScoreRow } from "@/lib/types";

/* ===================== helpers puros ===================== */
type ViewId = "splash" | "game" | "scan" | "card" | "chest" | "ranking" | "admin";
type Method = "nfc" | "nfctap" | "none";

const LS_SESS = "arraia.session.v2";
const LS_RANK = "arraia.ranking.v1";
const LS_CARDS = "arraia.cardcache.v1";
const LS_MESTRE = "arraia.mestre";

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
export default function Game() {
  const [view, setView] = useState<ViewId>("splash");
  const [game, setGame] = useState<GameState | null>(null);
  const [activeLock, setActiveLock] = useState<number>(1);
  const [elapsed, setElapsed] = useState(0);
  const [name, setName] = useState("");
  const [splashMsg, setSplashMsg] = useState("");
  const [toast, setToast] = useState("");
  const [mestre, setMestre] = useState(false);
  const [eggOpen, setEggOpen] = useState(false);
  const [festaHoje, setFestaHoje] = useState(false);

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

  // ranking
  const [rank1, setRank1] = useState<ScoreRow[]>([]);
  const [rank2, setRank2] = useState<ScoreRow[]>([]);

  // refs (latest values em callbacks async)
  const gameRef = useRef<GameState | null>(null);
  const activeLockRef = useRef(1);
  const scanActiveRef = useRef(false);
  const myScoreId = useRef<string | null>(null);
  const ambientRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const hotRef = useRef<HTMLDivElement | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const channelsRef = useRef<any[]>([]);
  const burstRef = useRef<() => void>(() => {});
  const rainRef = useRef<() => void>(() => {});
  const lastErrRef = useRef(0);
  const toastT = useRef<any>(null);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { activeLockRef.current = activeLock; }, [activeLock]);

  const sb = useMemo(() => getSupabase(), []);

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
  const bothDone = (g: GameState) => lockComplete(g, 1) && lockComplete(g, 2);

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

  /* ---------- período ativo (game_state) ---------- */
  useEffect(() => {
    if (!sb) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await sb.from("game_state").select("active_lock").eq("game_id", EVENT).maybeSingle();
        if (alive && data && (data as any).active_lock) setActiveLock((data as any).active_lock);
      } catch {}
    })();
    const ch = sb.channel("gs_" + EVENT)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_state", filter: "game_id=eq." + EVENT },
        (payload: any) => { const al = payload?.new?.active_lock; if (al) setActiveLock(al); })
      .subscribe();
    return () => { alive = false; try { sb.removeChannel(ch); } catch {} };
  }, [sb]);

  /* ---------- timer ---------- */
  useEffect(() => {
    if (!game) return;
    const id = setInterval(() => { if (gameRef.current && !bothDone(gameRef.current)) setElapsed(Date.now() - gameRef.current.startedAt); }, 500);
    return () => clearInterval(id);
  }, [game]);

  /* ---------- launch (?c=) ---------- */
  useEffect(() => {
    try { if (localStorage.getItem(LS_MESTRE) === "1") setMestre(true); } catch {}
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

  /* ---------- easter eggs: data da festa + chacoalhar ---------- */
  useEffect(() => {
    const d = new Date();
    if (d.getMonth() === 5 && (d.getDate() === 27 || d.getDate() === 24)) {
      setFestaHoje(true);
      setTimeout(() => burstRef.current(), 700);
    }
    let last = 0, lx = 0, ly = 0, lz = 0, primed = false;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const x = a.x || 0, y = a.y || 0, z = a.z || 0;
      const delta = Math.abs(x - lx) + Math.abs(y - ly) + Math.abs(z - lz);
      lx = x; ly = y; lz = z;
      if (!primed) { primed = true; return; }
      if (delta > 45) {
        const now = Date.now(); if (now - last < 4000) return; last = now;
        vibrate([20, 30, 20]); rainRef.current(); showToast("☔ Olha a chuva… é mentira! 😄");
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [showToast]);

  /* ---------- confete ---------- */
  useEffect(() => {
    const cvs = confettiRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d")!; let parts: any[] = []; let rafOn = false;
    const COLORS = ["#e23b2e", "#f9c21a", "#e84c97", "#28a8e0", "#6e5ba6", "#ffffff"];
    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      parts.forEach(p => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life++;
        if (p.kind === "rain") {
          ctx.strokeStyle = p.c; ctx.lineWidth = p.s; ctx.lineCap = "round"; ctx.globalAlpha = p.a;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .6, p.y - p.vy * 1.1); ctx.stroke(); ctx.globalAlpha = 1;
        } else {
          p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
        }
      });
      parts = parts.filter(p => p.y < cvs.height + 40 && p.life < 260);
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

  const startHunt = useCallback(() => {
    const nm = name.trim();
    if (!nm) return;
    goFullscreen();
    // easter egg: nome mágico
    const magic = nm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["marista", "sao joao", "festa junina", "ze do milho"].includes(magic)) {
      setMestre(true); try { localStorage.setItem(LS_MESTRE, "1"); } catch {}
      vibrate([30, 40, 30, 40, 140]); burst(); setTimeout(burst, 250);
      showToast("✨ Nome mágico! Modo Mestre liberado 🔥👑");
    }
    const g: GameState = { name: nm, startedAt: Date.now(), gameId: EVENT, locks: { 1: {}, 2: {} }, seen: [], doneLocks: [], active: true };
    gameRef.current = g; setGame(g); persist(); vibrate([40, 40, 120]);
    setView("game");
  }, [name, goFullscreen, persist, burst, showToast]);

  const completeLock = useCallback((L: number) => {
    const g = gameRef.current!; const combo: (number | string)[] = [];
    for (let p = 1; p <= 3; p++) combo.push(g.locks[L]?.[p] ?? "?");
    setChest({ lock: L, combo });
    const gid = lockGameId(L);
    if (!g.doneLocks.includes(L)) {
      g.doneLocks.push(L); persist(); syncGame();
      const ms = Date.now() - g.startedAt;
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
    setView("chest");
  }, [persist, syncGame, burst, sbInsert, sbTop, sb, unsubAll]);

  const revealSenha = useCallback((card: Card) => {
    const g = gameRef.current!; const L = card.lock || 1, pos = card.position!, digit = card.digit!;
    if (!g.locks[L]) g.locks[L] = {};
    const already = g.locks[L][pos] != null;
    g.locks[L][pos] = digit;
    if (!g.seen.includes(card.code)) g.seen.push(card.code);
    persist(); syncGame();
    vibrate([40, 30, 40, 30, 160]); burst(); setTimeout(burst, 300);
    const complete = lockComplete(g, L) && !g.doneLocks.includes(L);
    const node = (
      <div className="senha-reveal">
        <div className="senha-digit">{digit}</div>
        <div className="senha-where">entra na <b>casa {pos}</b> do <b>Cadeado {L}</b></div>
        {card.hint ? <p className="senha-hint">💬 {card.hint}</p> : null}
      </div>
    );
    afterCardRef.current = complete ? () => completeLock(L) : renderHub;
    setCardView({ kind: "senha", node, kicker: already ? "Você já tinha esse número 😉" : "Achou um número da senha!", cta: complete ? `Ver a senha do Cadeado ${L} 🔐` : "Continuar a caçada 📡" });
    setView("card");
  }, [persist, syncGame, burst, completeLock, renderHub]);

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

  const processCode = useCallback(async (code: string) => {
    if (!gameRef.current) { setSplashMsg("Comece a caçada primeiro 😉"); setView("splash"); return; }
    await stopScan();
    showToast("Lendo cartão…");
    const card = await fetchCard(code);
    if (!card) { flashErr("Cartão não encontrado. Veja a conexão e tente de novo."); setView("game"); return; }
    if (card.kind === "senha") {
      const L = card.lock || 1;
      if (L !== activeLockRef.current) {
        showToast(`Esse cartão é do Cadeado ${L}. Agora vale o Cadeado ${activeLockRef.current} ⏳`);
        setView("game"); return;
      }
      revealSenha(card);
    } else revealCuriosidade(card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCard, flashErr, showToast, revealSenha, revealCuriosidade]);

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
    setRank1(localRows(1)); setRank2(localRows(2));
    loadLockBoard(1, setRank1); loadLockBoard(2, setRank2);
    if (sb) {
      [1, 2].forEach(L => {
        const gid = lockGameId(L);
        const ch = sb.channel("rk_" + gid).on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: "game_id=eq." + gid },
          () => loadLockBoard(L, L === 1 ? setRank1 : setRank2)).subscribe();
        channelsRef.current.push(ch);
      });
    }
    setView("ranking");
  }, [sb, unsubAll, loadLockBoard]);

  /* ===================== easter egg ===================== */
  const eggTaps = useRef(0); const eggLast = useRef(0);
  const bonfireTap = useCallback(() => {
    vibrate(8);
    if (mestre) { burst(); return; }
    const now = Date.now(); if (now - eggLast.current > 1200) eggTaps.current = 0; eggLast.current = now;
    if (++eggTaps.current >= 5) { eggTaps.current = 0; setMestre(true); try { localStorage.setItem(LS_MESTRE, "1"); } catch {} vibrate([30, 40, 30, 40, 140]); burst(); setTimeout(burst, 260); setTimeout(burst, 520); setEggOpen(true); }
  }, [mestre, burst]);

  /* ===================== admin ===================== */
  const [admEmail, setAdmEmail] = useState(""); const [admPass, setAdmPass] = useState("");
  const [admErr, setAdmErr] = useState(""); const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Partial<Card> | null>(null);
  const [formErr, setFormErr] = useState("");
  const [uploading, setUploading] = useState(false);

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
    const map: Record<string, string> = {};
    for (const c of list) { try { map[c.code] = await QRCode.toDataURL(cardUrl(c.code), { width: 130, margin: 1, color: { dark: "#241544", light: "#ffffff" } }); } catch {} }
    setQrMap(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const openAdmin = useCallback(async () => {
    setView("admin");
    if (!sb) return;
    try { const { data } = await sb.auth.getSession(); if (data?.session) { setAuthed(true); loadCards(); } else setAuthed(false); } catch { setAuthed(false); }
  }, [sb, loadCards]);

  const doLogin = useCallback(async () => {
    setAdmErr(""); if (!sb) { setAdmErr("Supabase não configurado."); return; }
    if (!admEmail.trim() || !admPass) { setAdmErr("Preencha e-mail e senha."); return; }
    const { error } = await sb.auth.signInWithPassword({ email: admEmail.trim(), password: admPass });
    if (error) { setAdmErr("Não entrou: " + error.message); return; }
    setAuthed(true); loadCards();
  }, [sb, admEmail, admPass, loadCards]);

  const doLogout = useCallback(async () => { if (sb) { try { await sb.auth.signOut(); } catch {} } setAuthed(false); }, [sb]);

  const setActivePeriod = useCallback(async (L: number) => {
    if (!sb) return;
    setActiveLock(L);
    try { await sb.from("game_state").upsert({ game_id: EVENT, active_lock: L, updated_at: new Date().toISOString() }, { onConflict: "game_id" }); } catch {}
  }, [sb]);

  const saveCard = useCallback(async () => {
    if (!sb || !form) return; setFormErr("");
    const code = (form.code || "").trim();
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(code)) { setFormErr("Código inválido (4–40 letras/números)."); return; }
    const payload: any = { code, game_id: EVENT, kind: form.kind, lock: null, position: null, digit: null, hint: null, media: null, title: null, body: null };
    if (form.kind === "senha") {
      const lock = Number(form.lock), pos = Number(form.position), dig = Number(form.digit);
      if (lock !== 1 && lock !== 2) { setFormErr("Escolha o cadeado (1 ou 2)."); return; }
      if (!(pos >= 1 && pos <= 3)) { setFormErr("A casa precisa ser de 1 a 3."); return; }
      if (!(dig >= 0 && dig <= 9)) { setFormErr("Dígito precisa ser de 0 a 9."); return; }
      payload.lock = lock; payload.position = pos; payload.digit = dig; payload.hint = (form.hint || "").trim() || null;
    } else {
      payload.media = form.media || "texto"; payload.title = (form.title || "").trim() || null; payload.body = (form.body || "").trim();
      if (!payload.body) { setFormErr("Coloque o conteúdo (texto ou URL)."); return; }
    }
    const { error } = await sb.from("cards").upsert(payload, { onConflict: "code" });
    if (error) { setFormErr("Erro: " + error.message + ((error as any).code === "23505" ? " (já existe um cartão nessa casa do cadeado)" : "")); return; }
    setForm(null); loadCards();
  }, [sb, form, loadCards]);

  const delCard = useCallback(async (code: string) => {
    if (!sb) return; if (!confirm("Apagar o cartão " + code + "?")) return;
    const { error } = await sb.from("cards").delete().eq("code", code); if (error) { alert(error.message); return; } loadCards();
  }, [sb, loadCards]);

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

  const nfcNotice = flags.NFC_OK
    ? <>📡 Pra ler os cartões por aproximação, <b>ligue o NFC</b> do celular (puxe a barra de cima → ícone <b>NFC</b>). Sem NFC? Use a câmera no QR.</>
    : flags.isIOS
      ? <>📡 Encoste o <b>topo do iPhone</b> no cartão pra ler. Não rolou? Use a câmera no QR.</>
      : <>📷 Este aparelho não tem NFC. No celular, aponte a <b>câmera</b> no <b>QR do cartão</b> — ele abre o jogo sozinho.</>;

  return (
    <>
      <canvas id="ambient" ref={ambientRef} aria-hidden />
      <canvas id="confetti" ref={confettiRef} />
      <div className="hot-flash" ref={hotRef} aria-hidden />
      {toast ? <div className="toast show">{toast}</div> : null}

      {eggOpen ? (
        <div className="secret-egg" onClick={(e) => { if (e.target === e.currentTarget) setEggOpen(false); }}>
          <div className="card">
            <div className="crown">🔥👑</div>
            <h2>Mestre do Arraiá</h2>
            <p>Você descobriu o segredo da fogueira! O <b>Modo Mestre</b> foi liberado — agora a fogueira solta fogos a cada toque. 🎆</p>
            <button className="btn fire" onClick={() => { setEggOpen(false); burst(); }}>Uhul! 🎉</button>
          </div>
        </div>
      ) : null}

      <div className={"app" + (mestre ? " mestre" : "")}>
        <Bunting />

        {/* SPLASH */}
        <section id="view-splash" className={v("splash")}>
          <div className="splash-deco" aria-hidden>
            <span className="d1">🌵</span><span className="d2">🪗</span><span className="d3">🌻</span><span className="d4">🌽</span>
          </div>
          <div className="kicker">Colégio Marista de Brasília</div>
          <h1 className="title">Arraiá<br />do Tesouro</h1>
          <p className="festa">Festa Junina <span className="ano">2026</span></p>
          <p className="lead">Ache os cartões escondidos pela festa. Alguns abrem um <b>cadeado</b> com premiação; o resto são curiosidades. Bora?</p>
          <div className="bonfire" aria-hidden onClick={bonfireTap}>
            <div className="halo" /><div className="flame" /><div className="flame f2" /><div className="flame f3" />
            <div className="logs"><span /><span /></div>
          </div>
          {festaHoje ? <div className="festa-hoje">🎉 É hoje! Festa Junina do Marista. Boa caçada!</div> : null}
          <div className="install" style={{ display: "block" }}>{nfcNotice}</div>
          {splashMsg ? <div className="install warn" style={{ display: "block" }}>{splashMsg}</div> : null}
          <label className="field" htmlFor="playerName">Seu nome de caipira</label>
          <input id="playerName" type="text" maxLength={22} placeholder="Ex: Zé do Milho" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          {!flags.isStandalone && flags.isIOS ? (
            <div className="install" style={{ display: "block" }}>📲 No iPhone, encoste na tag NFC que o jogo abre sozinho. Pra tela cheia: <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</div>
          ) : null}
          {!flags.isStandalone && flags.isAndroid ? (
            <div className="install" style={{ display: "block" }}>📲 Pra <b>tela cheia garantida</b>, instale o app: menu <b>⋮</b> do navegador → <b>Instalar app</b>.</div>
          ) : null}
          <div className="spacer" />
          <button className="btn fire" id="startBtn" onClick={startHunt}>Iniciar caçada 🔥</button>
          <div className="linkbar">
            <a onClick={openRanking}>🏆 Ranking</a>
            <a onClick={openAdmin}>⚙️ Organizador</a>
          </div>
        </section>

        {/* HUB */}
        <section id="view-game" className={v("game")}>
          <div className="statline"><span>🤠 {g?.name || "—"}</span><span className="timer">{fmt(elapsed)}</span></div>
          <p className="anyorder">🔀 Ache os cartões em <b>qualquer ordem</b> — cada número já vai pro lugar certo.</p>
          {g ? (
            <div className={"lockpanel" + (lockDone ? " done" : "")}>
              <div className="lockhead"><span>🔓 Senha de agora <span className="lock-tag">Cadeado {activeLock}</span></span>{lockDone ? <span className="ok">✓ pronta!</span> : <span className="cnt">{filled === 0 ? "Faltam 3 números" : "Falta" + (3 - filled === 1 ? "" : "m") + " " + (3 - filled) + " número" + (3 - filled === 1 ? "" : "s")}</span>}</div>
              <div className="cofre">
                {[1, 2, 3].map(pos => {
                  const val = g.locks[activeLock]?.[pos];
                  return <div key={pos} className={"slot" + (val != null ? " filled" : "")}><span className="pos">{pos}ª</span>{val != null ? val : "🔒"}</div>;
                })}
              </div>
              {lockDone ? <button className="btn fire" style={{ marginTop: 12 }} onClick={() => completeLock(activeLock)}>Ver a senha do Cadeado {activeLock} 🔐</button> : null}
            </div>
          ) : null}
          <div className="spacer" />
          <button className="btn fire" onClick={openScanner}>Procurar próximo cartão 🔦</button>
          <p className="scanhint-sm">Pode ser um número da senha… ou uma curiosidade! 🎁</p>
          <button className="btn ghost noprint" style={{ marginTop: 12 }} onClick={() => { gameRef.current = null; setGame(null); clearSession(); setName(""); setSplashMsg(""); setView("splash"); }}>Sair da caçada</button>
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
          <div className="big">Senha do Cadeado {chest?.lock}!</div>
          <p className="lead" style={{ textAlign: "center" }}>Gire o cadeado para:</p>
          <div className="combo">{chest?.combo.map((d, i) => <div key={i} className="d">{d}</div>)}</div>
          <p className="lead" style={{ textAlign: "center", marginTop: 14 }}>Boa, <b>{g?.name}</b>! Mostre a senha pro organizador e abra o baú deste cadeado. 🎁</p>
          <ul className="rank">{chestRank.slice(0, 12).map((e, i) => <li key={e.id} className={e.id === myScoreId.current ? "me" : ""}><span className="pos">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="nm">{e.name}</span><span className="tm">{fmt(e.ms)}</span></li>)}</ul>
          <div className="spacer" />
          <button className="btn fire" onClick={() => (chestBoth ? openRanking() : setView("game"))}>{chestBoth ? "Ver ranking 🏆" : "Continuar a caçada 📡"}</button>
        </section>

        {/* RANKING */}
        <section id="view-ranking" className={v("ranking")}>
          <div className="kicker">Quem montou as senhas mais rápido</div>
          <h1 className="title" style={{ fontSize: "2.4rem" }}>Ranking 🏆</h1>
          {[{ L: 1, rows: rank1 }, { L: 2, rows: rank2 }].map(({ L, rows }) => (
            <div key={L}>
              <h3 className="ranklock">🔒 Cadeado {L}</h3>
              {rows.length ? (
                <ul className="rank">{rows.slice(0, 12).map((e, i) => <li key={e.id} className={e.id === myScoreId.current ? "me" : ""}><span className="pos">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="nm">{e.name}</span><span className="tm">{fmt(e.ms)}</span></li>)}</ul>
              ) : <p className="empty">Ninguém abriu o Cadeado {L} ainda.</p>}
            </div>
          ))}
          <div className="spacer" />
          <button className="btn" onClick={() => { unsubAll(); setView(g ? "game" : "splash"); }}>Voltar</button>
        </section>

        {/* ADMIN */}
        <section id="view-admin" className={v("admin")}>
          <div className="kicker noprint">Painel do organizador</div>
          <h1 className="title noprint" style={{ fontSize: "2.2rem" }}>Cartões</h1>
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
              <div className="note noprint">Período ativo agora: <b>Cadeado {activeLock}</b>. Só esse cadeado vale pros jogadores.</div>
              <div className="activebar noprint">
                <button className={activeLock === 1 ? "sel" : ""} onClick={() => setActivePeriod(1)}>🔒 Ativar Cadeado 1</button>
                <button className={activeLock === 2 ? "sel" : ""} onClick={() => setActivePeriod(2)}>🔒 Ativar Cadeado 2</button>
              </div>
              <button className="btn noprint" style={{ marginTop: 14 }} onClick={() => setForm({ code: randCode(), kind: "senha", lock: 1, position: 1, digit: 0, media: "texto" })}>+ Novo cartão</button>

              {form ? (
                <div className="admin-row noprint">
                  <label className="field" htmlFor="fCode">Código do cartão</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id="fCode" type="text" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    <button className="nfc-btn" style={{ flex: "none" }} onClick={() => setForm({ ...form, code: randCode() })}>🎲</button>
                  </div>
                  <label className="field" htmlFor="fKind">Tipo</label>
                  <select id="fKind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
                    <option value="senha">🔐 Senha (1 número do cadeado)</option>
                    <option value="curiosidade">📜 Curiosidade</option>
                  </select>
                  {form.kind === "senha" ? (
                    <>
                      <label className="field" htmlFor="fLock">Cadeado (1 ou 2)</label>
                      <select id="fLock" value={String(form.lock ?? 1)} onChange={(e) => setForm({ ...form, lock: Number(e.target.value) })}>
                        <option value="1">🔒 Cadeado 1</option><option value="2">🔒 Cadeado 2</option>
                      </select>
                      <label className="field" htmlFor="fPos">Casa na senha (1 a 3)</label>
                      <input id="fPos" type="number" min={1} max={3} value={String(form.position ?? 1)} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
                      <label className="field" htmlFor="fDigit">Dígito (0 a 9)</label>
                      <input id="fDigit" type="number" min={0} max={9} value={String(form.digit ?? 0)} onChange={(e) => setForm({ ...form, digit: Number(e.target.value) })} />
                      <label className="field" htmlFor="fHint">Dica (opcional)</label>
                      <input id="fHint" type="text" value={form.hint || ""} onChange={(e) => setForm({ ...form, hint: e.target.value })} placeholder="Ex: o número da sorte do caipira" />
                    </>
                  ) : (
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
                        <div style={{ color: "#e9def7", marginTop: 6 }}>
                          {c.kind === "senha" ? <>🔐 Cadeado <b>{c.lock}</b> · casa <b>{c.position}</b> = <b>{c.digit}</b>{c.hint ? ` · dica: ${c.hint}` : ""}</> : <>{mediaIcon(c.media)} {c.title || "Curiosidade"}</>}
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
