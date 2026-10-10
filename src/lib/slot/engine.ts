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
export const FREE_SPIN_MULTIPLIER = 2;

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
export interface SpinStep {
  grid: Grid; lineWins: LineWin[]; scatterCount: number; scatterWin: number;
  win: number; multiplier: number; freeSpinsAwarded: number;
}
export interface RoundResult {
  roundId: string; gameId: string; version: string; bet: number;
  base: SpinStep; freeSpins: SpinStep[]; totalWin: number; timestamp: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function evaluate(grid: Grid, bet: number, multiplier: number): SpinStep {
  const lineBet = bet / LINES;
  const lineWins: LineWin[] = [];
  PAYLINES.forEach((pl, li) => {
    const syms = pl.map((row, reel) => grid[reel]![row]!);
    if (syms[0] === "SCATTER") return;
    let target: SymbolId | null = null;
    let count = 0;
    for (const s of syms) {
      if (s === "SCATTER") break;
      if (s === "WILD") { count++; continue; }
      if (target === null) { target = s; count++; continue; }
      if (s === target) { count++; continue; }
      break;
    }
    // Línea solo de wilds o wilds+símbolo: comparar la mejor opción
    let wildRun = 0;
    for (const s of syms) { if (s === "WILD") wildRun++; else break; }
    const sym = target ?? "WILD";
    const pay = count >= 3 ? PAYTABLE[sym]?.[count - 3] ?? 0 : 0;
    const wildPay = wildRun >= 3 ? PAYTABLE.WILD![wildRun - 3]! : 0;
    const [finalSym, finalCount, finalPay]: [SymbolId, number, number] = wildPay > pay ? ["WILD" as SymbolId, wildRun, wildPay] : [sym, count, pay];
    if (finalPay > 0) {
      lineWins.push({
        line: li, symbol: finalSym, count: finalCount,
        win: round2(finalPay * lineBet * multiplier),
        positions: pl.slice(0, finalCount).map((row, reel) => [reel, row]),
      });
    }
  });
  const scatterCount = grid.flat().filter((s) => s === "SCATTER").length;
  const sc = Math.min(scatterCount, 5);
  const scatterWin = round2((SCATTER_PAY[sc] ?? 0) * bet * multiplier);
  const win = round2(lineWins.reduce((s, l) => s + l.win, 0) + scatterWin);
  return { grid, lineWins, scatterCount, scatterWin, win, multiplier, freeSpinsAwarded: FREE_SPINS[sc] ?? 0 };
}

function spinGrid(): Grid {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, pick));
}

export function playRound(bet: number): RoundResult {
  if (!BET_LEVELS.includes(bet)) throw new Error("Apuesta no válida");
  const base = evaluate(spinGrid(), bet, 1);
  const freeSpins: SpinStep[] = [];
  let remaining = base.freeSpinsAwarded;
  while (remaining > 0 && freeSpins.length < 100) {
    const step = evaluate(spinGrid(), bet, FREE_SPIN_MULTIPLIER);
    freeSpins.push(step);
    remaining += step.freeSpinsAwarded - 1; // retrigger
  }
  const totalWin = round2(base.win + freeSpins.reduce((s, f) => s + f.win, 0));
  return {
    roundId: globalThis.crypto.randomUUID(), gameId: GAME_ID, version: GAME_VERSION,
    bet, base, freeSpins, totalWin, timestamp: new Date().toISOString(),
  };
}
