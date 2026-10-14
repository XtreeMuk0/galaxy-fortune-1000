import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, History, Info, Zap, Code2 } from "lucide-react";
import bg from "@/assets/bg-galaxias.jpg";
import logo from "@/assets/sym-logo.png.asset.json";
import character from "@/assets/character.png";
import { SlotSymbol } from "@/components/slot/SlotSymbol";
import { GambleWheel } from "@/components/slot/GambleWheel";
import { ALL_SYMBOLS, SYMBOL_NAME } from "@/components/slot/symbols";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  BET_LEVELS, PAYTABLE, SCATTER_PAY, FREE_SPINS, REELS, ROWS, BUY_COST, ORB_TABLE, MAX_WIN_X,
  type Grid, type RoundResult, type BonusState, type SpinStep, type SymbolId, type BuyType, type Volatility, RTP_OPTIONS, VOLATILITIES,
} from "@/lib/slot/engine";

const DEMO_BALANCE = 100000;
const VOL_LABEL: Record<Volatility, string> = { medium: "Media", high: "Alta", extreme: "Extrema" };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Galaxy Fortune 1000 · Slot 7x5" },
      { name: "description", content: "Galaxy Fortune 1000: 7x5, 50 líneas, wilds galácticos y giros gratis x2." },
      { property: "og:title", content: "Galaxy Fortune 1000 · Slot 7x5" },
      { property: "og:description", content: "50 líneas, wilds galácticos y giros gratis x2." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

const randGrid = (): Grid =>
  Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]!));
type GambleUI = { pending: BonusState; chance: number | null; token: string; rotation: number; rolling: boolean; result: "win" | "lose" | null };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Launch = Record<"operator" | "player" | "currency" | "session" | "wallet" | "ts" | "sig", string>;

function useLaunch(): Launch | null {
  const [l, setL] = useState<Launch | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") !== "real") return;
    const keys = ["operator", "player", "currency", "session", "wallet", "ts", "sig"] as const;
    if (keys.every((k) => q.get(k))) setL(Object.fromEntries(keys.map((k) => [k, q.get(k)!])) as Launch);
  }, []);
  return l;
}

function Game() {
  const launch = useLaunch();
  const real = !!launch;
  const currency = launch?.currency ?? "FUN";
  const [balance, setBalance] = useState(DEMO_BALANCE);
  const [rtp, setRtp] = useState(96);
  const [vol, setVol] = useState<Volatility>("high");
  const [notice, setNotice] = useState<string | null>(null);
  const [betIdx, setBetIdx] = useState(2);
  const [grid, setGrid] = useState<Grid>(() => Array.from({ length: REELS }, (_, r) => Array.from({ length: ROWS }, (_, i) => ALL_SYMBOLS[(r * 3 + i + 2) % ALL_SYMBOLS.length]!)));
  useEffect(() => { setGrid(randGrid()); }, []);
  const [spinning, setSpinning] = useState<boolean[]>(Array(REELS).fill(false));
  const [winPos, setWinPos] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [mini, setMini] = useState<Set<string>>(new Set());
  const [gambleUI, setGambleUI] = useState<GambleUI | null>(null);
  const choiceRef = useRef<((c: "gamble" | "play") => void) | null>(null);
  const [charReact, setCharReact] = useState(0);
  const charRef = useRef<HTMLImageElement>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [bolt, setBolt] = useState<{ x1: number; y1: number; x2: number; y2: number; k: number } | null>(null);
  const fireBolt = (reel: number) => {
    const c = charRef.current?.getBoundingClientRect(); const r = reelRefs.current[reel]?.getBoundingClientRect();
    if (!c || !r || c.width === 0) return false;
    setBolt({ x1: c.left + c.width * 0.507, y1: c.top + c.height * 0.15, x2: r.left + r.width / 2, y2: r.top + r.height / 2, k: Date.now() });
    return true;
  };
  const [landed, setLanded] = useState<Set<string>>(new Set());
  const [lastWin, setLastWin] = useState(0);
  const [fs, setFs] = useState<{ left: number; total: number; win: number } | null>(null);
  const [orbs, setOrbs] = useState<Map<string, number>>(new Map());
  const [multi, setMulti] = useState<number | null>(null);
  const [stickies, setStickies] = useState<Map<number, number>>(new Map());
  const stickyRef = useRef(stickies);
  stickyRef.current = stickies;
  const [battle, setBattle] = useState<{ low: number; high: number; winner: number | null } | null>(null);
  const [confirmBuy, setConfirmBuy] = useState<BuyType | null>(null);
  const [banner, setBanner] = useState<{ title: string; amount?: number } | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const bet = BET_LEVELS[betIdx]!;
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const [turbo, setTurbo] = useState(false);
  const turboRef = useRef(turbo);
  turboRef.current = turbo;
  const [autoCount, setAutoCount] = useState(25);

  useEffect(() => {
    if (!launch) return;
    fetch("/api/public/v1/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ launch }) })
      .then((r) => r.json()).then((j) => typeof j.balance === "number" ? setBalance(j.balance) : setError("No se pudo leer el saldo"))
      .catch(() => setError("No se pudo conectar con el casino"));
  }, [launch]);

  const animateStep = useCallback(async (step: SpinStep) => {
    const t = turboRef.current;
    setWinPos(new Set()); setOrbs(new Map()); setMulti(null);
    const held = stickyRef.current;
    setSpinning(Array.from({ length: REELS }, (_, i) => !held.has(i)));
    await sleep(t ? 250 : 900);
    for (let r = 0; r < REELS; r++) {
      if (held.has(r)) continue;
      await sleep(r === REELS - 1 && step.scatterCount >= 2 ? (t ? 700 : 1400) : (t ? 120 : 400));
      setGrid((g) => g.map((col, i) => (i === r ? step.grid[r]! : col)));
      setSpinning((s) => s.map((v, i) => (i === r ? false : v)));
    }
    // Pausa para ver el resultado final (incluido el último rodillo)
    await sleep(t ? 450 : 700);
    // Wilds nuevos: se expanden al rodillo y libran la batalla de multiplicadores
    for (const w of step.stickyWilds ?? []) {
      if (!w.isNew) continue;
      const [low, high] = w.battle;
      setBattle({ low, high, winner: null }); await sleep(t ? 900 : 1600);
      setBattle({ low, high, winner: w.value }); await sleep(t ? 700 : 1200);
      setBattle(null);
      setCharReact((n) => n + 1);
      if (fireBolt(w.reel)) await sleep(t ? 350 : 600);
      setStickies((m) => new Map(m).set(w.reel, w.value));
      setTimeout(() => setBolt(null), 500);
    }
    const pos = new Set<string>();
    step.lineWins.forEach((l) => l.positions.forEach(([a, b]) => pos.add(`${a}-${b}`)));
    if (step.scatterWin > 0 || step.freeSpinsAwarded) step.grid.forEach((col, a) => col.forEach((s, b) => s === "SCATTER" && pos.add(`${a}-${b}`)));
    setOrbs(new Map(step.orbs.map((o) => [`${o.reel}-${o.row}`, o.value])));
    if (step.orbs.length && step.win > 0) {
      step.orbs.forEach((o) => pos.add(`${o.reel}-${o.row}`));
      setWinPos(pos); await sleep(t ? 400 : 700); setMulti(step.multiplier); await sleep(t ? 900 : 1500);
    } else setWinPos(pos);
    if (step.win > 0) await sleep(t ? 800 : 1300);
    // Cascada (Super Bonus): se eliminan los premiados y solo los huecos hacen un mini giro
    let prev = step;
    for (const tb of step.tumbles ?? []) {
      const removed = new Set<string>();
      prev.lineWins.forEach((l) => l.positions.forEach(([a, b]) => { const s = prev.grid[a]![b]; if (!held.has(a) && s !== "ORB" && s !== "WILD") removed.add(`${a}-${b}`); }));
      setWinPos(new Set()); setMulti(null);
      setGone(removed); await sleep(t ? 300 : 600);
      const holes = removed;
      setGone(new Set()); setMini(holes);
      setGrid(tb.grid); setOrbs(new Map(tb.orbs.map((o) => [`${o.reel}-${o.row}`, o.value])));
      await sleep(t ? 450 : 900);
      setMini(new Set()); setLanded(holes);
      await sleep(t ? 300 : 500);
      const p = new Set<string>();
      tb.lineWins.forEach((l) => l.positions.forEach(([a, b]) => p.add(`${a}-${b}`)));
      if (tb.win > 0) { tb.orbs.forEach((o) => p.add(`${o.reel}-${o.row}`)); setWinPos(p); if (tb.orbs.length) setMulti(tb.multiplier); await sleep(t ? 800 : 1300); }
      setLanded(new Set());
      prev = tb;
    }
  }, []);

  const spin = useCallback(async (buy: BuyType | null = null) => {
    if (busy) return;
    const cost = +(bet * (buy ? BUY_COST[buy] : 1)).toFixed(2);
    setBusy(true); setError(null); setBanner(null); setStickies(new Map());
    if (!real) {
      // Demo: recarga automática al quedarse sin saldo
      if (balance < cost) { setNotice(`Saldo recargado: ${fmt(DEMO_BALANCE)}`); setTimeout(() => setNotice(null), 2500); setBalance(+(DEMO_BALANCE - cost).toFixed(2)); }
      else setBalance((b) => +(b - cost).toFixed(2));
    }
    try {
      const res = await fetch("/api/public/v1/spin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: real ? "real" : "demo", bet, buy, launch: launch ?? undefined, config: { rtp, volatility: vol } }),
      });
      let json = await res.json();
      if (!res.ok) throw new Error(json.error === "insufficient_funds" ? "Saldo insuficiente" : "Error de conexión con el servidor");
      let round: RoundResult;
      if (json.pending) {
        const pend: BonusState = json.pending;
        await animateStep(pend.base);
        if (pend.base.win > 0) setLastWin(pend.base.win);
        if (real && typeof json.balance === "number") setBalance(json.balance);
        // Ruleta: el jugador decide apostar para subir de scatters o jugar el bono
        let g: GambleUI = { pending: pend, chance: json.chance, token: json.token, rotation: 0, rolling: false, result: null };
        setGambleUI(g);
        for (;;) {
          const choice = g.chance === null ? "play" : await new Promise<"gamble" | "play">((r) => { choiceRef.current = r; });
          choiceRef.current = null;
          if (choice === "play") break;
          const gr = await fetch("/api/public/v1/bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "gamble", token: g.token, launch: launch ?? undefined }) });
          const gj = await gr.json();
          if (!gr.ok) throw new Error("Error de conexión con el servidor");
          const chance = g.chance!;
          const deg = gj.won ? (0.1 + Math.random() * 0.8) * chance * 360 : chance * 360 + (0.1 + Math.random() * 0.8) * (1 - chance) * 360;
          const rotation = g.rotation + 360 * 5 + (360 - ((g.rotation % 360) + deg) % 360);
          g = { ...g, rolling: true, rotation, result: null }; setGambleUI(g);
          await sleep(3400);
          g = { pending: gj.pending, chance: gj.chance, token: gj.token, rotation, rolling: false, result: gj.won ? "win" : "lose" }; setGambleUI(g);
          await sleep(gj.won ? 1400 : 2000);
        }
        setGambleUI(null);
        const pr = await fetch("/api/public/v1/bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "play", token: g.token, launch: launch ?? undefined }) });
        json = await pr.json();
        if (!pr.ok) throw new Error("Error de conexión con el servidor");
        round = json.round;
        // Tirada de presentación con los scatters conseguidos
        if (round.reveal) {
          await animateStep({ grid: round.reveal, lineWins: [], scatterCount: round.bonusLevel, scatterWin: 0, win: 0, multiplier: 1, freeSpinsAwarded: round.bonusSpins ?? 0, orbs: [] });
          await sleep(600);
        }
      } else {
        round = json.round;
        await animateStep(round.base);
        if (round.base.win > 0) setLastWin(round.base.win);
      }
      if (round.freeSpins.length) {
        setBanner({ title: round.superBonus ? `SUPER BONUS · ${round.bonusSpins} GIROS` : `${round.bonusSpins} GIROS GRATIS` });
        await sleep(1800); setBanner(null);
        let acc = round.base.win;
        for (let i = 0; i < round.freeSpins.length; i++) {
          setFs({ left: round.freeSpins.length - i - 1, total: round.freeSpins.length, win: acc });
          await animateStep(round.freeSpins[i]!);
          acc += round.freeSpins[i]!.win; if (acc > 0) setLastWin(+acc.toFixed(2));
          setFs({ left: round.freeSpins.length - i - 1, total: round.freeSpins.length, win: acc });
        }
        setFs(null); setMulti(null); await sleep(600); setStickies(new Map());
      }
      if (round.totalWin >= bet * 15) { setBanner({ title: round.capped ? "MAX WIN" : round.totalWin >= bet * 500 ? "GALACTIC WIN" : round.totalWin >= bet * 50 ? "MEGA WIN" : "BIG WIN", amount: round.totalWin }); setTimeout(() => setBanner(null), 2600); }
      if (real) { if (typeof json.balance === "number") setBalance(json.balance); }
      else setBalance((b) => +(b + round.totalWin).toFixed(2));
      setHistory((h) => [round, ...h].slice(0, 100));
    } catch (e) {
      setGambleUI(null);
      if (!real) setBalance((b) => +(b + cost).toFixed(2));
      setError((e as Error).message); setAuto(0);
      setSpinning(Array(REELS).fill(false));
    } finally { setBusy(false); }
  }, [busy, real, balance, bet, launch, animateStep, rtp, vol]);

  useEffect(() => {
    if (auto > 0 && !busy) {
      const t = setTimeout(() => { if (autoRef.current > 0) { setAuto((a) => a - 1); spin(); } }, 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auto, busy, spin]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); spin(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [spin]);

  const fmt = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-2 py-6">
      <img src={bg} alt="" width={1920} height={1088} className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-background/30" />
      {/* Personaje del estudio: flota en el fondo y reacciona a cada wild pegajoso */}
      <div className="pointer-events-none absolute bottom-0 left-[-6rem] -z-10 hidden w-[34rem] opacity-90 lg:block xl:left-0">
        <div className="animate-char-float">
          <div className="animate-char-breathe origin-bottom">
            <img ref={charRef} key={charReact} src={character} alt="" className={cn("w-full drop-shadow-[0_0_40px_var(--color-primary)]", charReact > 0 && "animate-char-react")} />
          </div>
        </div>
      </div>
      {bolt && (() => {
        const n = 9; const pts = Array.from({ length: n + 1 }, (_, i) => {
          const f = i / n; const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 60;
          return `${bolt.x1 + (bolt.x2 - bolt.x1) * f + j},${bolt.y1 + (bolt.y2 - bolt.y1) * f + j}`;
        }).join(" ");
        return (
          <svg key={bolt.k} className="pointer-events-none fixed inset-0 z-40 h-full w-full animate-bolt">
            <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="14" strokeLinejoin="round" opacity="0.5" style={{ filter: "blur(6px)" }} />
            <polyline points={pts} fill="none" stroke="var(--color-foreground)" strokeWidth="4" strokeLinejoin="round" />
            <circle cx={bolt.x1} cy={bolt.y1} r="22" fill="var(--color-primary)" opacity="0.8" className="animate-ping" />
            <circle cx={bolt.x2} cy={bolt.y2} r="40" fill="var(--color-accent)" opacity="0.6" className="animate-ping" />
          </svg>
        );
      })()}

      <header className="relative mb-4 text-center">
        <h1 className="font-display text-gold text-4xl font-black tracking-widest drop-shadow-2xl sm:text-6xl">GALAXY FORTUNE</h1>
        <p className="font-display text-gold text-3xl font-black tracking-[0.3em] sm:text-5xl">1000</p>
        {!real && <span className="absolute -top-2 right-0 rotate-6 rounded-md bg-accent px-2 py-0.5 font-display text-xs font-black tracking-widest text-accent-foreground shadow-gold">DEMO</span>}
      </header>

      <section className="w-full max-w-4xl">
        <div className="bg-frame rounded-3xl p-1 shadow-cyan">
          <div className="bg-reel relative rounded-[1.35rem] p-2 sm:p-4">
            {fs && (
              <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-5 py-1 font-display text-sm font-bold text-accent-foreground shadow-gold">
                GIROS GRATIS · Quedan {fs.left} · Total {fmt(fs.win)}
              </div>
            )}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {grid.map((col, r) => (
                <div key={r} ref={(el) => { reelRefs.current[r] = el; }} className="relative h-[18rem] overflow-hidden rounded-xl border border-border bg-background/40 sm:h-[32rem]">
                  {stickies.has(r) && !spinning[r] ? (
                    <div className="animate-land relative flex h-full flex-col items-center justify-center bg-accent/20 shadow-gold">
                      <SlotSymbol id="WILD" className="h-2/3" win={[...winPos].some((k) => k.startsWith(`${r}-`))} />
                      <span className="font-display text-gold mt-1 text-2xl font-black drop-shadow-[0_2px_6px_black] sm:text-4xl">x{stickies.get(r)}</span>
                      <span className="font-display absolute top-1 text-[0.6rem] font-bold tracking-widest text-accent sm:text-xs">STICKY</span>
                    </div>
                  ) : spinning[r] ? (
                    <div className="animate-reel-spin flex flex-col">
                      {[...ALL_SYMBOLS, ...ALL_SYMBOLS].map((s, i) => (
                        <div key={i} className="h-[3.6rem] sm:h-[6.4rem]"><SlotSymbol id={s} /></div>
                      ))}
                    </div>
                  ) : (
                    <div className="animate-land grid h-full grid-rows-5">
                      {col.map((s, row) => {
                        const k = `${r}-${row}`;
                        if (gone.has(k)) return <div key={row} className="animate-vanish"><SlotSymbol id={s} /></div>;
                        if (mini.has(k)) return (
                          <div key={row} className="overflow-hidden rounded-lg bg-primary/15 shadow-[inset_0_0_12px_var(--color-primary)]"><div className="animate-reel-spin flex flex-col blur-[1px]">
                            {[...ALL_SYMBOLS, ...ALL_SYMBOLS].map((x, i) => <div key={i} className="h-[3.6rem] sm:h-[6.4rem]"><SlotSymbol id={x} /></div>)}
                          </div></div>
                        );
                        return <SlotSymbol key={`${row}-${s}`} id={s} value={orbs.get(k)} win={winPos.has(k)} className={cn(winPos.size && !winPos.has(k) && "opacity-40", landed.has(k) && "animate-drop-in")} />;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {gambleUI && (() => {
              const p = gambleUI.pending; const next = p.level + 1; const nextSuper = p.isSuper || next >= 5;
              return (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-[1.35rem] bg-background/85 p-4 text-center backdrop-blur-sm">
                  <p className="font-display text-gold text-2xl font-black sm:text-4xl">{p.isSuper ? "SUPER BONUS" : "BONO"} · {p.level} SCATTERS · {p.spins} GIROS</p>
                  {gambleUI.result && <p className={cn("animate-big-win font-display text-3xl font-black sm:text-5xl", gambleUI.result === "win" ? "text-accent" : "text-destructive")}>{gambleUI.result === "win" ? "¡SUBES!" : "¡PIERDES! MITAD DE GIROS"}</p>}
                  {gambleUI.chance !== null && (
                    <>
                      <GambleWheel chance={gambleUI.chance} rotation={gambleUI.rotation} />
                      <p className="text-sm text-muted-foreground">Ganar ({Math.round(gambleUI.chance * 100)} %): {next} scatters · {FREE_SPINS[next]} giros{nextSuper && !p.isSuper ? " · SUPER BONUS" : ""}. Perder: te quedas con {Math.max(1, Math.floor(p.spins / 2))} giros.</p>
                      <div className="flex gap-3">
                        <button disabled={gambleUI.rolling} onClick={() => choiceRef.current?.("gamble")} className="font-display rounded-full bg-accent px-6 py-3 font-black text-accent-foreground shadow-gold disabled:opacity-50">APOSTAR (GRATIS)</button>
                        <button disabled={gambleUI.rolling} onClick={() => choiceRef.current?.("play")} className="font-display rounded-full bg-primary px-6 py-3 font-black text-primary-foreground disabled:opacity-50">JUGAR BONO</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            {battle && (
              <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[1.35rem] bg-background/75">
                <p className="font-display mb-3 text-sm font-bold tracking-[0.3em] text-accent sm:text-lg">BATALLA WILD</p>
                <div className="flex items-center gap-4 sm:gap-8">
                  {[battle.low, battle.high].map((v, i) => (
                    <span key={i} className={`font-display text-gold rounded-2xl border-2 px-4 py-2 text-4xl font-black transition-all duration-500 sm:text-6xl ${battle.winner === null ? "animate-win border-primary" : battle.winner === v ? "scale-125 border-accent shadow-gold" : "scale-75 border-border opacity-30"}`}>x{v}</span>
                  )).flatMap((el, i) => i === 1 ? [<span key="vs" className="font-display text-xl font-black text-primary sm:text-3xl">VS</span>, el] : [el])}
                </div>
              </div>
            )}
            {multi !== null && multi > 1 && !banner && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
                <p className="animate-big-win font-display text-gold rounded-2xl bg-background/70 px-6 py-2 text-5xl font-black sm:text-7xl">x{multi}</p>
              </div>
            )}
            {banner && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[1.35rem] bg-background/70">
                <p className="animate-big-win font-display text-gold text-5xl font-black sm:text-7xl">{banner.title}</p>
                {banner.amount !== undefined && <p className="animate-big-win mt-3 font-display text-3xl text-primary">{fmt(banner.amount)}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-border bg-card p-3 backdrop-blur sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex gap-6">
            <Stat label="SALDO" value={fmt(balance)} />
            <Stat label="ÚLTIMA GANANCIA" value={fmt(lastWin)} highlight={lastWin > 0} />
          </div>

          <div className="order-last col-span-2 flex items-center justify-center gap-3 sm:order-none sm:col-span-1">
            <RoundBtn onClick={() => setBetIdx((i) => Math.max(0, i - 1))} disabled={busy} label="Bajar apuesta"><Minus /></RoundBtn>
            <button
              onClick={() => (auto ? setAuto(0) : spin())}
              disabled={busy && !auto}
              className="bg-gold font-display h-24 w-24 rounded-full text-xl font-black text-primary-foreground shadow-gold transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {auto ? `STOP ${auto}` : busy ? "···" : "GIRAR"}
            </button>
            <RoundBtn onClick={() => setBetIdx((i) => Math.min(BET_LEVELS.length - 1, i + 1))} disabled={busy} label="Subir apuesta"><Plus /></RoundBtn>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Stat label="APUESTA" value={fmt(bet)} />
            <RoundBtn onClick={() => setTurbo((v) => !v)} label={turbo ? "Turbo activado" : "Modo normal"} active={turbo}><Zap /></RoundBtn>
            <RoundBtn onClick={() => setShowPay(true)} label="Tabla de pagos"><Info /></RoundBtn>
            <RoundBtn onClick={() => setShowHist(true)} label="Historial"><History /></RoundBtn>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 backdrop-blur">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button onClick={() => setTurbo(false)} className={`px-3 py-1.5 font-display text-xs font-bold ${!turbo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>NORMAL</button>
            <button onClick={() => setTurbo(true)} className={`px-3 py-1.5 font-display text-xs font-bold ${turbo ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>TURBO</button>
          </div>
          <span className="ml-2 text-xs text-muted-foreground">Auto:</span>
          {[10, 25, 50, 100, 500, 1000].map((n) => (
            <button key={n} disabled={busy && !auto} onClick={() => { if (auto) { setAuto(0); return; } setAutoCount(n); setAuto(n); }}
              className={`rounded-lg border border-border px-2.5 py-1.5 font-display text-xs font-bold disabled:opacity-40 ${auto > 0 && autoCount === n ? "bg-accent text-accent-foreground" : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"}`}>{n}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmBuy("bonus")} disabled={busy || auto > 0}
            className="rounded-2xl border border-secondary bg-card p-3 text-left backdrop-blur transition-transform hover:scale-[1.02] disabled:opacity-40">
            <p className="font-display text-sm font-bold text-secondary">COMPRAR BONUS</p>
            <p className="text-xs text-muted-foreground">Giros gratis con orbes hasta x1000</p>
            <p className="font-display mt-1 text-lg font-black text-foreground">{fmt(bet * BUY_COST.bonus)}</p>
          </button>
          <button onClick={() => setConfirmBuy("super")} disabled={busy || auto > 0}
            className="rounded-2xl border border-primary bg-card p-3 text-left shadow-gold backdrop-blur transition-transform hover:scale-[1.02] disabled:opacity-40">
            <p className="font-display text-gold text-sm font-bold">SUPER BONUS</p>
            <p className="text-xs text-muted-foreground">2 orbes x1000 escondidos en las tiradas (no siempre tocan)</p>
            <p className="font-display mt-1 text-lg font-black text-foreground">{fmt(bet * BUY_COST.super)}</p>
          </button>
        </div>
        <div className={`mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-3 backdrop-blur ${real ? "hidden" : ""}`}>
          <label className="text-xs text-muted-foreground">RTP
            <select value={rtp} onChange={(e) => setRtp(Number(e.target.value))} disabled={busy || auto > 0}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-display text-sm text-foreground">
              {RTP_OPTIONS.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Volatilidad
            <select value={vol} onChange={(e) => setVol(e.target.value as Volatility)} disabled={busy || auto > 0}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-display text-sm text-foreground">
              {VOLATILITIES.map((v) => <option key={v} value={v}>{VOL_LABEL[v]}</option>)}
            </select>
          </label>
        </div>
        {notice && <p className="mt-2 text-center text-sm font-semibold text-secondary">{notice}</p>}
        {error && <p className="mt-2 text-center text-sm font-semibold text-destructive">{error}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pulsa espacio para girar · <Link to="/integracion" className="inline-flex items-center gap-1 text-secondary underline"><Code2 className="h-3 w-3" />Integración para casinos</Link>
        </p>
      </section>

      <Dialog open={confirmBuy !== null} onOpenChange={(o) => !o && setConfirmBuy(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle className="font-display text-gold text-2xl">{confirmBuy === "super" ? "Super Bonus" : "Comprar Bonus"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmBuy === "super"
              ? "10 giros gratis con orbes multiplicadores y 2 orbes x1000 ocultos en tiradas al azar. Pueden no aparecer, y solo pagan si esa tirada tiene premio."
              : "10 giros gratis garantizados con orbes multiplicadores de hasta x1000."}
          </p>
          <p className="font-display text-3xl font-black text-foreground">{confirmBuy && fmt(bet * BUY_COST[confirmBuy])}</p>
          <button onClick={() => { const b = confirmBuy; setConfirmBuy(null); spin(b); }}
            className="bg-gold font-display rounded-full py-3 text-lg font-black text-primary-foreground shadow-gold">CONFIRMAR</button>
        </DialogContent>
      </Dialog>
      <Paytable open={showPay} onOpenChange={setShowPay} bet={bet} fmt={fmt} />
      <HistorySheet open={showHist} onOpenChange={setShowHist} history={history} fmt={fmt} />
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="font-display text-[10px] tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-sm font-bold sm:text-base ${highlight ? "text-gold" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function RoundBtn({ children, onClick, disabled, label, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; active?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5 ${active ? "bg-accent text-accent-foreground" : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"}`}>
      {children}
    </button>
  );
}

function Paytable({ open, onOpenChange, bet, fmt }: { open: boolean; onOpenChange: (o: boolean) => void; bet: number; fmt: (n: number) => string }) {
  const lineBet = bet / 20;
  const rows = useMemo(() => Object.entries(PAYTABLE) as [SymbolId, number[]][], []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-gold text-2xl">Tabla de pagos</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">50 líneas fijas, pagan de izquierda a derecha. La Galaxia sustituye a todos menos al Agujero negro. Valores para la apuesta actual.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(([s, p]) => (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-border bg-muted p-2">
              <div className="h-14 w-14 shrink-0"><SlotSymbol id={s} /></div>
              <div className="text-xs">
                {[7, 6, 5, 4, 3].map((n) => <p key={n}><span className="text-muted-foreground">{n}×</span> {fmt(p[n - 3]! * lineBet)}</p>)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-muted p-3">
          <div className="h-16 w-16 shrink-0"><SlotSymbol id="SCATTER" /></div>
          <div className="text-sm">
            <p className="font-bold">{SYMBOL_NAME.SCATTER} — paga en cualquier posición</p>
            {[7, 6, 5, 4, 3].map((n) => <p key={n}>{n}× → {fmt(SCATTER_PAY[n]! * bet)} + {FREE_SPINS[n]} giros gratis {n >= 5 ? "(SUPER BONUS)" : "(bono normal)"}</p>)}
            <p className="text-accent font-bold">3 o 4 scatters = bono normal · 5 o más scatters = SUPER BONUS (cascadas y 2 orbes x1000 aleatorios)</p>
            <p className="text-muted-foreground">Los giros gratis se pueden reactivar.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-secondary bg-muted p-3">
          <div className="h-16 w-16 shrink-0"><SlotSymbol id="ORB" value={1000} /></div>
          <div className="text-sm">
            <p className="font-bold">Orbe multiplicador — solo en giros gratis</p>
            <p>Valores: {ORB_TABLE.map(([v]) => `x${v}`).join(", ")}. Si hay varios orbes se suman y multiplican todo el premio de la tirada.</p>
            <p className="text-muted-foreground">Compra Bonus: {BUY_COST.bonus}× apuesta · Super Bonus: {BUY_COST.super}× apuesta. Premio máximo {MAX_WIN_X.toLocaleString("es-ES")}× apuesta. RTP teórico ≈ 96%.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistorySheet({ open, onOpenChange, history, fmt }: { open: boolean; onOpenChange: (o: boolean) => void; history: RoundResult[]; fmt: (n: number) => string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display text-gold">Historial de jugadas</SheetTitle></SheetHeader>
        {history.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Aún no hay jugadas en esta sesión.</p>}
        <ul className="mt-4 space-y-2">
          {history.map((h) => (
            <li key={h.roundId} className="rounded-xl border border-border bg-muted p-3 text-xs">
              <div className="flex justify-between">
                <span>{new Date(h.timestamp).toLocaleTimeString("es-ES")}</span>
                <span className={h.totalWin > 0 ? "font-bold text-primary" : "text-muted-foreground"}>{h.totalWin > 0 ? `+${fmt(h.totalWin)}` : "Sin premio"}</span>
              </div>
              <p className="text-muted-foreground">{h.buy ? `${h.buy === "super" ? "Super Bonus" : "Compra Bonus"} ${fmt(h.cost)}` : `Apuesta ${fmt(h.bet)}`} · {h.base.lineWins.length} líneas{h.freeSpins.length ? ` · ${h.freeSpins.length} giros gratis` : ""}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">ID {h.roundId}</p>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
