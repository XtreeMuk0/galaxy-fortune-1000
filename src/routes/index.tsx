import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, History, Info, Zap, Code2 } from "lucide-react";
import bg from "@/assets/bg-galaxias.jpg";
import { SlotSymbol } from "@/components/slot/SlotSymbol";
import { ALL_SYMBOLS, SYMBOL_NAME } from "@/components/slot/symbols";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  BET_LEVELS, PAYTABLE, SCATTER_PAY, FREE_SPINS, FREE_SPIN_MULTIPLIER, REELS, ROWS,
  type Grid, type RoundResult, type SpinStep, type SymbolId,
} from "@/lib/slot/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Galaxias — Slot espacial 5x3" },
      { name: "description", content: "Juega a Galaxias: 20 líneas, wilds galácticos y giros gratis x2." },
      { property: "og:title", content: "Galaxias — Slot espacial 5x3" },
      { property: "og:description", content: "20 líneas, wilds galácticos y giros gratis x2." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

const randGrid = (): Grid =>
  Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]));
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
  const [balance, setBalance] = useState(1000);
  const [betIdx, setBetIdx] = useState(2);
  const [grid, setGrid] = useState<Grid>(() => randGrid());
  const [spinning, setSpinning] = useState<boolean[]>(Array(REELS).fill(false));
  const [winPos, setWinPos] = useState<Set<string>>(new Set());
  const [lastWin, setLastWin] = useState(0);
  const [fs, setFs] = useState<{ left: number; total: number; win: number } | null>(null);
  const [banner, setBanner] = useState<{ title: string; amount?: number } | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const bet = BET_LEVELS[betIdx];
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useEffect(() => {
    if (!launch) return;
    fetch("/api/public/v1/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ launch }) })
      .then((r) => r.json()).then((j) => typeof j.balance === "number" ? setBalance(j.balance) : setError("No se pudo leer el saldo"))
      .catch(() => setError("No se pudo conectar con el casino"));
  }, [launch]);

  const animateStep = useCallback(async (step: SpinStep) => {
    setWinPos(new Set());
    setSpinning(Array(REELS).fill(true));
    await sleep(450);
    for (let r = 0; r < REELS; r++) {
      await sleep(r === REELS - 1 && step.scatterCount >= 2 ? 900 : 180);
      setGrid((g) => g.map((col, i) => (i === r ? step.grid[r] : col)));
      setSpinning((s) => s.map((v, i) => (i === r ? false : v)));
    }
    const pos = new Set<string>();
    step.lineWins.forEach((l) => l.positions.forEach(([a, b]) => pos.add(`${a}-${b}`)));
    if (step.scatterWin > 0 || step.freeSpinsAwarded) step.grid.forEach((col, a) => col.forEach((s, b) => s === "SCATTER" && pos.add(`${a}-${b}`)));
    setWinPos(pos);
    if (step.win > 0) await sleep(900);
  }, []);

  const spin = useCallback(async () => {
    if (busy) return;
    if (!real && balance < bet) { setError("Saldo insuficiente"); setAuto(0); return; }
    setBusy(true); setError(null); setLastWin(0); setBanner(null);
    if (!real) setBalance((b) => +(b - bet).toFixed(2));
    try {
      const res = await fetch("/api/public/v1/spin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: real ? "real" : "demo", bet, launch: launch ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === "insufficient_funds" ? "Saldo insuficiente" : "Error de conexión con el servidor");
      const round: RoundResult = json.round;
      await animateStep(round.base);
      setLastWin(round.base.win);
      if (round.freeSpins.length) {
        setBanner({ title: `${round.base.freeSpinsAwarded} GIROS GRATIS` });
        await sleep(1800); setBanner(null);
        let acc = round.base.win;
        for (let i = 0; i < round.freeSpins.length; i++) {
          setFs({ left: round.freeSpins.length - i - 1, total: round.freeSpins.length, win: acc });
          await animateStep(round.freeSpins[i]);
          acc += round.freeSpins[i].win; setLastWin(+acc.toFixed(2));
          setFs({ left: round.freeSpins.length - i - 1, total: round.freeSpins.length, win: acc });
        }
        setFs(null);
      }
      if (round.totalWin >= bet * 15) { setBanner({ title: round.totalWin >= bet * 50 ? "MEGA WIN" : "BIG WIN", amount: round.totalWin }); setTimeout(() => setBanner(null), 2600); }
      if (real) { if (typeof json.balance === "number") setBalance(json.balance); }
      else setBalance((b) => +(b + round.totalWin).toFixed(2));
      setHistory((h) => [round, ...h].slice(0, 100));
    } catch (e) {
      if (!real) setBalance((b) => +(b + bet).toFixed(2));
      setError((e as Error).message); setAuto(0);
      setSpinning(Array(REELS).fill(false));
    } finally { setBusy(false); }
  }, [busy, real, balance, bet, launch, animateStep]);

  useEffect(() => {
    if (auto > 0 && !busy) {
      const t = setTimeout(() => { if (autoRef.current > 0) { setAuto((a) => a - 1); spin(); } }, 400);
      return () => clearTimeout(t);
    }
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

      <header className="mb-4 text-center">
        <h1 className="font-display text-gold text-5xl font-black tracking-widest drop-shadow-2xl sm:text-7xl">GALAXIAS</h1>
        <p className="mt-1 font-display text-xs tracking-[0.4em] text-secondary">
          {real ? `MODO REAL · ${launch!.operator.toUpperCase()}` : "MODO DEMO · DINERO FICTICIO"}
        </p>
      </header>

      <section className="w-full max-w-4xl">
        <div className="bg-frame rounded-3xl p-1 shadow-cyan">
          <div className="bg-reel relative rounded-[1.35rem] p-2 sm:p-4">
            {fs && (
              <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-5 py-1 font-display text-sm font-bold text-accent-foreground shadow-gold">
                GIROS GRATIS x{FREE_SPIN_MULTIPLIER} · Quedan {fs.left}
              </div>
            )}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
              {grid.map((col, r) => (
                <div key={r} className="relative h-[16rem] overflow-hidden rounded-xl border border-border bg-background/40 sm:h-[24rem]">
                  {spinning[r] ? (
                    <div className="animate-reel-spin flex flex-col">
                      {[...ALL_SYMBOLS, ...ALL_SYMBOLS].map((s, i) => (
                        <div key={i} className="h-[5.33rem] sm:h-[8rem]"><SlotSymbol id={s} /></div>
                      ))}
                    </div>
                  ) : (
                    <div className="animate-land grid h-full grid-rows-3">
                      {col.map((s, row) => (
                        <SlotSymbol key={row} id={s} win={winPos.has(`${r}-${row}`)} className={winPos.size && !winPos.has(`${r}-${row}`) ? "opacity-40" : ""} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

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
            <Stat label="GANANCIA" value={fmt(lastWin)} highlight={lastWin > 0} />
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
            <RoundBtn onClick={() => setAuto(auto ? 0 : 25)} label="Autojuego" active={auto > 0}><Zap /></RoundBtn>
            <RoundBtn onClick={() => setShowPay(true)} label="Tabla de pagos"><Info /></RoundBtn>
            <RoundBtn onClick={() => setShowHist(true)} label="Historial"><History /></RoundBtn>
          </div>
        </div>
        {error && <p className="mt-2 text-center text-sm font-semibold text-destructive">{error}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pulsa espacio para girar · <Link to="/integracion" className="inline-flex items-center gap-1 text-secondary underline"><Code2 className="h-3 w-3" />Integración para casinos</Link>
        </p>
      </section>

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
  const rows = useMemo(() => Object.entries(PAYTABLE) as [SymbolId, [number, number, number]][], []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-gold text-2xl">Tabla de pagos</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">20 líneas fijas, pagan de izquierda a derecha. La Galaxia sustituye a todos menos al Agujero negro. Valores para la apuesta actual.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(([s, p]) => (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-border bg-muted p-2">
              <div className="h-14 w-14 shrink-0"><SlotSymbol id={s} /></div>
              <div className="text-xs">
                {[5, 4, 3].map((n) => <p key={n}><span className="text-muted-foreground">{n}×</span> {fmt(p[n - 3] * lineBet)}</p>)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-muted p-3">
          <div className="h-16 w-16 shrink-0"><SlotSymbol id="SCATTER" /></div>
          <div className="text-sm">
            <p className="font-bold">{SYMBOL_NAME.SCATTER} — paga en cualquier posición</p>
            {[5, 4, 3].map((n) => <p key={n}>{n}× → {fmt(SCATTER_PAY[n] * bet)} + {FREE_SPINS[n]} giros gratis</p>)}
            <p className="text-muted-foreground">Todos los premios de giros gratis x{FREE_SPIN_MULTIPLIER}. Se pueden reactivar.</p>
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
              <p className="text-muted-foreground">Apuesta {fmt(h.bet)} · {h.base.lineWins.length} líneas{h.freeSpins.length ? ` · ${h.freeSpins.length} giros gratis` : ""}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">ID {h.roundId}</p>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
