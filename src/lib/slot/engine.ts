// Galaxias — motor matemático puro. Se ejecuta en el servidor (autoritativo).
// 5 rodillos x 3 filas, 20 líneas fijas, WILD sustituye, SCATTER x3+ = giros gratis x2.

export type SymbolId =
  | "WILD" | "SCATTER" | "ASTRO" | "PLANET" | "UFO" | "COMET" | "CRYSTAL"
  | "A" | "K" | "Q" | "J";

export const ROWS = 3;
export const REELS = 5;
export const GAME_ID = "galaxias";
export const GAME_VERSION = "1.0.0";

// Pesos por rodillo (tira virtual)
const WEIGHTS: Record<SymbolId, number> = {
  WILD: 2, SCATTER: 2, ASTRO: 4, PLANET: 6, UFO: 7, COMET: 8, CRYSTAL: 9,
  A: 12, K: 13, Q: 14, J: 15,
};

// Pagos en multiplicador de la apuesta por línea (3,4,5 iguales)
export const PAYTABLE: Partial<Record<SymbolId, [number, number, number]>> = {
  WILD: [50, 250, 1000],
  ASTRO: [25, 100, 500],
  PLANET: [15, 60, 250],
  UFO: [10, 40, 150],
  COMET: [8, 25, 100],
  CRYSTAL: [6, 20, 80],
  A: [4, 12, 40],
  K: [3, 10, 30],
  Q: [2, 8, 25],
  J: [2, 6, 20],
};
// Pago de scatter: multiplicador de la apuesta TOTAL
export const SCATTER_PAY: Record<number, number> = { 3: 2, 4: 10, 5: 50 };
export const FREE_SPINS: Record<number, number> = { 3: 10, 4: 15, 5: 20 };

export const PAYLINES: number[][] = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
];
export const LINES = PAYLINES.length;
export const BET_LEVELS = [0.2, 0.4, 1, 2, 4, 10, 20, 50, 100];

const ENTRIES = Object.entries(WEIGHTS) as [SymbolId, number][];
const TOTAL = ENTRIES.reduce((s, [, w]) => s + w, 0);

function rand(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0]! / 0x100000000;
}
function pick(): SymbolId {
  let r = rand() * TOTAL;
  for (const [s, w] of ENTRIES) { if ((r -= w) < 0) return s; }
  return "J";
}

export type Grid = SymbolId[][]; // grid[reel][row]
export interface LineWin { line: number; symbol: SymbolId; count: number; win: number; positions: [number, number][] }
export interface Orb { reel: number; row: number; value: number }
export interface SpinStep {
  grid: Grid; lineWins: LineWin[]; scatterCount: number; scatterWin: number;
  win: number; multiplier: number; freeSpinsAwarded: number; orbs: Orb[];
}
export type BuyType = "bonus" | "super";
export interface RoundResult {
  roundId: string; gameId: string; version: string; bet: number; cost: number; buy: BuyType | null;
  base: SpinStep; freeSpins: SpinStep[]; totalWin: number; capped: boolean; timestamp: string;
}

// ---- Función bonus: orbes multiplicadores (solo en giros gratis) ----
// Valores ajustados por simulación (scripts/rtp-sim.ts) para controlar el RTP.
export const TUNING = { PAY_SCALE: 4.23, ORB_CHANCE: 0.2 }; // ajustado por simulación
export const ORB_TABLE: [number, number][] = [
  [2, 400], [3, 250], [5, 150], [10, 80], [25, 35], [50, 15], [100, 6], [250, 2], [500, 0.6], [1000, 0.15],
];
// En la super compra los orbes normales no traen x1000; se garantizan 2 x1000 en tiradas aleatorias
const ORB_TABLE_SUPER = ORB_TABLE.filter(([v]) => v < 1000);
export const BUY_COST: Record<BuyType, number> = { bonus: 100, super: 500 };
export const SUPER_X1000_COUNT = 2;
export const MAX_WIN_X = 10000; // premio máximo por ronda (x apuesta)

const round2 = (n: number) => Math.round(n * 100) / 100;

function pickWeighted(table: [number, number][]): number {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[0]![0];
}

function evaluate(grid: Grid, bet: number, orbs: Orb[]): SpinStep {
  const lineBet = bet / LINES;
  const lineWins: LineWin[] = [];
  PAYLINES.forEach((pl, li) => {
    const syms = pl.map((row, reel) => grid[reel]![row]!);
    if (syms[0] === "SCATTER" || syms[0] === "ORB") return;
    let target: SymbolId | null = null;
    let count = 0;
    for (const s of syms) {
      if (s === "SCATTER" || s === "ORB") break;
      if (s === "WILD") { count++; continue; }
      if (target === null) { target = s; count++; continue; }
      if (s === target) { count++; continue; }
      break;
    }
    let wildRun = 0;
    for (const s of syms) { if (s === "WILD") wildRun++; else break; }
    const sym = target ?? "WILD";
    const pay = count >= 3 ? PAYTABLE[sym]?.[count - 3] ?? 0 : 0;
    const wildPay = wildRun >= 3 ? PAYTABLE.WILD![wildRun - 3]! : 0;
    const [finalSym, finalCount, finalPay]: [SymbolId, number, number] = wildPay > pay ? ["WILD" as SymbolId, wildRun, wildPay] : [sym, count, pay];
    if (finalPay > 0) {
      lineWins.push({
        line: li, symbol: finalSym, count: finalCount, win: round2(finalPay * lineBet * TUNING.PAY_SCALE),
        positions: pl.slice(0, finalCount).map((row, reel) => [reel, row]),
      });
    }
  });
  const scatterCount = grid.flat().filter((s) => s === "SCATTER").length;
  const sc = Math.min(scatterCount, 5);
  const scatterWin = round2((SCATTER_PAY[sc] ?? 0) * bet * TUNING.PAY_SCALE);
  const raw = lineWins.reduce((s, l) => s + l.win, 0) + scatterWin;
  const multiplier = orbs.length ? orbs.reduce((s, o) => s + o.value, 0) : 1;
  return { grid, lineWins, scatterCount, scatterWin, win: round2(raw * multiplier), multiplier, freeSpinsAwarded: FREE_SPINS[sc] ?? 0, orbs };
}

function spinGrid(): Grid {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, pick));
}

function freeSpin(bet: number, table: [number, number][], forceX1000: boolean): SpinStep {
  const grid = spinGrid();
  const orbs: Orb[] = [];
  grid.forEach((col, reel) => col.forEach((s, row) => {
    if (s !== "SCATTER" && s !== "WILD" && rand() < TUNING.ORB_CHANCE) {
      col[row] = "ORB"; orbs.push({ reel, row, value: pickWeighted(table) });
    }
  }));
  if (forceX1000) {
    const free: [number, number][] = [];
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s !== "SCATTER" && s !== "WILD" && s !== "ORB") free.push([reel, row]); }));
    const [reel, row] = free[Math.floor(rand() * free.length)]!;
    grid[reel]![row] = "ORB"; orbs.push({ reel, row, value: 1000 });
  }
  return evaluate(grid, bet, orbs);
}

function forcedTriggerGrid(): Grid {
  const grid = spinGrid().map((col) => col.map((s) => (s === "SCATTER" ? "J" : s)) as SymbolId[]);
  const reels = [0, 1, 2, 3, 4].sort(() => rand() - 0.5).slice(0, 3);
  for (const r of reels) grid[r]![Math.floor(rand() * ROWS)] = "SCATTER";
  return grid;
}

export function playRound(bet: number, buy: BuyType | null = null): RoundResult {
  if (!BET_LEVELS.includes(bet)) throw new Error("Apuesta no válida");
  const base = evaluate(buy ? forcedTriggerGrid() : spinGrid(), bet, []);
  const freeSpins: SpinStep[] = [];
  const table = buy === "super" ? ORB_TABLE_SUPER : ORB_TABLE;
  const x1000At = new Set<number>();
  if (buy === "super") while (x1000At.size < SUPER_X1000_COUNT) x1000At.add(Math.floor(rand() * base.freeSpinsAwarded));
  let remaining = base.freeSpinsAwarded;
  while (remaining > 0 && freeSpins.length < 100) {
    const step = freeSpin(bet, table, x1000At.has(freeSpins.length));
    freeSpins.push(step);
    remaining += step.freeSpinsAwarded - 1; // reactivación
  }
  let totalWin = round2(base.win + freeSpins.reduce((s, f) => s + f.win, 0));
  const capped = totalWin > bet * MAX_WIN_X;
  if (capped) totalWin = round2(bet * MAX_WIN_X);
  return {
    roundId: globalThis.crypto.randomUUID(), gameId: GAME_ID, version: GAME_VERSION,
    bet, cost: round2(bet * (buy ? BUY_COST[buy] : 1)), buy,
    base, freeSpins, totalWin, capped, timestamp: new Date().toISOString(),
  };
}
